import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { History, RefreshCw, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { fetchActivity, type ActivityAction, type ActivityEntry } from '@/utils/activityLog';

const ACTION_STYLE: Record<ActivityAction, { label: string; className: string }> = {
  create: { label: 'Added', className: 'border-green-300 bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300' },
  edit: { label: 'Edited', className: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
  delete: { label: 'Deleted', className: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
  approve: { label: 'Approved', className: 'border-green-300 bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300' },
  block: { label: 'Blocked', className: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
  settings: { label: 'Settings', className: 'border-purple-300 bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300' },
  pay: { label: 'Paid', className: 'border-green-300 bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300' },
  'undo-pay': { label: 'Payment undone', className: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
};

const ENTITY_LABEL: Record<string, string> = {
  attendanceRecord: 'Attendance day',
  devicePunch: 'Punch',
  attendanceEmployee: 'Employee',
  device: 'Device',
  attendanceSettings: 'Working rules',
  salaryPayment: 'Salary payment',
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Renders a changed-field map as `checkIn 09:00 → 09:30`, which is what an audit needs. */
function ChangeDetail({ entry }: { entry: ActivityEntry }) {
  const keys = [...new Set([...Object.keys(entry.before || {}), ...Object.keys(entry.after || {})])]
    // Long arrays of raw punch times are noise in a one-line summary.
    .filter((key) => key !== 'punches')
    .slice(0, 4);

  if (keys.length === 0) return <span className="text-xs text-gray-400">—</span>;

  const show = (value: unknown) => {
    if (value === undefined || value === '' || value === null) return '—';
    if (typeof value === 'object') return JSON.stringify(value).slice(0, 40);
    return String(value);
  };

  return (
    <div className="space-y-0.5">
      {keys.map((key) => (
        <div key={key} className="text-xs">
          <span className="text-gray-500">{key}: </span>
          <span className="text-red-600 line-through dark:text-red-400">
            {show(entry.before?.[key])}
          </span>
          <span className="text-gray-400"> → </span>
          <span className="text-green-700 dark:text-green-400">{show(entry.after?.[key])}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Every hand-made change to attendance, newest first.
 *
 * Attendance decides pay and the admin can edit all of it, so this is what makes that
 * safe: an edit is fine, an untraceable edit is not. Entries are written by
 * `utils/activityLog.ts` and are never editable from the UI — a log you can rewrite
 * proves nothing.
 */
const ActivityLogTab: React.FC = () => {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      setEntries(await fetchActivity({ max: 300 }));
    } catch (error) {
      toast({
        title: 'Could not load the activity log',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (entityFilter !== 'all' && entry.entity !== entityFilter) return false;
      if (!term) return true;
      return (
        entry.summary.toLowerCase().includes(term) ||
        (entry.byName || '').toLowerCase().includes(term) ||
        entry.entityId.toLowerCase().includes(term)
      );
    });
  }, [entries, search, entityFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by what changed, or who changed it"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="sm:w-52">
            <SelectValue placeholder="Everything" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everything</SelectItem>
            {Object.entries(ENTITY_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-gray-500">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center">
                      <History className="mx-auto mb-3 h-8 w-8 text-gray-400" />
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        Nothing recorded yet
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Every edit, deletion and payment made by hand appears here.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((entry) => {
                    const style = ACTION_STYLE[entry.action] ?? {
                      label: entry.action,
                      className: 'border-gray-300 bg-gray-50 text-gray-700',
                    };
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatWhen(entry.at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm font-medium">
                          {entry.byName}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={style.className}>
                              {style.label}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {ENTITY_LABEL[entry.entity] || entry.entity}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                            {entry.summary}
                          </p>
                        </TableCell>
                        <TableCell>
                          <ChangeDetail entry={entry} />
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
        Showing the most recent 300 changes. Entries are written automatically and cannot be
        edited or removed from here — that is the point of keeping them.
      </p>
    </div>
  );
};

export default ActivityLogTab;
