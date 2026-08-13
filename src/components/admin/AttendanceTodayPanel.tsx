import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Fingerprint,
  Loader2,
  ArrowRight,
  LogIn,
  LogOut,
  UserX,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  fetchAttendanceSettings,
  fetchEmployees,
  fetchRecords,
} from '@/utils/attendance/attendanceStore';
import { calculateSalary, formatCurrency, paidHoursForDay } from '@/utils/attendance/salaryCalc';
import { todayKey } from '@/utils/attendance/punchFolding';
import type {
  AttendanceEmployee,
  AttendanceRecord,
  AttendanceSettings,
} from '@/utils/attendance/types';
import { DEFAULT_ATTENDANCE_SETTINGS } from '@/utils/attendance/types';

interface Row {
  empCode: string;
  name: string;
  checkIn?: string;
  checkOut?: string;
  paidHours: number;
  dayPay: number;
  /** No record at all for today. */
  absent: boolean;
  /** Checked in but not yet out — still on the floor. */
  onFloor: boolean;
}

/** Turns 'HH:mm' into '9:05 am', which is how the shop talks about time. */
function prettyTime(value?: string): string {
  if (!value) return '—';
  const [hour, minute] = value.split(':').map(Number);
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? 'pm' : 'am';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/**
 * Today's attendance, at a glance, on the admin dashboard.
 *
 * Deliberately NOT the attendance page in miniature: no editing, no payroll, no device
 * management. The question this answers is the one the owner actually asks on walking in —
 * who is here, who has gone home, and who has not turned up. Everything else is one click
 * away on /attendance.
 *
 * Sundays (or whatever `weeklyOffDays` says) do not produce a wall of red "absent" badges;
 * on a shop holiday nobody is expected, so nobody is missing.
 */
const AttendanceTodayPanel: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<AttendanceEmployee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<AttendanceSettings>(DEFAULT_ATTENDANCE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  const today = todayKey();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [employeeList, dayRecords, shopSettings] = await Promise.all([
        fetchEmployees(),
        fetchRecords(today, today),
        fetchAttendanceSettings(),
      ]);
      setEmployees(employeeList);
      setRecords(dayRecords);
      setSettings(shopSettings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load attendance');
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  /** Is the shop even open today? A weekly off day has no absentees. */
  const isOffDay = useMemo(() => {
    const weekday = new Date(`${today}T12:00:00`).getDay();
    return (settings.weeklyOffDays || []).includes(weekday);
  }, [today, settings]);

  const rows = useMemo<Row[]>(() => {
    const byCode = new Map(records.map((record) => [record.empCode, record]));

    return employees
      .filter((employee) => employee.active !== false)
      .map((employee) => {
        const record = byCode.get(employee.empCode);
        const paidHours = record ? paidHoursForDay(record, settings) : 0;

        // One day is just a one-day period, so the same maths that produces the monthly
        // payslip produces today's figure — no second definition of what an hour is worth.
        const breakdown = calculateSalary(employee, records, today, today, settings);

        return {
          empCode: employee.empCode,
          name: employee.name || employee.empCode,
          checkIn: record?.checkIn,
          checkOut: record?.checkOut || undefined,
          paidHours,
          dayPay: breakdown.needsSetup ? 0 : breakdown.amount,
          absent: !record?.checkIn,
          onFloor: !!record?.checkIn && !record?.checkOut,
        };
      })
      .sort((a, b) => {
        // Present first, then still-on-the-floor above those who have left, then absentees.
        if (a.absent !== b.absent) return a.absent ? 1 : -1;
        if (a.onFloor !== b.onFloor) return a.onFloor ? -1 : 1;
        return (a.checkIn || '').localeCompare(b.checkIn || '');
      });
  }, [employees, records, settings, today]);

  const totals = useMemo(() => {
    const present = rows.filter((row) => !row.absent);
    return {
      present: present.length,
      onFloor: rows.filter((row) => row.onFloor).length,
      left: present.filter((row) => !row.onFloor).length,
      absent: isOffDay ? 0 : rows.filter((row) => row.absent).length,
      pay: present.reduce((sum, row) => sum + row.dayPay, 0),
    };
  }, [rows, isOffDay]);

  const visible = showAll ? rows : rows.slice(0, 5);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Fingerprint className="h-5 w-5 shrink-0 text-blue-600" />
              Attendance Today
            </CardTitle>
            <CardDescription className="mt-1">
              {new Date(`${today}T12:00:00`).toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              {isOffDay ? ' · shop holiday' : ''}
            </CardDescription>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" onClick={load} title="Refresh" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/attendance')}>
              Open
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading attendance…
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={load}>
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-gray-400" />
            <p className="font-medium text-gray-700 dark:text-gray-300">No employees yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Add them on the Attendance page to see who is in.
            </p>
          </div>
        ) : (
          <>
            {/* Counters. Four small tiles rather than a sentence, so the numbers can be
                read from across the room. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-2.5 dark:border-green-900 dark:bg-green-950/30">
                <p className="text-[0.65rem] uppercase tracking-wide text-green-700 dark:text-green-400">
                  Present
                </p>
                <p className="text-xl font-bold text-green-700 dark:text-green-400">
                  {totals.present}
                </p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 dark:border-blue-900 dark:bg-blue-950/30">
                <p className="text-[0.65rem] uppercase tracking-wide text-blue-700 dark:text-blue-400">
                  On the floor
                </p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
                  {totals.onFloor}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-[0.65rem] uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  Checked out
                </p>
                <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{totals.left}</p>
              </div>
              <div
                className={`rounded-lg border p-2.5 ${
                  totals.absent > 0
                    ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
                    : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
                }`}
              >
                <p
                  className={`text-[0.65rem] uppercase tracking-wide ${
                    totals.absent > 0
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Absent
                </p>
                <p
                  className={`text-xl font-bold ${
                    totals.absent > 0
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {totals.absent}
                </p>
              </div>
            </div>

            {totals.pay > 0 && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Wages earned today:{' '}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {formatCurrency(totals.pay)}
                </span>{' '}
                · paid out monthly from Payroll
              </p>
            )}

            <div className="mt-4 space-y-2">
              {visible.map((row) => (
                <div
                  key={row.empCode}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-2.5 dark:border-gray-800"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {row.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Code {row.empCode}
                      {!row.absent && row.paidHours > 0 ? ` · ${row.paidHours} hrs` : ''}
                    </p>
                  </div>

                  {row.absent ? (
                    <Badge
                      variant="outline"
                      className={
                        isOffDay
                          ? 'shrink-0 border-gray-300 text-gray-500'
                          : 'shrink-0 border-red-300 text-red-700 dark:text-red-400'
                      }
                    >
                      <UserX className="mr-1 h-3 w-3" />
                      {isOffDay ? 'Holiday' : 'Absent'}
                    </Badge>
                  ) : (
                    <div className="flex shrink-0 items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
                        <LogIn className="h-3.5 w-3.5" />
                        {prettyTime(row.checkIn)}
                      </span>
                      {row.onFloor ? (
                        <Badge className="bg-blue-600 hover:bg-blue-600">In</Badge>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                          <LogOut className="h-3.5 w-3.5" />
                          {prettyTime(row.checkOut)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {rows.length > 5 && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowAll((open) => !open)}
                >
                  {showAll ? 'Show less' : `Show all ${rows.length} employees`}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceTodayPanel;
