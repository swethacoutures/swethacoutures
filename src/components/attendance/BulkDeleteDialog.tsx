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
import { AlertTriangle } from 'lucide-react';

export type DeleteScope = 'filtered' | 'all';

interface BulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'attendance record' / 'raw punch' — used to build the sentences. */
  noun: string;
  nounPlural: string;
  /** How many rows the current search and filter leave visible. */
  filteredCount: number;
  /** How many rows exist in the loaded period, ignoring search and filter. */
  totalCount: number;
  /** Which period this covers, e.g. "August 2026" — states the blast radius plainly. */
  periodLabel: string;
  /** One line about what is NOT deleted, so nobody expects more than they get. */
  keptNote: string;
  onConfirm: (scope: DeleteScope) => Promise<void>;
}

const CONFIRM_WORD = 'DELETE';

/**
 * Confirmation for deleting a whole list at once.
 *
 * A plain `window.confirm` is what the single-row deletes use, and that is right for one
 * row. Wiping a month of attendance is a different thing: it is irreversible, it changes
 * what people get paid, and the muscle memory that dismisses confirm dialogs is exactly
 * what makes it dangerous. So this one states the count, names the period, and asks the
 * admin to type the word — small friction, in proportion to a mistake nobody can undo.
 */
const BulkDeleteDialog: React.FC<BulkDeleteDialogProps> = ({
  open,
  onOpenChange,
  noun,
  nounPlural,
  filteredCount,
  totalCount,
  periodLabel,
  keptNote,
  onConfirm,
}) => {
  const isFiltered = filteredCount !== totalCount;
  const [scope, setScope] = useState<DeleteScope>(isFiltered ? 'filtered' : 'all');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTyped('');
    setScope(isFiltered ? 'filtered' : 'all');
  }, [open, isFiltered]);

  const count = scope === 'filtered' ? filteredCount : totalCount;
  const armed = typed.trim().toUpperCase() === CONFIRM_WORD && count > 0;

  const handleConfirm = async () => {
    if (!armed) return;
    setBusy(true);
    try {
      await onConfirm(scope);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Delete {nounPlural}
          </DialogTitle>
          <DialogDescription>
            This cannot be undone. Deleted {nounPlural} are gone from the database — there is no
            recycle bin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isFiltered && (
            <div className="space-y-2">
              <Label>What to delete</Label>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setScope('filtered')}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    scope === 'filtered'
                      ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950/40'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    Only what is shown ({filteredCount})
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    Matches your current search and filter.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    scope === 'all'
                      ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950/40'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    Everything in {periodLabel} ({totalCount})
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    Ignores the search and filter above.
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              {count} {count === 1 ? noun : nounPlural} will be deleted
              {!isFiltered && ` from ${periodLabel}`}.
            </p>
            <p className="mt-1 text-xs text-red-700 dark:text-red-400">{keptNote}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-delete-confirm">
              Type <span className="font-mono font-semibold">{CONFIRM_WORD}</span> to confirm
            </Label>
            <Input
              id="bulk-delete-confirm"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!armed || busy}
            title={armed ? undefined : `Type ${CONFIRM_WORD} to enable`}
          >
            {busy ? 'Deleting…' : `Delete ${count}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkDeleteDialog;
