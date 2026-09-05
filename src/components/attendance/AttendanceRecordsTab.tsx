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
import { Pencil, Plus, Trash2, Search, LogIn, LogOut, Clock, Wallet } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { deleteRecord, deleteRecords } from '@/utils/attendance/attendanceStore';
import type {
  AttendanceEmployee,
  AttendanceRecord,
  AttendanceSettings,
} from '@/utils/attendance/types';
import RecordEditDialog from './RecordEditDialog';
import BulkDeleteDialog, { type DeleteScope } from './BulkDeleteDialog';
import { buildDayTimeline, type WorkPeriod } from '@/utils/attendance/punchSessions';
import { paidHoursForDay } from '@/utils/attendance/salaryCalc';

interface AttendanceRecordsTabProps {
  records: AttendanceRecord[];
  employees: AttendanceEmployee[];
  loading: boolean;
  onChanged: () => void;
  /** The range these records were loaded for, named for the delete confirmation. */
  periodLabel: string;
  /** Shop rules, so the edit dialog can preview what a day will pay. */
  settings: AttendanceSettings;
}

/** '2026-08-06' -> '06 Aug 2026' */
function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year) return dateKey;
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const AttendanceRecordsTab: React.FC<AttendanceRecordsTabProps> = ({
  records,
  employees,
  loading,
  onChanged,
  periodLabel,
  settings,
}) => {
  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      if (employeeFilter !== 'all' && record.empCode !== employeeFilter) return false;
      if (!term) return true;
      return (
        (record.employeeName || '').toLowerCase().includes(term) ||
        record.empCode.toLowerCase().includes(term) ||
        record.date.includes(term)
      );
    });
  }, [records, search, employeeFilter]);

  /**
   * Each row with its day read as periods.
   *
   * An admin's correction — a fixed time or an outright hours override — replaces the
   * punches entirely, so those rows show the times the admin set rather than the periods
   * the machine originally recorded. Anything else is the punches, read exactly the way
   * payroll reads them.
   */
  const rows = useMemo(
    () =>
      filtered.map((record) => {
        const paidHours = paidHoursForDay(record, settings);
        const corrected = typeof record.overrideHours === 'number' || !!record.manuallyEdited;

        if (corrected || (record.punches || []).length < 2) {
          const periods: WorkPeriod[] =
            record.checkIn && record.checkOut
              ? [{ checkIn: record.checkIn, checkOut: record.checkOut, minutes: 0 }]
              : [];
          return {
            record,
            paidHours,
            periods,
            openCheckIn: record.checkIn && !record.checkOut ? record.checkIn : undefined,
            assumed: false,
          };
        }

        const timeline = buildDayTimeline(record.punches || [], settings);
        return {
          record,
          paidHours,
          periods: timeline.periods,
          openCheckIn: timeline.openCheckIn,
          assumed: timeline.assumed,
        };
      }),
    [filtered, settings]
  );

  const totals = useMemo(
    () => ({
      days: rows.filter((row) => !!row.record.checkIn).length,
      hours: Math.round(rows.reduce((sum, row) => sum + (row.record.hoursWorked || 0), 0) * 100) / 100,
      paid: Math.round(rows.reduce((sum, row) => sum + row.paidHours, 0) * 100) / 100,
      incomplete: rows.filter((row) => !!row.openCheckIn).length,
    }),
    [rows]
  );

  const handleDelete = async (record: AttendanceRecord) => {
    if (!window.confirm(`Delete attendance for ${record.employeeName} on ${formatDate(record.date)}?`)) {
      return;
    }
    try {
      await deleteRecord(record.id);
      toast({ title: 'Attendance deleted' });
      onChanged();
    } catch (error) {
      toast({
        title: 'Could not delete',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAll = async (scope: DeleteScope) => {
    const target = scope === 'filtered' ? filtered : records;
    try {
      const removed = await deleteRecords(
        target,
        scope === 'filtered' ? `filtered view, ${periodLabel}` : periodLabel
      );
      toast({
        title: `Deleted ${removed} record${removed === 1 ? '' : 's'}`,
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <LogIn className="h-5 w-5 shrink-0 text-green-600" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Days present</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totals.days}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 shrink-0 text-gray-400" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Time in the shop</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totals.hours}</p>
            </div>
          </CardContent>
        </Card>
        {/* The figure that becomes money, given the same weight on screen as it has on the
            payslip — reading "time in the shop" as pay is the mistake this tile prevents. */}
        <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CardContent className="flex items-center gap-3 p-4">
            <Wallet className="h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Paid hours</p>
              <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                {totals.paid}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <LogOut className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">No check-out</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totals.incomplete}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name, code or date"
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
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
          <Button
            variant="outline"
            onClick={() => setBulkOpen(true)}
            disabled={records.length === 0}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950/40"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete all
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Periods (check-in → check-out)</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">In the shop</TableHead>
                  <TableHead className="text-right">Paid hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-gray-500">
                      Loading attendance…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-gray-500">
                      No attendance records for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(({ record, paidHours, periods, openCheckIn, assumed }) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {record.employeeName}
                        </div>
                        <div className="text-xs text-gray-500">{record.empCode}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(record.date)}</TableCell>
                      {/* Every period on its own line. A one-period day reads exactly like
                          the old check-in / check-out pair; a day with a lunch break now
                          shows both halves instead of hiding them inside a single span. */}
                      <TableCell className="font-mono text-sm">
                        {periods.length === 0 && !openCheckIn ? (
                          '—'
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {periods.map((period, index) => (
                              <div key={`${period.checkIn}-${index}`} className="whitespace-nowrap">
                                <span className="text-gray-400">{index + 1}.</span>{' '}
                                {period.checkIn} <span className="text-gray-400">→</span>{' '}
                                {period.checkOut}
                              </div>
                            ))}
                            {openCheckIn && (
                              <div className="whitespace-nowrap text-amber-700 dark:text-amber-400">
                                <span className="opacity-60">{periods.length + 1}.</span>{' '}
                                {openCheckIn} <span className="opacity-60">→</span> ?
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-right text-gray-500 sm:table-cell">
                        {record.hoursWorked ? record.hoursWorked.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                        {paidHours ? paidHours.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {assumed && (
                            <Badge
                              variant="outline"
                              className="border-gray-300 text-xs text-gray-500"
                              title="Repeat presses left an odd number of punches, so this day is read as one stretch rather than split into periods."
                            >
                              Repeat presses
                            </Badge>
                          )}
                          {openCheckIn || record.status === 'incomplete' ? (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                              No check-out
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300">
                              Present
                            </Badge>
                          )}
                          {record.manuallyEdited && (
                            <Badge variant="outline" className="text-xs">Manual</Badge>
                          )}
                          {/* An override changes the money, so it says so on the row rather
                              than hiding inside the edit dialog. */}
                          {typeof record.overrideHours === 'number' && (
                            <Badge
                              variant="outline"
                              className="border-amber-300 bg-amber-50 text-xs text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                              title="Paid hours were set by hand for this day"
                            >
                              Paid {record.overrideHours} hrs
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(record);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(record)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <RecordEditDialog
        settings={settings}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        record={editing}
        employees={employees}
        onSaved={onChanged}
      />

      <BulkDeleteDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        noun="attendance record"
        nounPlural="attendance records"
        filteredCount={filtered.length}
        totalCount={records.length}
        periodLabel={periodLabel}
        keptNote="Raw punches on the Punches tab are kept, so a deleted day can be rebuilt from them. Employees and salary payments are not touched."
        onConfirm={handleDeleteAll}
      />
    </div>
  );
};

export default AttendanceRecordsTab;
