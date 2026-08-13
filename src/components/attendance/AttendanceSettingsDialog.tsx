import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { saveAttendanceSettings } from '@/utils/attendance/attendanceStore';
import { formatCurrency } from '@/utils/attendance/salaryCalc';
import { DEFAULT_ATTENDANCE_SETTINGS, type AttendanceSettings } from '@/utils/attendance/types';

interface AttendanceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AttendanceSettings;
  onSaved: (settings: AttendanceSettings) => void;
}

const DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

/**
 * The shop's working rules — one set for everyone.
 *
 * These drive every salary on the Payroll tab, so the dialog shows a live worked example
 * with a real ₹10,000 salary. Someone changing "break" from 60 to 30 minutes is changing
 * what people get paid, and should be able to see that before saving rather than after.
 */
const AttendanceSettingsDialog: React.FC<AttendanceSettingsDialogProps> = ({
  open,
  onOpenChange,
  settings,
  onSaved,
}) => {
  const { userData } = useAuth();
  const [draft, setDraft] = useState<AttendanceSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const workingDaysPerWeek = 7 - draft.weeklyOffDays.length;
  // A 26-day month is the usual six-day-week figure; used only for the illustration.
  const exampleWorkingDays = Math.round((workingDaysPerWeek * 52) / 12);
  const exampleHours = exampleWorkingDays * (draft.standardHoursPerDay || 0);
  const exampleRate = exampleHours > 0 ? 10000 / exampleHours : 0;

  const toggleDay = (day: number) => {
    setDraft((prev) => ({
      ...prev,
      weeklyOffDays: prev.weeklyOffDays.includes(day)
        ? prev.weeklyOffDays.filter((d) => d !== day)
        : [...prev.weeklyOffDays, day].sort(),
    }));
  };

  const handleSave = async () => {
    if (!draft.standardHoursPerDay || draft.standardHoursPerDay <= 0) {
      toast({
        title: 'Standard hours must be more than zero',
        description: 'It is the divisor behind every hourly rate.',
        variant: 'destructive',
      });
      return;
    }
    if (draft.weeklyOffDays.length >= 7) {
      toast({
        title: 'At least one working day is needed',
        description: 'With every day off there are no hours to pay against.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await saveAttendanceSettings(draft, userData?.name || userData?.email || 'admin');
      toast({
        title: 'Working rules saved',
        description: 'Payroll has been recalculated for every employee.',
      });
      onSaved(draft);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Could not save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Working rules</DialogTitle>
          <DialogDescription>
            One set of rules for the whole shop. These decide how every salary is calculated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="office-start">Office starts</Label>
              <Input
                id="office-start"
                type="time"
                value={draft.officeStartTime}
                onChange={(e) => setDraft({ ...draft, officeStartTime: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="office-end">Office ends</Label>
              <Input
                id="office-end"
                type="time"
                value={draft.officeEndTime}
                onChange={(e) => setDraft({ ...draft, officeEndTime: e.target.value })}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-gray-500">
            The standard day. Work outside these hours still counts towards pay — that is what
            lets someone who arrived late stay on and still earn a full day.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="standard-hours">Paid hours per day</Label>
              <Input
                id="standard-hours"
                type="number"
                min={1}
                max={24}
                step={0.5}
                value={draft.standardHoursPerDay}
                onChange={(e) =>
                  setDraft({ ...draft, standardHoursPerDay: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="break-minutes">Unpaid break (minutes)</Label>
              <Input
                id="break-minutes"
                type="number"
                min={0}
                max={240}
                step={15}
                value={draft.breakMinutes}
                onChange={(e) => setDraft({ ...draft, breakMinutes: Number(e.target.value) })}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-gray-500">
            Used only when someone did not punch out for lunch. In at 9:00, out at 18:00 with a
            60-minute break is {Math.max(0, 9 - draft.breakMinutes / 60)} paid hours. When the
            punches do show them leaving and coming back, the real gap is used instead.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="min-punch-gap">Ignore repeat presses within (min)</Label>
              <Input
                id="min-punch-gap"
                type="number"
                min={0}
                max={60}
                step={1}
                value={draft.minPunchGapMinutes}
                onChange={(e) =>
                  setDraft({ ...draft, minPunchGapMinutes: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min-break">Count as a break from (min)</Label>
              <Input
                id="min-break"
                type="number"
                min={0}
                max={240}
                step={5}
                value={draft.minBreakMinutes}
                onChange={(e) => setDraft({ ...draft, minBreakMinutes: Number(e.target.value) })}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-gray-500">
            People press the sensor twice when they are unsure it read, and the terminal repeats
            a batch after a dropped connection. Presses closer together than the first figure
            count once. Time away shorter than the second stays paid — stepping out for three
            minutes is not a lunch break.
          </p>

          <div className="space-y-2">
            <Label>Weekly days off</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const isOff = draft.weeklyOffDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      isOff
                        ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500">
              Highlighted days are closed. {workingDaysPerWeek} working day
              {workingDaysPerWeek === 1 ? '' : 's'} a week.
            </p>
          </div>

          <Card className="border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/30">
            <CardContent className="space-y-1 p-4 text-sm">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                Worked example — someone on ₹10,000 a month
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                ≈{exampleWorkingDays} working days × {draft.standardHoursPerDay} hrs ={' '}
                <strong>{exampleHours} hrs</strong> a month
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                ₹10,000 ÷ {exampleHours} hrs = <strong>{formatCurrency(Math.round(exampleRate * 100) / 100)}</strong> per hour
              </p>
              <p className="pt-1 text-xs text-gray-600 dark:text-gray-400">
                Pay follows the hours actually worked. A short month pays less than ₹10,000, and
                hours beyond a full month are paid at the same rate as overtime.
              </p>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => setDraft({ ...DEFAULT_ATTENDANCE_SETTINGS })}
            disabled={saving}
          >
            Reset to defaults
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save rules'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceSettingsDialog;
