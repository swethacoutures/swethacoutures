import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Trash2, Fingerprint, Download, Link2, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { describeFootprint, purgeEmployee } from '@/utils/attendance/purgeEmployee';
import { requestNamesFromDevice } from '@/utils/attendance/deviceStore';
import { formatCurrency } from '@/utils/attendance/salaryCalc';
import type { AttendanceDevice, AttendanceEmployee, SalaryMode } from '@/utils/attendance/types';
import EmployeeSalaryDialog from './EmployeeSalaryDialog';

interface EmployeesTabProps {
  employees: AttendanceEmployee[];
  staffOptions: { id: string; name: string }[];
  loading: boolean;
  onChanged: () => void;
  /** Used to ask the terminal for the names behind the PINs. */
  devices: AttendanceDevice[];
}

const MODE_LABEL: Record<SalaryMode, string> = {
  monthly: 'Monthly',
  daily: 'Daily wage',
  hourly: 'Per hour',
};

const MODE_SUFFIX: Record<SalaryMode, string> = {
  monthly: '/month',
  daily: '/day',
  hourly: '/hour',
};

const EmployeesTab: React.FC<EmployeesTabProps> = ({
  devices,
  employees,
  staffOptions,
  loading,
  onChanged,
}) => {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fetchingNames, setFetchingNames] = useState(false);

  const staffById = useMemo(
    () => new Map(staffOptions.map((option) => [option.id, option.name])),
    [staffOptions]
  );

  /**
   * Anyone whose name is still just their PIN. Punches carry no name, so a new person
   * always lands here until the device is asked or an admin types one in.
   */
  const unnamed = employees.filter((employee) => !employee.name || employee.name === employee.empCode);

  const handleFetchNames = async () => {
    const device = devices.find((d) => d.status === 'approved');
    if (!device) {
      toast({
        title: 'No approved device',
        description: 'The terminal has to be connected and approved before it can be asked.',
        variant: 'destructive',
      });
      return;
    }

    setFetchingNames(true);
    try {
      const queued = await requestNamesFromDevice(device.sn, unnamed.map((e) => e.empCode));
      toast({
        title: `Asked the device for ${queued} name${queued === 1 ? '' : 's'}`,
        description:
          'It answers on its next check-in, usually within a minute. Names appear here automatically.',
      });
    } catch (error) {
      toast({
        title: 'Could not reach the device queue',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setFetchingNames(false);
    }
  };
  const [editing, setEditing] = useState<AttendanceEmployee | null>(null);

  const needsSetup = employees.filter((employee) => !employee.salaryMode || !employee.salaryAmount);

  /**
   * Removes the fingerprint identity and everything recorded under it.
   *
   * This used to keep the day records and punches "for history", which sounds careful and
   * was not: the code stayed occupied, the person kept appearing on the dashboard, and the
   * next employee given that number inherited their punches. A delete here now means gone.
   */
  const handleDelete = async (employee: AttendanceEmployee) => {
    const footprint = await describeFootprint({
      empCode: employee.empCode,
      name: employee.name,
    }).catch(() => null);

    const lines = footprint
      ? [
          footprint.records > 0 ? `• ${footprint.records} day record(s) of attendance` : null,
          footprint.punches > 0 ? `• ${footprint.punches} fingerprint punch(es)` : null,
          footprint.payments > 0 ? `• ${footprint.payments} recorded salary payment(s)` : null,
        ].filter(Boolean)
      : [];

    const accepted = await confirm({
      title: `Delete ${employee.name} from attendance?`,
      description:
        (lines.length > 0
          ? `This permanently removes:\n\n${lines.join('\n')}\n\n`
          : 'This permanently removes their fingerprint identity.\n\n') +
        `Device number ${employee.empCode} becomes free for someone else. This cannot be undone.`,
      confirmLabel: 'Delete everything',
      destructive: true,
    });

    if (!accepted) return;

    try {
      await purgeEmployee({
        empCode: employee.empCode,
        name: employee.name,
        staffId: employee.linkedStaffId,
      });
      toast({
        title: 'Employee removed',
        description: `${employee.name} and all their attendance data have been deleted.`,
      });
      onChanged();
    } catch (error) {
      toast({
        title: 'Could not remove',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {needsSetup.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {needsSetup.length} device number{needsSetup.length === 1 ? '' : 's'} not connected to an employee yet
          </p>
          <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
            Pay is set on the <b>Employees</b> page. Open the employee there and type this
            device number into <b>Fingerprint device number (S.No)</b> — they will connect
            automatically. Until then they count as ₹0 in payroll.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => navigate('/employees')}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Go to Employees
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {employees.length} employee{employees.length === 1 ? '' : 's'}
          {unnamed.length > 0 && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              · {unnamed.length} still showing as a number
            </span>
          )}
        </p>
        <div className="flex gap-2">
          {unnamed.length > 0 && (
            <Button variant="outline" onClick={handleFetchNames} disabled={fetchingNames}>
              <Download className="mr-2 h-4 w-4" />
              {fetchingNames ? 'Asking device…' : 'Get names from device'}
            </Button>
          )}
          {/*
            No "Add employee" here on purpose. A person arrives on this list one of two
            ways: they punch, or an admin types their device number on the Employees page.
            A third way to create one is a third place for the two lists to drift apart.
          */}
          <Button variant="outline" onClick={() => navigate('/employees')}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Set pay on Employees
          </Button>
        </div>
      </div>

      {/* Below `md` the six-column table becomes one card per employee. */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Pay basis</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Std hrs/day</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-gray-500">
                      Loading employees…
                    </TableCell>
                  </TableRow>
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <Fingerprint className="mx-auto mb-3 h-8 w-8 text-gray-400" />
                      <p className="font-medium text-gray-700 dark:text-gray-300">No employees yet</p>
                      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                        Anyone who gives a fingerprint on the device appears here automatically once
                        their punches sync. You can also add someone by hand.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((employee) => {
                    const unset = !employee.salaryMode || !employee.salaryAmount;
                    return (
                      <TableRow key={employee.empCode} className={employee.active === false ? 'opacity-50' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {employee.name}
                            </span>
                            {employee.active === false && (
                              <Badge variant="outline" className="text-xs">Inactive</Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            Code {employee.empCode}
                            {employee.department ? ` · ${employee.department}` : ''}
                          </div>
                          {/* The link is the whole point of this row existing alongside the
                              Employees page, so it is stated rather than left to be guessed. */}
                          <div className="mt-0.5 flex items-center gap-1 text-xs">
                            <Link2 className="h-3 w-3 shrink-0 text-gray-400" />
                            {staffById.get(employee.linkedStaffId || '') ? (
                              <span className="text-green-700 dark:text-green-400">
                                {staffById.get(employee.linkedStaffId || '')}
                              </span>
                            ) : (
                              <span className="text-gray-400">Not linked to a staff member</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {/* Read-only: mirrored from the employee's record on the
                              Employees page, which is the only place it can be changed. */}
                          {unset ? (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                              Not connected
                            </Badge>
                          ) : (
                            MODE_LABEL[employee.salaryMode!]
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {unset
                            ? '—'
                            : `${formatCurrency(employee.salaryAmount)}${MODE_SUFFIX[employee.salaryMode!]}`}
                        </TableCell>
                        <TableCell>{employee.standardHoursPerDay ?? 8}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {employee.source === 'device' ? 'Fingerprint' : 'Manual'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Connect this device number to an employee"
                              onClick={() => {
                                setEditing(employee);
                                setDialogOpen(true);
                              }}
                            >
                              <Link2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(employee)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading employees…</p>
        ) : employees.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No employees yet.</p>
        ) : (
          employees.map((employee) => {
            const unset = !employee.salaryMode || !employee.salaryAmount;
            return (
              <Card
                key={employee.empCode}
                className={employee.active === false ? 'opacity-50' : ''}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
                        {employee.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Code {employee.empCode}
                        {employee.department ? ` · ${employee.department}` : ''}
                      </p>
                      <div className="mt-1 flex items-center gap-1 text-xs">
                        <Link2 className="h-3 w-3 shrink-0 text-gray-400" />
                        {staffById.get(employee.linkedStaffId || '') ? (
                          <span className="text-green-700 dark:text-green-400">
                            {staffById.get(employee.linkedStaffId || '')}
                          </span>
                        ) : (
                          <span className="text-gray-400">Not linked to a staff member</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Link ${employee.name}`}
                        onClick={() => {
                          setEditing(employee);
                          setDialogOpen(true);
                        }}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        aria-label={`Delete ${employee.name}`}
                        onClick={() => handleDelete(employee)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    {unset ? (
                      <Badge
                        variant="outline"
                        className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                      >
                        Not connected
                      </Badge>
                    ) : (
                      <span className="text-gray-600 dark:text-gray-400">
                        {MODE_LABEL[employee.salaryMode!]} ·{' '}
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(employee.salaryAmount)}
                          {MODE_SUFFIX[employee.salaryMode!]}
                        </span>
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {employee.standardHoursPerDay ?? 8} hrs/day
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">
                      {employee.source === 'device' ? 'Fingerprint' : 'Manual'}
                    </Badge>
                    {employee.active === false && (
                      <Badge variant="outline" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <EmployeeSalaryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editing}
        staffOptions={staffOptions}
        onSaved={onChanged}
      />
    </div>
  );
};

export default EmployeesTab;
