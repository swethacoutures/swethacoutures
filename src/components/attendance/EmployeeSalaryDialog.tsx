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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { linkEmployeeToStaff, saveEmployee } from '@/utils/attendance/attendanceStore';
import type { AttendanceEmployee } from '@/utils/attendance/types';

interface EmployeeSalaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: AttendanceEmployee | null;
  staffOptions: { id: string; name: string }[];
  onSaved: () => void;
}

/**
 * Joins a person the fingerprint device has seen to their record on the Employees page.
 *
 * **Pay is deliberately not editable here.** It is decided once, on the Employees page,
 * alongside the rest of the employee's details. Two places to set a salary is two places for
 * them to disagree, and the one that disagrees quietly is the one that pays somebody the
 * wrong amount at the end of the month. Everything this dialog changes is identity: which
 * employee this device number belongs to, what they are called on the attendance lists, and
 * whether they still work here.
 *
 * In normal use nobody opens this at all — typing the device number on the Employees page
 * links the two sides by itself. This is the fallback for when that was not done, or when
 * somebody was enrolled on the machine before they existed in the system.
 */
const EmployeeSalaryDialog: React.FC<EmployeeSalaryDialogProps> = ({
  open,
  onOpenChange,
  employee,
  staffOptions,
  onSaved,
}) => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [linkedStaffId, setLinkedStaffId] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(employee?.name || '');
    setActive(employee?.active ?? true);
    setLinkedStaffId(employee?.linkedStaffId || '');
  }, [open, employee]);

  if (!employee) return null;

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await saveEmployee(employee.empCode, { name: trimmedName, active }, { audit: true });

      /*
       * The link is written on BOTH sides — `attendanceEmployees.linkedStaffId` here and
       * `staff.attendanceEmpCode` over there. The matcher checks the staff side first, so
       * writing only this one would leave a link that silently loses to a name match.
       */
      await linkEmployeeToStaff(employee.empCode, linkedStaffId);

      toast({
        title: linkedStaffId ? 'Linked' : 'Saved',
        description: linkedStaffId
          ? 'Their pay now comes from that employee record.'
          : undefined,
      });
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
          <DialogTitle>Device number {employee.empCode}</DialogTitle>
          <DialogDescription>
            Connect this fingerprint number to an employee. Pay is set on the Employees page,
            not here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="linkedStaff">Employee</Label>
            <Select
              value={linkedStaffId || 'none'}
              onValueChange={(value) => setLinkedStaffId(value === 'none' ? '' : value)}
            >
              <SelectTrigger id="linkedStaff">
                <SelectValue placeholder="Not linked" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not linked</SelectItem>
                {staffOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Their pay basis and rate come from that employee's record. You normally never
              need this — typing the device number on the Employees page links them for you.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="empName">Name shown on attendance</Label>
            <Input
              id="empName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Employee name"
            />
            <p className="text-xs text-gray-500">
              Just a label for the records and punch lists. A name entered here is never
              overwritten by the device.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="active" className="cursor-pointer">Active</Label>
              <p className="text-xs text-gray-500">Inactive employees are hidden from payroll.</p>
            </div>
            <Switch id="active" checked={active} onCheckedChange={setActive} />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => navigate('/employees')}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Set pay on the Employees page
          </Button>
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

export default EmployeeSalaryDialog;
