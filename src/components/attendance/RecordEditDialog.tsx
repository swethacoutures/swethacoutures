import React, { useEffect, useMemo, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { saveRecordManually } from '@/utils/attendance/attendanceStore';
import { hoursBetween, paidHoursForDay } from '@/utils/attendance/salaryCalc';
import { buildDayTimeline, formatDuration } from '@/utils/attendance/punchSessions';
import { todayKey } from '@/utils/attendance/punchFolding';
import { Switch } from '@/components/ui/switch';
import type {
  AttendanceEmployee,
  AttendanceRecord,
  AttendanceSettings,
} from '@/utils/attendance/types';

interface RecordEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = add a new day record. */
  record: AttendanceRecord | null;
  employees: AttendanceEmployee[];
  onSaved: () => void;
  /** The shop's rules, so the dialog can show what this day will actually pay. */
  settings: AttendanceSettings;
}

/**
 * Corrects or adds one day's check-in / check-out.
 *
 * Saving marks the record `manuallyEdited`, which stops the device feed from
 * overwriting the correction with the device's original (wrong or missing) punch.
 */
const RecordEditDialog: React.FC<RecordEditDialogProps> = ({
  open,
  onOpenChange,
  record,
  employees,
  onSaved,
  settings,
}) => {
  const isNew = !record;
  const [saving, setSaving] = useState(false);
  const [empCode, setEmpCode] = useState('');
  const [date, setDate] = useState(todayKey());
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [overriding, setOverriding] = useState(false);
  const [overrideHours, setOverrideHours] = useState('');

  useEffect(() => {
    if (!open) return;
    setEmpCode(record?.empCode || employees[0]?.empCode || '');
    setDate(record?.date || todayKey());
    setCheckIn(record?.checkIn || '');
    setCheckOut(record?.checkOut || '');
    const existing = record?.overrideHours;
    setOverriding(typeof existing === 'number');
    setOverrideHours(typeof existing === 'number' ? String(existing) : '');
  }, [open, record, employees]);

  const previewHours = hoursBetween(checkIn, checkOut);

  /**
   * What this day will actually be paid, under the shop's current rules.
   *
   * Shown live because the times and the paid hours are not the same number — the break
   * comes off, and on a day with punches the real gaps do too. Without this the admin fixes
   * a check-out, sees "9 hrs", and is surprised by 8 on the payslip.
   */
  const paidPreview = paidHoursForDay(
    {
      checkIn,
      checkOut,
      hoursWorked: previewHours,
      punches: record?.punches,
      manuallyEdited: true,
      overrideHours: overriding ? Number(overrideHours) || 0 : undefined,
    },
    settings
  );

  /**
   * The periods the machine actually recorded, shown while the admin edits.
   *
   * Correcting a forgotten punch means deciding what the missing time was, and that is far
   * easier with the day's real shape in front of you than with two empty time boxes. It is
   * evidence, not an input — saving replaces it with the times typed above.
   */
  const machineDay = useMemo(
    () => ((record?.punches || []).length >= 2 ? buildDayTimeline(record!.punches!, settings) : null),
    [record, settings]
  );

  const handleSave = async () => {
    if (!empCode) {
      toast({ title: 'Select an employee', variant: 'destructive' });
      return;
    }
    if (!date) {
      toast({ title: 'Select a date', variant: 'destructive' });
      return;
    }
    if (!checkIn) {
      toast({ title: 'Check-in time is required', variant: 'destructive' });
      return;
    }

    const employee = employees.find((candidate) => candidate.empCode === empCode);

    setSaving(true);
    try {
      await saveRecordManually({
        empCode,
        employeeName: employee?.name || empCode,
        date,
        checkIn,
        checkOut: checkOut || undefined,
        // null clears a previous override; undefined would be ignored by the merge write.
        overrideHours: overriding ? Number(overrideHours) || 0 : null,
      });
      toast({ title: isNew ? 'Attendance added' : 'Attendance updated' });
      onSaved();
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add attendance' : 'Edit attendance'}</DialogTitle>
          <DialogDescription>
            Times are 24-hour. Once saved by hand, this day is protected from being
            overwritten by the next device sync.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="recordEmp">Employee</Label>
            <Select value={empCode} onValueChange={setEmpCode} disabled={!isNew}>
              <SelectTrigger id="recordEmp">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.empCode} value={employee.empCode}>
                    {employee.name} ({employee.empCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {employees.length === 0 && (
              <p className="text-xs text-amber-600">
                No employees yet. Add one from the Employees tab first.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recordDate">Date</Label>
            <Input
              id="recordDate"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={!isNew}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="checkIn">Check-in</Label>
              <Input
                id="checkIn"
                type="time"
                value={checkIn}
                onChange={(event) => setCheckIn(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkOut">Check-out</Label>
              <Input
                id="checkOut"
                type="time"
                value={checkOut}
                onChange={(event) => setCheckOut(event.target.value)}
              />
            </div>
          </div>

          {machineDay && (
            <div className="space-y-1.5 rounded-lg border border-dashed p-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                What the machine recorded
              </p>
              {machineDay.periods.map((period, index) => (
                <div
                  key={`${period.checkIn}-${index}`}
                  className="flex items-center justify-between font-mono text-xs"
                >
                  <span>
                    <span className="text-gray-400">{index + 1}.</span> {period.checkIn}{' '}
                    <span className="text-gray-400">→</span> {period.checkOut}
                  </span>
                  <span className="text-gray-500">{formatDuration(period.minutes)}</span>
                </div>
              ))}
              {machineDay.openCheckIn && (
                <div className="font-mono text-xs text-amber-700 dark:text-amber-400">
                  <span className="opacity-60">{machineDay.periods.length + 1}.</span>{' '}
                  {machineDay.openCheckIn} <span className="opacity-60">→</span> ? — never
                  checked out
                </div>
              )}
              {machineDay.assumed && (
                <p className="text-xs text-gray-500">
                  Repeat presses left an odd number of punches, so this day is read as one
                  stretch rather than split into periods.
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900/60">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Time on the premises</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {checkOut ? `${previewHours} hrs` : 'Not checked out yet'}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 pt-2 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">
                Paid hours <span className="text-xs">(after the break)</span>
              </span>
              <span className="font-semibold text-green-700 dark:text-green-400">
                {paidPreview} hrs
              </span>
            </div>
          </div>

          {/* The escape hatch. Everything above is a rule; this is the admin's judgement,
              and it beats every rule for this one day. */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label htmlFor="override" className="cursor-pointer">
                  Set the paid hours myself
                </Label>
                <p className="mt-0.5 text-xs text-gray-500">
                  For a day the rules get wrong — a full day agreed despite the punches, or a
                  half day off. Overrides everything above.
                </p>
              </div>
              <Switch id="override" checked={overriding} onCheckedChange={setOverriding} />
            </div>

            {overriding && (
              <div className="space-y-1 pt-1">
                <Label htmlFor="overrideHours">Paid hours for this day</Label>
                <Input
                  id="overrideHours"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="24"
                  step="0.25"
                  value={overrideHours}
                  onChange={(event) => setOverrideHours(event.target.value)}
                  placeholder="e.g. 8"
                />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  This day will pay {Number(overrideHours) || 0} hrs whatever the machine
                  recorded. Recorded in the activity log.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecordEditDialog;
