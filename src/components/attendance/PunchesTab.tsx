import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Fingerprint, LogIn, LogOut, Search, Trash2 } from 'lucide-react';
import { saveAs } from 'file-saver';
import { toast } from '@/hooks/use-toast';
import { deletePunch, deletePunches } from '@/utils/attendance/deviceStore';
import type { AttendanceEmployee, DevicePunch } from '@/utils/attendance/types';
import BulkDeleteDialog, { type DeleteScope } from './BulkDeleteDialog';
import { punchRoles, type PunchRole } from '@/utils/attendance/punchSessions';
import { DEFAULT_ATTENDANCE_SETTINGS, type AttendanceSettings } from '@/utils/attendance/types';

interface PunchesTabProps {
  punches: DevicePunch[];
  employees: AttendanceEmployee[];
  loading: boolean;
  /** Reload after a deletion, so the table matches the database. */
  onChanged: () => void;
  /** The range these punches were loaded for, named for the delete confirmation. */
  periodLabel: string;
  /** The shop's rules — they decide which presses are repeats. */
  settings?: AttendanceSettings;
}

/** How each role is drawn. `repeat` is deliberately quiet: it is not a period boundary. */
const ROLE_BADGE: Record<PunchRole, { label: string; className: string }> = {
  in: {
    label: 'Check in',
    className:
      'border-green-300 bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300',
  },
  out: {
    label: 'Check out',
    className: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  },
  repeat: {
    label: 'Repeat press',
    className: 'border-gray-300 bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400',
  },
};

/** '2026-08-08' -> '08 Aug 2026' */
function formatDate(dateKey: string): string {
  const [year, month, day] = (dateKey || '').split('-').map(Number);
  if (!year) return dateKey || '—';
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** '2026-08-08 09:14:22' -> '09:14:22' */
function timeOf(punch: DevicePunch): string {
  const parts = (punch.punchTimeLocal || '').split(' ');
  return parts[1] || punch.punchTimeRaw || '—';
}

/**
 * RFC 4180 escaping.
 *
 * Names routinely contain commas and the occasional quote, and a raw join(',') would
 * silently shift every later column on those rows — the kind of export bug nobody
 * notices until the spreadsheet is already with the accountant.
 */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Raw fingerprint punches, exactly as the device reported them.
 *
 * The Records tab shows the day summary that payroll uses; this is the evidence behind
 * it. When someone disputes a day, this is where the individual presses are.
 */
const PunchesTab: React.FC<PunchesTabProps> = ({
  punches,
  employees,
  loading,
  onChanged,
  periodLabel,
  settings = DEFAULT_ATTENDANCE_SETTINGS,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const handleDelete = async (punch: DevicePunch) => {
    if (
      !window.confirm(
        `Delete the punch for ${punch.employeeName || punch.userPin} at ${punch.punchTimeLocal}?

` +
          'The day record on the Records tab is not changed — correct that separately if the ' +
          'hours are now wrong. This deletion is recorded in the activity log.'
      )
    ) {
      return;
    }

    setDeletingId(punch.id);
    try {
      await deletePunch(punch.id);
      toast({ title: 'Punch deleted', description: 'Recorded in the activity log.' });
      onChanged();
    } catch (error) {
      toast({
        title: 'Could not delete',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return punches.filter((punch) => {
      if (employeeFilter !== 'all' && punch.userPin !== employeeFilter) return false;
      if (!term) return true;
      return (
        (punch.employeeName || '').toLowerCase().includes(term) ||
        (punch.userPin || '').toLowerCase().includes(term) ||
        (punch.punchTimeLocal || '').toLowerCase().includes(term) ||
        (punch.deviceSn || '').toLowerCase().includes(term)
      );
    });
  }, [punches, search, employeeFilter]);

  /**
   * Check-in or check-out, decided HERE rather than by the terminal.
   *
   * The device sets its own IN/OUT flag from whichever mode key it happened to be in, and
   * it is routinely wrong — the shop's own afternoon of fifteen presses came through as
   * "Check in", "Check in", "Overtime in", with not one "out" among them. What a press
   * means is its position in that person's day: first in, second out, third in again.
   *
   * Presses inside an already-counted minute are marked as repeats rather than given a
   * role, so the table shows plainly why fifteen presses made one period.
   */
  const rolesByPunch = useMemo(() => {
    const byDay = new Map<string, DevicePunch[]>();
    for (const punch of punches) {
      const key = `${punch.userPin}_${punch.punchDate}`;
      const list = byDay.get(key) || [];
      list.push(punch);
      byDay.set(key, list);
    }

    const assigned = new Map<string, PunchRole>();

    for (const dayPunches of byDay.values()) {
      const ordered = [...dayPunches].sort((a, b) => timeOf(a).localeCompare(timeOf(b)));
      const minutes = ordered.map((punch) => timeOf(punch).slice(0, 5));
      const roles = punchRoles(minutes, settings);
      const claimed = new Set<string>();

      ordered.forEach((punch, index) => {
        const minute = minutes[index];
        // Only the first press of a minute carries its role; the rest are the same event.
        const role = claimed.has(minute) ? 'repeat' : roles.get(minute) || 'repeat';
        claimed.add(minute);
        assigned.set(punch.id, role);
      });
    }

    return assigned;
  }, [punches, settings]);

  const roleOf = (punch: DevicePunch): PunchRole => rolesByPunch.get(punch.id) || 'repeat';

  const totals = useMemo(
    () => ({
      total: filtered.length,
      checkIns: filtered.filter((punch) => rolesByPunch.get(punch.id) === 'in').length,
      checkOuts: filtered.filter((punch) => rolesByPunch.get(punch.id) === 'out').length,
    }),
    [filtered, rolesByPunch]
  );

  const handleDeleteAll = async (scope: DeleteScope) => {
    const target = scope === 'filtered' ? filtered : punches;
    try {
      const removed = await deletePunches(
        target,
        scope === 'filtered' ? `filtered view, ${periodLabel}` : periodLabel
      );
      toast({
        title: `Deleted ${removed} punch${removed === 1 ? '' : 'es'}`,
        description: 'Recorded in the activity log.',
      });
      onChanged();
    } catch (error) {
      toast({
        title: 'Could not delete',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast({ title: 'Nothing to export', variant: 'destructive' });
      return;
    }

    const headers = [
      'Employee',
      'PIN',
      'Date',
      'Time',
      'Type',
      'Device said',
      'Device time (raw)',
      'UTC',
      'Verify mode',
      'Device',
      'Received at',
    ];

    const rows = filtered.map((punch) => [
      punch.employeeName || punch.userPin,
      punch.userPin,
      punch.punchDate,
      timeOf(punch),
      ROLE_BADGE[roleOf(punch)].label,
      // Kept alongside ours purely as evidence — this is the flag we do not trust.
      punch.punchStateLabel || '',
      punch.punchTimeRaw,
      punch.punchTimeUtc || '',
      punch.verifyMode || '',
      punch.deviceSn,
      punch.receivedAt || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');

    // A BOM so Excel opens the file as UTF-8 rather than mangling names.
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const stamp = new Date().toISOString().slice(0, 10);
    saveAs(blob, `punches-${stamp}.csv`);

    toast({ title: `Exported ${filtered.length} punch${filtered.length === 1 ? '' : 'es'}` });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Fingerprint className="h-5 w-5 shrink-0 text-purple-600" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Punches</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totals.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <LogIn className="h-5 w-5 shrink-0 text-green-600" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Check-ins</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totals.checkIns}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <LogOut className="h-5 w-5 shrink-0 text-blue-600" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Check-outs</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totals.checkOuts}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name, PIN, time or device"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="All employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {employees.map((employee) => (
              <SelectItem key={employee.empCode} value={employee.empCode}>
                {employee.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <Button
          variant="outline"
          onClick={() => setBulkOpen(true)}
          disabled={punches.length === 0}
          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950/40"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete all
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-gray-500">
                      Loading punches…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <Fingerprint className="mx-auto mb-3 h-8 w-8 text-gray-400" />
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        No punches for this period
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Every fingerprint press on the office device appears here within seconds.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((punch) => (
                    <TableRow key={punch.id}>
                      <TableCell>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {punch.employeeName || punch.userPin}
                        </div>
                        <div className="text-xs text-gray-500">PIN {punch.userPin}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(punch.punchDate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono">{timeOf(punch)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className={ROLE_BADGE[roleOf(punch)].className}>
                            {ROLE_BADGE[roleOf(punch)].label}
                          </Badge>
                          {punch.parked && (
                            <Badge
                              variant="outline"
                              className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                            >
                              Held
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-500">
                        {punch.deviceSn}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deletingId === punch.id}
                          onClick={() => handleDelete(punch)}
                          title="Delete this punch"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-gray-500">
        These are the raw presses as the device reported them. The Records tab folds them into one
        check-in and check-out per day, which is what Payroll uses. A punch marked “Held” arrived
        while its device was still awaiting approval.
      </p>

      <BulkDeleteDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        noun="punch"
        nounPlural="punches"
        filteredCount={filtered.length}
        totalCount={punches.length}
        periodLabel={periodLabel}
        keptNote="Day records on the Records tab are kept as they are — deleting the raw feed does not change anyone's paid hours. Correct the day itself if the hours are now wrong."
        onConfirm={handleDeleteAll}
      />
    </div>
  );
};

export default PunchesTab;
