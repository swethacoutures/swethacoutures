/**
 * Paying an employee for a chosen stretch of days.
 *
 * Everything the admin needs to decide an amount is on screen at once and recomputes as the
 * dates change: what the attendance says they earned, what has already been settled inside
 * that range, and what is therefore still owed. The amount box starts at the outstanding
 * figure and is editable, which is the whole feature — a part payment now, the balance
 * later, and both on the record.
 */
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { calculateSalary, formatCurrency, toDateKey } from '@/utils/attendance/salaryCalc';
import { recordSettlement, settledInRange, type SalarySettlement } from '@/utils/attendance/settlementStore';
import type {
  AttendanceEmployee,
  AttendanceRecord,
  AttendanceSettings,
} from '@/utils/attendance/types';

interface SettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: AttendanceEmployee | null;
  records: AttendanceRecord[];
  settlements: SalarySettlement[];
  settings: AttendanceSettings;
  paidBy: string;
  onSaved: () => void;
  /** Asks the page to make sure records covering this range are loaded. */
  onNeedRange?: (start: string, end: string) => void;
}

/** First day of the month a date key falls in. */
function startOfMonth(dateKey: string): string {
  const [year, month] = dateKey.split('-').map(Number);
  return toDateKey(new Date(year, (month || 1) - 1, 1));
}

const SettlementDialog: React.FC<SettlementDialogProps> = ({
  open,
  onOpenChange,
  employee,
  records,
  settlements,
  settings,
  paidBy,
  onSaved,
  onNeedRange,
}) => {
  const today = toDateKey(new Date());
  const [periodStart, setPeriodStart] = useState(startOfMonth(today));
  const [periodEnd, setPeriodEnd] = useState(today);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  /** True once the admin types in the amount box, so recalculating stops overwriting them. */
  const [amountTouched, setAmountTouched] = useState(false);

  // Opening the dialog starts a fresh settlement: this month so far, nothing typed yet.
  useEffect(() => {
    if (!open) return;
    setPeriodStart(startOfMonth(today));
    setPeriodEnd(today);
    setNote('');
    setAmountTouched(false);
  }, [open, today]);

  useEffect(() => {
    if (open && periodStart && periodEnd) onNeedRange?.(periodStart, periodEnd);
  }, [open, periodStart, periodEnd, onNeedRange]);

  const invalidRange = !periodStart || !periodEnd || periodEnd < periodStart;

  const summary = useMemo(() => {
    if (!employee || invalidRange) {
      return { earned: 0, alreadyPaid: 0, outstanding: 0, daysWorked: 0, paidHours: 0, formula: '' };
    }

    const breakdown = calculateSalary(employee, records, periodStart, periodEnd, settings);
    const alreadyPaid = settledInRange(settlements, employee.empCode, periodStart, periodEnd);
    const outstanding = Math.round((breakdown.amount - alreadyPaid) * 100) / 100;

    return {
      earned: breakdown.amount,
      alreadyPaid,
      outstanding,
      daysWorked: breakdown.daysWorked,
      paidHours: breakdown.paidHours,
      formula: breakdown.formula,
    };
  }, [employee, records, settlements, periodStart, periodEnd, settings, invalidRange]);

  // Keep the amount box on the outstanding figure until the admin overrides it themselves.
  useEffect(() => {
    if (!amountTouched) setAmount(summary.outstanding > 0 ? String(summary.outstanding) : '0');
  }, [summary.outstanding, amountTouched]);

  const typedAmount = Number(amount) || 0;
  const isPartial = typedAmount > 0 && typedAmount < summary.outstanding;
  const overpaying = typedAmount > summary.outstanding;

  const handleSave = async () => {
    if (!employee) return;
    if (invalidRange) {
      toast({ title: 'Check the dates', description: 'The end date is before the start date.', variant: 'destructive' });
      return;
    }
    if (typedAmount <= 0) {
      toast({ title: 'Enter an amount', description: 'A settlement has to be more than ₹0.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await recordSettlement({
        empCode: employee.empCode,
        employeeName: employee.name,
        periodStart,
        periodEnd,
        earned: summary.earned,
        amount: typedAmount,
        daysWorked: summary.daysWorked,
        paidHours: summary.paidHours,
        salaryMode: employee.salaryMode,
        note: note.trim(),
        paidBy,
      });
      toast({
        title: 'Settlement recorded',
        description: `${formatCurrency(typedAmount)} to ${employee.name}.`,
      });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Could not record the settlement',
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
          <DialogTitle>Settle {employee?.name || 'employee'}</DialogTitle>
          <DialogDescription>
            Pay for a chosen stretch of days — all of it, or part of it now and the rest later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settleFrom">From</Label>
              <Input
                id="settleFrom"
                type="date"
                value={periodStart}
                max={periodEnd || undefined}
                onChange={(event) => setPeriodStart(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settleTo">To</Label>
              <Input
                id="settleTo"
                type="date"
                value={periodEnd}
                min={periodStart || undefined}
                onChange={(event) => setPeriodEnd(event.target.value)}
              />
            </div>
          </div>

          {invalidRange ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              The end date is before the start date.
            </p>
          ) : (
            <div className="space-y-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900/60">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Earned ({summary.daysWorked} day{summary.daysWorked === 1 ? '' : 's'} ·{' '}
                  {summary.paidHours} hrs)
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(summary.earned)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Already settled</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  −{formatCurrency(summary.alreadyPaid)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 pt-2 dark:border-gray-700">
                <span className="font-medium text-gray-700 dark:text-gray-300">Still owed</span>
                <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(summary.outstanding)}
                </span>
              </div>
              {summary.formula && (
                <p className="pt-1 text-xs text-gray-500 dark:text-gray-500">{summary.formula}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="settleAmount">Amount to pay now (₹)</Label>
            <Input
              id="settleAmount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => {
                setAmountTouched(true);
                setAmount(event.target.value);
              }}
            />
            {isPartial && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Part payment. {formatCurrency(summary.outstanding - typedAmount)} will still be
                owed for these dates.
              </p>
            )}
            {overpaying && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                This is {formatCurrency(typedAmount - summary.outstanding)} more than the
                outstanding amount — recorded as paid anyway if that is deliberate.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settleNote">Note (optional)</Label>
            <Textarea
              id="settleNote"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. weekly settlement, advance, paid by UPI"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || invalidRange}>
            {saving ? 'Recording…' : `Pay ${formatCurrency(typedAmount)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettlementDialog;
