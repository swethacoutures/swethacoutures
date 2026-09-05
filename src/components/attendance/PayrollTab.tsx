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
import { ChevronLeft, ChevronRight, Undo2, Download, Wallet, Settings2, IndianRupee } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { fetchPayments } from '@/utils/attendance/attendanceStore';
import {
  fetchSettlements,
  revertSettlement,
  settledInRange,
  type SalarySettlement,
} from '@/utils/attendance/settlementStore';
import SettlementDialog from './SettlementDialog';
import { useConfirm } from '@/components/ui/confirm-dialog';
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
  const confirm = useConfirm();
  const [periodKey, setPeriodKey] = useState(() => toMonthKey(new Date()));
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [settlements, setSettlements] = useState<SalarySettlement[]>([]);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [settling, setSettling] = useState<AttendanceEmployee | null>(null);

  const { start, end } = useMemo(() => monthBounds(periodKey), [periodKey]);

  const loadPayments = useCallback(async () => {
    try {
      const [monthly, settled] = await Promise.all([
        fetchPayments(periodKey),
        fetchSettlements(),
      ]);
      setPayments(monthly);
      setSettlements(settled);
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
        .map((employee) => {
          const breakdown = calculateSalary(employee, allRecords, start, end, settings);
          /*
           * What has been settled INSIDE this month, from the settlement log. A legacy
           * whole-month payment from the old one-payment-per-month model still counts, so
           * months paid before settlements existed do not suddenly read as unpaid.
           */
          const legacy = paymentByCode.get(employee.empCode);
          const settled =
            settledInRange(settlements, employee.empCode, start, end) +
            (legacy?.status === 'paid' ? legacy.amount || 0 : 0);

          return {
            employee,
            breakdown,
            payment: legacy,
            settled: Math.round(settled * 100) / 100,
            outstanding: Math.round((breakdown.amount - settled) * 100) / 100,
          };
        }),
    [employees, allRecords, start, end, paymentByCode, settlements, settings]
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
    const paid = rows.reduce((sum, row) => sum + row.settled, 0);
    return { payable, paid, pending: payable - paid };
  }, [rows]);

  /** Undoes one settlement, after a styled confirmation rather than a browser box. */
  const handleUndoSettlement = async (settlement: SalarySettlement) => {
    const accepted = await confirm({
      title: `Undo this ${formatCurrency(settlement.amount)} settlement?`,
      description:
        `${settlement.employeeName}, ${settlement.periodStart} to ${settlement.periodEnd}.

` +
        'The amount becomes payable again. The original entry stays on the record marked ' +
        'as undone, and the change is written to the activity log.',
      confirmLabel: 'Undo settlement',
      destructive: true,
    });
    if (!accepted) return;

    setBusyCode(settlement.empCode);
    try {
      await revertSettlement(settlement, userData?.name || userData?.email || 'admin');

      /*
       * Flip it locally before re-reading. Firestore serves this read from its own cache a
       * beat after the write lands, and on a slow connection the row would otherwise still
       * say "paid" — which reads exactly like the undo having failed, and invites a second
       * click.
       */
      setSettlements((current) =>
        current.map((entry) =>
          entry.id === settlement.id ? { ...entry, status: 'reverted' as const } : entry
        )
      );

      toast({ title: 'Settlement undone', description: `${settlement.employeeName} is payable again.` });
      await loadPayments();
    } catch (error) {
      toast({
        title: 'Could not undo',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusyCode(null);
    }
  };

  /** Settlements that touch the month on screen, newest first. */
  const monthSettlements = useMemo(
    () =>
      settlements.filter((entry) => entry.periodStart <= end && entry.periodEnd >= start),
    [settlements, start, end]
  );

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

      {/* Below `md` the eight-column payroll table becomes one card per employee. */}
      <Card className="hidden md:block">
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
                          <div className="flex flex-col items-end gap-1">
                            <Button
                              size="sm"
                              disabled={busy || row.breakdown.needsSetup}
                              onClick={() => setSettling(row.employee)}
                            >
                              <IndianRupee className="mr-1 h-3.5 w-3.5" />
                              Settle
                            </Button>
                            {row.settled > 0 && (
                              <span className="text-[0.68rem] text-gray-500">
                                Paid {formatCurrency(row.settled)}
                              </span>
                            )}
                            {row.outstanding > 0.005 && row.settled > 0 && (
                              <span className="text-[0.68rem] font-medium text-amber-600 dark:text-amber-400">
                                {formatCurrency(row.outstanding)} left
                              </span>
                            )}
                          </div>
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

      <div className="flex flex-col gap-3 md:hidden">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No active employees.</p>
        ) : (
          rows.map((row) => (
            <Card key={row.employee.empCode}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
                      {row.employee.name}
                    </p>
                    <p className="text-xs text-gray-500">Code {row.employee.empCode}</p>
                  </div>
                  {row.breakdown.needsSetup ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                    >
                      Needs setup
                    </Badge>
                  ) : (
                    <span className="shrink-0 text-base font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrency(row.breakdown.amount)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Days</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {row.breakdown.daysWorked}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Hours</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {row.breakdown.paidHours}
                      <span className="text-gray-500"> / {row.breakdown.expectedHours}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Overtime</p>
                    <p className="font-medium text-amber-700 dark:text-amber-400">
                      {row.breakdown.overtimeHours > 0 ? `+${row.breakdown.overtimeHours}` : '—'}
                    </p>
                  </div>
                </div>

                {row.breakdown.formula && (
                  <p className="text-xs text-gray-500">{row.breakdown.formula}</p>
                )}

                <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                  <div className="text-xs">
                    {row.settled > 0 && (
                      <span className="text-gray-500">Paid {formatCurrency(row.settled)}</span>
                    )}
                    {row.outstanding > 0.005 && row.settled > 0 && (
                      <span className="ml-2 font-medium text-amber-600 dark:text-amber-400">
                        {formatCurrency(row.outstanding)} left
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={busyCode === row.employee.empCode || row.breakdown.needsSetup}
                    onClick={() => setSettling(row.employee)}
                  >
                    <IndianRupee className="mr-1 h-3.5 w-3.5" />
                    Settle
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Every settlement that touches this month — weekly payments, advances, the lot. */}
      {monthSettlements.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Settlements this period
            </p>
            <div className="flex flex-col gap-2">
              {monthSettlements.map((entry) => {
                const reverted = entry.status === 'reverted';
                return (
                  <div
                    key={entry.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${
                      reverted
                        ? 'border-dashed border-gray-300 opacity-70 dark:border-gray-700'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {entry.employeeName}
                        {reverted && (
                          <Badge variant="outline" className="ml-2 text-[0.65rem]">
                            Undone
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {entry.periodStart} → {entry.periodEnd}
                        {entry.amount < entry.earned ? ' · part payment' : ''}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          reverted
                            ? 'text-gray-400 line-through'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {formatCurrency(entry.amount)}
                      </span>
                      {!reverted && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyCode === entry.empCode}
                          onClick={() => handleUndoSettlement(entry)}
                          title="Undo this settlement"
                          aria-label={`Undo settlement for ${entry.employeeName}`}
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <SettlementDialog
        open={settling !== null}
        onOpenChange={(open) => !open && setSettling(null)}
        employee={settling}
        records={allRecords}
        settlements={settlements}
        settings={settings}
        paidBy={userData?.name || userData?.email || 'admin'}
        onNeedRange={onNeedRange}
        onSaved={loadPayments}
      />

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
