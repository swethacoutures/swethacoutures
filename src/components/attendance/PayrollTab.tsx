import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Check, Undo2, Download, Wallet, Settings2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { fetchPayments, markPaid, undoPayment } from '@/utils/attendance/attendanceStore';
import {
  calculateSalary,
  formatCurrency,
  formatMonthLabel,
  monthBounds,
  toMonthKey,
} from '@/utils/attendance/salaryCalc';
import type {
  AttendanceEmployee,
  AttendanceRecord,
  AttendanceSettings,
  SalaryPayment,
} from '@/utils/attendance/types';

interface PayrollTabProps {
  employees: AttendanceEmployee[];
  /** All records available to the page; this tab filters to the selected month itself. */
  allRecords: AttendanceRecord[];
  /** Asks the page to load records covering the given range. */
  onNeedRange: (start: string, end: string) => void;
  /** Shop-wide working rules — the basis of every hourly rate below. */
  settings: AttendanceSettings;
  onEditSettings: () => void;
}

function shiftMonth(periodKey: string, delta: number): string {
  const [year, month] = periodKey.split('-').map(Number);
  return toMonthKey(new Date(year, month - 1 + delta, 1));
}

const PayrollTab: React.FC<PayrollTabProps> = ({
  employees,
  allRecords,
  onNeedRange,
  settings,
  onEditSettings,
}) => {
  const { userData } = useAuth();
  const [periodKey, setPeriodKey] = useState(() => toMonthKey(new Date()));
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const { start, end } = useMemo(() => monthBounds(periodKey), [periodKey]);

  const loadPayments = useCallback(async () => {
    try {
      setPayments(await fetchPayments(periodKey));
    } catch (error) {
      toast({
        title: 'Could not load payments',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [periodKey]);

  useEffect(() => {
    loadPayments();
    onNeedRange(start, end);
  }, [loadPayments, onNeedRange, start, end]);

  const paymentByCode = useMemo(() => {
    const map = new Map<string, SalaryPayment>();
    payments.forEach((payment) => map.set(payment.empCode, payment));
    return map;
  }, [payments]);

  const rows = useMemo(
    () =>
      employees
        .filter((employee) => employee.active !== false)
        .map((employee) => ({
          employee,
          breakdown: calculateSalary(employee, allRecords, start, end, settings),
          payment: paymentByCode.get(employee.empCode),
        })),
    [employees, allRecords, start, end, paymentByCode, settings]
  );

  /**
   * Everyone who worked past their standard day this month.
   *
   * The shop's request, in the owner's words: "if it goes beyond their work hours show the
   * message to the admin that this many hours they did overtime, can you pay for that."
   * The hours are already inside the salary at the normal rate — this is the message that
   * makes them visible, so paying is a decision rather than an accident.
   */
  const overtime = useMemo(() => {
    const people = rows
      .filter((row) => row.breakdown.overtimeHours > 0)
      .map((row) => ({
        name: row.employee.name,
        hours: row.breakdown.overtimeHours,
        days: row.breakdown.overtimeDays,
        pay: row.breakdown.overtimePay,
        mode: row.employee.salaryMode,
      }));

    return {
      people,
      hours: Math.round(people.reduce((sum, person) => sum + person.hours, 0) * 100) / 100,
      pay: Math.round(people.reduce((sum, person) => sum + person.pay, 0) * 100) / 100,
    };
  }, [rows]);

  const totals = useMemo(() => {
    const payable = rows.reduce((sum, row) => sum + row.breakdown.amount, 0);
    const paid = rows.reduce(
      (sum, row) => sum + (row.payment?.status === 'paid' ? row.payment.amount : 0),
      0
    );
    return { payable, paid, pending: payable - paid };
  }, [rows]);

  const handleMarkPaid = async (row: (typeof rows)[number]) => {
    if (row.breakdown.needsSetup) {
      toast({
        title: 'Set a salary first',
        description: `${row.employee.name} has no pay basis configured.`,
        variant: 'destructive',
      });
      return;
    }

    // Zero is a real answer for someone who did not turn up, but it is also what a broken
    // link or a missing month of records looks like. Worth one question before recording it.
    if (
      row.breakdown.amount <= 0 &&
      !window.confirm(
        `${row.employee.name} works out to ₹0 for ${formatMonthLabel(periodKey)} — ` +
          `${row.breakdown.daysWorked} day(s) present.\n\nRecord a ₹0 payment anyway?`
      )
    ) {
      return;
    }

    setBusyCode(row.employee.empCode);
    try {
      await markPaid({
        empCode: row.employee.empCode,
        employeeName: row.employee.name,
        periodKey,
        periodStart: start,
        periodEnd: end,
        amount: row.breakdown.amount,
        daysWorked: row.breakdown.daysWorked,
        hoursWorked: row.breakdown.hoursWorked,
        salaryMode: row.employee.salaryMode,
        paidBy: userData?.name || userData?.email || 'admin',
      });
      toast({
        title: 'Marked as paid',
        description: `${row.employee.name} — ${formatCurrency(row.breakdown.amount)}`,
      });
      await loadPayments();
    } catch (error) {
      toast({
        title: 'Could not mark paid',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusyCode(null);
    }
  };

  const handleUndo = async (row: (typeof rows)[number]) => {
    if (
      !window.confirm(
        `Undo the ${formatMonthLabel(periodKey)} payment for ${row.employee.name}?\n\n` +
          `They will show as payable again. The original payment stays on the record as ` +
          `reverted, and the change is written to the activity log.`
      )
    ) {
      return;
    }

    setBusyCode(row.employee.empCode);
    try {
      await undoPayment(row.employee.empCode, periodKey, userData?.name || userData?.email || 'admin');

      /**
       * Flip the row locally before re-reading.
       *
       * Firestore serves this read from its own cache a beat after the write lands, and on
       * a slow connection the row would otherwise sit there still saying "Paid" — which
       * reads exactly like the undo having failed, and invites a second click.
       */
      setPayments((current) =>
        current.map((payment) =>
          payment.empCode === row.employee.empCode
            ? { ...payment, status: 'reverted' as const }
            : payment
        )
      );

      toast({ title: 'Payment undone', description: `${row.employee.name} is payable again.` });
      await loadPayments();
    } catch (error) {
      toast({
        title: 'Could not undo',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      // The optimistic flip must not survive a failure, or the table would lie.
      await loadPayments();
    } finally {
      setBusyCode(null);
    }
  };

  const handleExport = async () => {
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', variant: 'destructive' });
      return;
    }
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.json_to_sheet(
      rows.map((row) => ({
        Code: row.employee.empCode,
        Employee: row.employee.name,
        'Pay basis': row.employee.salaryMode || 'not set',
        Rate: row.employee.salaryAmount || 0,
        'Days worked': row.breakdown.daysWorked,
        'Hours (raw)': row.breakdown.hoursWorked,
        'Hours (paid)': row.breakdown.paidHours,
        'Overtime hours': row.breakdown.overtimeHours,
        'Overtime days': row.breakdown.overtimeDays,
        'Overtime value': row.breakdown.overtimePay,
        'Expected hours': row.breakdown.expectedHours,
        'Hourly rate': row.breakdown.hourlyRate,
        Salary: row.breakdown.amount,
        Status: row.payment?.status === 'paid' ? 'Paid' : 'Pending',
        'Paid on': row.payment?.status === 'paid' ? row.payment.paidAt : '',
      }))
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Payroll');
    XLSX.writeFile(book, `payroll-${periodKey}.xlsx`);
    toast({ title: 'Payroll exported' });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setPeriodKey(shiftMonth(periodKey, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[10rem] text-center text-base font-semibold text-gray-900 dark:text-gray-100">
            {formatMonthLabel(periodKey)}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPeriodKey(shiftMonth(periodKey, 1))}
            disabled={periodKey >= toMonthKey(new Date())}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onEditSettings}>
            <Settings2 className="mr-2 h-4 w-4" />
            Working rules
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Total payable</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(totals.payable)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Paid</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(totals.paid)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(totals.pending)}
            </p>
          </CardContent>
        </Card>
      </div>

      {overtime.people.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {overtime.hours} hour{overtime.hours === 1 ? '' : 's'} of overtime this month
            {overtime.people.length > 1 ? ` — ${overtime.people.length} employees` : ''}
          </p>
          <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
            These are hours worked beyond each person's standard day. They are{' '}
            <b>already included in the salary below</b>, paid at their normal hourly rate
            ({formatCurrency(overtime.pay)} in total). To pay a different rate, or not to pay
            them at all, open the day on <b>Records</b> and set the paid hours by hand.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {overtime.people.map((person) => (
              <li
                key={person.name}
                className="flex flex-wrap items-baseline gap-x-2 text-xs text-amber-900 dark:text-amber-200"
              >
                <span className="font-semibold">{person.name}</span>
                <span>
                  {person.hours} hr over {person.days} day{person.days === 1 ? '' : 's'}
                </span>
                <span className="opacity-80">
                  {person.mode === 'daily'
                    ? '· flat daily wage, nothing extra is added'
                    : `· worth ${formatCurrency(person.pay)}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead className="text-right">Hours worked</TableHead>
                  <TableHead className="text-right">Overtime</TableHead>
                  <TableHead className="text-right">Rate/hr</TableHead>
                  <TableHead className="hidden lg:table-cell">Calculation</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead className="text-right">Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <Wallet className="mx-auto mb-3 h-8 w-8 text-gray-400" />
                      <p className="font-medium text-gray-700 dark:text-gray-300">No active employees</p>
                      <p className="mt-1 text-sm text-gray-500">
                        Employees appear here once they exist in the Employees tab.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const isPaid = row.payment?.status === 'paid';
                    const busy = busyCode === row.employee.empCode;
                    return (
                      <TableRow key={row.employee.empCode}>
                        <TableCell>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {row.employee.name}
                          </div>
                          <div className="text-xs text-gray-500">Code {row.employee.empCode}</div>
                        </TableCell>
                        <TableCell className="text-right">{row.breakdown.daysWorked}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">{row.breakdown.paidHours}</span>
                          <span className="text-xs text-gray-500"> / {row.breakdown.expectedHours}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.breakdown.overtimeHours > 0 ? (
                            <span
                              className="font-medium text-amber-700 dark:text-amber-400"
                              title={`Over ${row.breakdown.overtimeDays} day(s), beyond a ${
                                row.employee.standardHoursPerDay || settings.standardHoursPerDay
                              }h day`}
                            >
                              +{row.breakdown.overtimeHours}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs text-gray-600 dark:text-gray-400">
                          {row.breakdown.hourlyRate ? formatCurrency(row.breakdown.hourlyRate) : '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {row.breakdown.formula}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {row.breakdown.needsSetup ? (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                              Needs setup
                            </Badge>
                          ) : (
                            formatCurrency(row.breakdown.amount)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isPaid ? (
                            <div className="flex items-center justify-end gap-2">
                              <Badge className="bg-green-600 hover:bg-green-600">
                                <Check className="mr-1 h-3 w-3" />
                                Paid {formatCurrency(row.payment!.amount)}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => handleUndo(row)}
                                title="Undo this payment"
                                aria-label={`Undo payment for ${row.employee.name}`}
                              >
                                <Undo2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <Button
                                size="sm"
                                disabled={busy || row.breakdown.needsSetup}
                                onClick={() => handleMarkPaid(row)}
                              >
                                {busy ? 'Saving…' : 'Mark paid'}
                              </Button>
                              {/* Says the undo worked, and leaves the accidental click visible
                                  instead of quietly pretending it never happened. */}
                              {row.payment?.status === 'reverted' && (
                                <span className="text-[0.68rem] text-amber-600 dark:text-amber-400">
                                  Undone — was {formatCurrency(row.payment.amount || 0)}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-gray-500">
        Monthly salaries are paid by the hour: salary ÷ (working days × {settings.standardHoursPerDay} hrs)
        gives the rate, and pay follows the hours actually worked — so arriving late and staying on
        still earns a full day, and hours beyond a full month are paid at the same rate as
        overtime. Time away from the shop comes off only when it lasted{' '}
        {settings.minBreakMinutes} minutes or more; on a day with no lunch punch,{' '}
        {settings.breakMinutes} minutes are deducted instead. "Hours worked" shows paid hours
        against a full month.
      </p>
    </div>
  );
};

export default PayrollTab;
