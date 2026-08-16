import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Fingerprint,
  ShieldQuestion,
  WifiOff,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  approveDevice,
  blockDevice,
  requestClockSync,
  setDeviceClockOffset,
  summariseDeviceHealth,
} from '@/utils/attendance/deviceStore';
import type { AttendanceDevice } from '@/utils/attendance/types';

interface DeviceHealthBarProps {
  devices: AttendanceDevice[];
  loading: boolean;
  onChanged: () => void;
}

/**
 * How long the device may stay silent before this is treated as a fault.
 *
 * The terminal polls for commands roughly every 30 seconds, so 15 minutes is many missed
 * polls — long enough that a brief broadband blip does not cry wolf, short enough that a
 * dead device is caught the same morning rather than at month-end payroll.
 */
const STALE_MINUTES = Number(import.meta.env.VITE_DEVICE_STALE_MINUTES) || 15;

function relativeTime(iso?: string): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';

  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * The health signal for the fingerprint terminal.
 *
 * A device that has quietly stopped reporting is the failure mode that actually costs
 * money — it looks exactly like "nobody came to work" until payroll is wrong. This bar
 * exists so that shows up on the dashboard instead.
 *
 * It also carries device approval: a terminal that contacts the ingest server for the
 * first time is quarantined, and this is where it gets let in.
 */
const DeviceHealthBar: React.FC<DeviceHealthBarProps> = ({ devices, loading, onChanged }) => {
  const { userData } = useAuth();
  const [busySn, setBusySn] = useState<string | null>(null);

  const summary = useMemo(
    () => summariseDeviceHealth(devices, STALE_MINUTES),
    [devices]
  );

  const handleApprove = async (device: AttendanceDevice) => {
    setBusySn(device.sn);
    try {
      const result = await approveDevice(device.sn, userData?.name || userData?.email || 'admin');
      toast({
        title: `${device.name || device.sn} approved`,
        description: result.punchesBackfilled
          ? `${result.punchesBackfilled} punch(es) held while it waited have been added — ` +
            `${result.daysWritten} day record(s), ${result.employeesCreated} new employee(s).`
          : 'Punches from this device will now count towards attendance.',
      });
      onChanged();
    } catch (error) {
      toast({
        title: 'Could not approve the device',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusySn(null);
    }
  };

  /**
   * Push the correct time to the terminal on its next poll.
   *
   * The server already does this automatically every few hours; this is for when someone is
   * standing in front of a wrong clock and wants it fixed now — usually after a power cut.
   */
  const handleClockSync = async (device: AttendanceDevice) => {
    setBusySn(device.sn);
    try {
      await requestClockSync(device.sn);
      toast({
        title: 'Clock sync queued',
        description:
          'The device sets itself from the server on its next check-in, usually within a minute.',
      });
      onChanged?.();
    } catch (error) {
      toast({
        title: 'Could not queue the clock sync',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusySn(null);
    }
  };

  /**
   * Correct every future punch from a terminal whose clock cannot be fixed.
   *
   * The honest last resort. The wall display stays wrong — cosmetic — while the hours people
   * are paid for become right, which is the part that decides wages.
   */
  const handleApplyOffset = async (device: AttendanceDevice, minutes: number) => {
    if (
      !window.confirm(
        `Correct every punch from this device by ${minutes > 0 ? "+" : ""}${minutes} minutes?` +
          `\n\nUse this when the terminal will not keep the right time. The clock on the ` +
          `wall stays wrong, but the recorded hours become correct.` +
          `\n\nPunches already saved keep the times they were recorded with.`
      )
    ) {
      return;
    }

    setBusySn(device.sn);
    try {
      await setDeviceClockOffset(device.sn, minutes);
      toast({
        title: minutes ? 'Punch times will be corrected' : 'Correction removed',
        description: minutes
          ? `Every punch from now on is shifted by ${minutes > 0 ? '+' : ''}${minutes} minutes.`
          : 'Punches are stored exactly as the device sends them.',
      });
      onChanged();
    } catch (error) {
      toast({
        title: 'Could not save the correction',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusySn(null);
    }
  };

  const handleBlock = async (device: AttendanceDevice) => {
    if (
      !window.confirm(
        `Block ${device.name || device.sn}?\n\nIts punches will be discarded on arrival. ` +
          'Do this for a device you do not recognise.'
      )
    ) {
      return;
    }

    setBusySn(device.sn);
    try {
      await blockDevice(device.sn);
      toast({ title: 'Device blocked' });
      onChanged();
    } catch (error) {
      toast({
        title: 'Could not block the device',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusySn(null);
    }
  };

  /**
   * What to say about a wrong clock — and it depends on whether we have already tried.
   *
   * If the server pushed the time recently and the device is still out, the device is
   * ignoring us and only the keypad will fix it. Saying "queued" in that case sends the
   * owner away thinking it is handled.
   */
  const clockWarning = (() => {
    const drift = summary.device?.lastClockDriftMinutes;
    if (typeof drift !== 'number' || Math.abs(drift) <= 3) return '';

    const size = `${Math.abs(drift)} minute${Math.abs(drift) === 1 ? '' : 's'}`;
    const way = drift > 0 ? 'behind' : 'ahead';

    const syncedAt = Date.parse(summary.device?.lastClockSyncAt || '');
    const syncedRecently = Number.isFinite(syncedAt) && Date.now() - syncedAt < 15 * 60 * 1000;

    return syncedRecently
      ? `Device clock is ${size} ${way}. The server has already sent a correction and the ` +
        `device did not take it — set the time on the terminal itself: Menu → System → ` +
        `Date Time → Set Time. Every punch is ${size} out until then.`
      : `Device clock is ${size} ${way} — a correction has been sent. If it is still wrong ` +
        `in a few minutes, set the time on the terminal: Menu → System → Date Time.`;
  })();

  const tone = {
    healthy: 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40',
    stale: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
    waiting: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40',
    pending: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
    blocked: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40',
    none: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40',
  }[summary.health];

  const { Icon, iconTone, headline, detail } = (() => {
    if (loading) {
      return {
        Icon: Fingerprint,
        iconTone: 'text-gray-500',
        headline: 'Checking the fingerprint device…',
        detail: '',
      };
    }

    switch (summary.health) {
      case 'healthy':
        return {
          Icon: CheckCircle2,
          iconTone: 'text-green-600 dark:text-green-400',
          headline: `${summary.device?.name || summary.device?.sn} is online`,
          detail:
            `Last checked in ${relativeTime(summary.device?.lastSeenAt)}` +
            (summary.device?.lastPunchAt
              ? ` · last punch ${relativeTime(summary.device.lastPunchAt)}`
              : ' · no punches yet'),
        };

      case 'waiting':
        return {
          Icon: Fingerprint,
          iconTone: 'text-blue-600 dark:text-blue-400',
          headline: `Waiting for ${summary.device?.name || summary.device?.sn} to connect`,
          detail:
            'The device is registered but has never contacted the server. On the terminal open ' +
            'Menu → Comm. → Cloud Server Setting, set the Server Address to your website ' +
            'address with no "https://" and no trailing slash, set the port to 443, then ' +
            'reboot it. Punches appear here within a minute of it connecting.',
        };

      case 'stale':
        return {
          Icon: AlertTriangle,
          iconTone: 'text-red-600 dark:text-red-400',
          headline: 'Fingerprint device has stopped reporting',
          detail:
            `${summary.device?.name || summary.device?.sn} was last heard from ` +
            `${relativeTime(summary.device?.lastSeenAt)}. Attendance is not being recorded. ` +
            'Check the device is powered on and its network cable is connected.',
        };

      case 'pending':
        return {
          Icon: ShieldQuestion,
          iconTone: 'text-amber-600 dark:text-amber-400',
          headline: 'A new device is waiting to be approved',
          detail:
            'It has connected and its punches are being held. Approve it to start counting ' +
            'them towards attendance and payroll.',
        };

      case 'blocked':
        return {
          Icon: Ban,
          iconTone: 'text-gray-500',
          headline: 'No active fingerprint device',
          detail: 'Every known device is blocked. Punches are being discarded on arrival.',
        };

      default:
        return {
          Icon: WifiOff,
          iconTone: 'text-gray-500',
          headline: 'No fingerprint device has connected yet',
          detail:
            'Once the terminal is pointed at the ingest server it will appear here within a ' +
            'minute. Until then you can add attendance by hand on the Records tab.',
        };
    }
  })();

  return (
    <div className={`space-y-3 rounded-xl border p-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconTone}`} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{headline}</p>
          {detail && (
            <p className="mt-0.5 break-words text-xs text-gray-600 dark:text-gray-400">{detail}</p>
          )}
          {summary.health === 'healthy' && !!summary.device?.punchCount && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-500">
              {summary.device.punchCount} punch
              {summary.device.punchCount === 1 ? '' : 'es'} received in total
            </p>
          )}

          {/*
            The clock, stated plainly. Measured from the punches themselves, so it is what
            the device actually believed the time was — not a guess. A wrong clock is
            invisible until payday otherwise.

            Two different messages, because they need two different actions. Some firmware
            acknowledges `SET OPTION DateTime` with Return=0 and then ignores it — this
            shop's K40 Pro does exactly that. Telling someone "a correction has been queued"
            when the device will not accept corrections is worse than saying nothing.
          */}
          {clockWarning && (
            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              {clockWarning}
            </p>
          )}

          {/* Already correcting: say so, because it explains why the wall clock and the
              recorded times disagree, and give a way to undo it. */}
          {!!summary.device?.clockOffsetMinutes && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-600 dark:text-gray-400">
              <span>
                Punches are being corrected by{' '}
                <b>
                  {summary.device.clockOffsetMinutes > 0 ? '+' : ''}
                  {summary.device.clockOffsetMinutes} min
                </b>{' '}
                as they arrive, so the recorded hours are right even though the terminal's
                display is not.
              </span>
              <button
                type="button"
                className="underline hover:text-gray-900 dark:hover:text-gray-200"
                onClick={() => handleApplyOffset(summary.device!, 0)}
              >
                Remove
              </button>
            </p>
          )}

          {/* Offer the correction only when the device is out and not already corrected. */}
          {!summary.device?.clockOffsetMinutes &&
            typeof summary.device?.lastClockDriftMinutes === 'number' &&
            Math.abs(summary.device.lastClockDriftMinutes) > 3 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={busySn === summary.device.sn}
                onClick={() =>
                  handleApplyOffset(summary.device!, summary.device!.lastClockDriftMinutes!)
                }
              >
                <Clock className="mr-1.5 h-3.5 w-3.5" />
                Correct punches by {summary.device.lastClockDriftMinutes > 0 ? '+' : ''}
                {summary.device.lastClockDriftMinutes} min
              </Button>
            )}
        </div>

        {/*
          Fix the clock now.
          The server re-sends the time every few hours by itself, so this is only for when
          someone is looking at a wrong clock and does not want to wait — a punch is worth
          exactly as much as the clock that stamped it.
        */}
        {summary.device && summary.device.status === 'approved' && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto shrink-0"
            disabled={busySn === summary.device.sn}
            onClick={() => handleClockSync(summary.device!)}
            title="Set the device's date and time from the server on its next check-in"
          >
            <Clock className="mr-1.5 h-3.5 w-3.5" />
            {busySn === summary.device.sn ? 'Syncing…' : 'Sync clock'}
          </Button>
        )}
      </div>

      {summary.pending.map((device) => (
        <div
          key={device.sn}
          className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                {device.sn}
              </span>
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
              >
                Awaiting approval
              </Badge>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              First seen {relativeTime(device.firstSeenAt)}
              {device.ip ? ` · from ${device.ip}` : ''}
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              disabled={busySn === device.sn}
              onClick={() => handleApprove(device)}
            >
              {busySn === device.sn ? 'Approving…' : 'Approve'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busySn === device.sn}
              className="text-red-600 hover:text-red-700"
              onClick={() => handleBlock(device)}
            >
              Block
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DeviceHealthBar;
