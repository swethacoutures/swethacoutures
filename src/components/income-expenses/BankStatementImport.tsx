/**
 * Importing a bank statement as income and expense entries.
 *
 * The statement knows three things — the date, the amount, and which way the money went.
 * It does not know what the money was FOR, and that is exactly what the books need. So the
 * flow is: read the file, show every row, let the admin fill in the name and category, and
 * import only the rows they ticked.
 *
 * Credits become income, debits become expenses, and the payment mode defaults to Online
 * because a bank statement is by definition not cash.
 *
 * Every imported entry is stamped `importedFrom`, so a mis-imported batch can be found and
 * removed afterwards without guessing which rows came from where.
 */
import React, { useMemo, useRef, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, FileSpreadsheet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { parseBankStatement, type StatementRow } from '@/utils/bankStatement';

/** A statement row plus the details the admin fills in before it can be saved. */
interface DraftRow extends StatementRow {
  include: boolean;
  name: string;
  category: string;
  paymentMode: 'cash' | 'online';
}

interface BankStatementImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Reload the tabs once rows have landed. */
  onImported: () => void;
}

const BankStatementImport: React.FC<BankStatementImportProps> = ({
  open,
  onOpenChange,
  onImported,
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  /** Typed once at the top and applied to every row that has no category of its own. */
  const [bulkCategory, setBulkCategory] = useState('');

  const reset = () => {
    setFileName('');
    setRows([]);
    setSkipped(0);
    setError('');
    setBulkCategory('');
    if (fileInput.current) fileInput.current.value = '';
  };

  const handleFile = async (file: File) => {
    setError('');
    const result = parseBankStatement(await file.arrayBuffer(), file.name);

    if (result.error) {
      setError(result.error);
      setRows([]);
      return;
    }
    if (result.rows.length === 0) {
      setError('No transactions were found in that file.');
      setRows([]);
      return;
    }

    setFileName(file.name);
    setSkipped(result.skipped);
    setRows(
      result.rows.map((row) => ({
        ...row,
        include: true,
        // The bank's own narration is the best first guess at what this was.
        name: row.description || (row.direction === 'credit' ? 'Bank credit' : 'Bank debit'),
        category: '',
        paymentMode: 'online',
      }))
    );
  };

  const update = (id: string, patch: Partial<DraftRow>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const selected = useMemo(() => rows.filter((row) => row.include), [rows]);
  const totals = useMemo(
    () => ({
      credits: selected.filter((row) => row.direction === 'credit').length,
      debits: selected.filter((row) => row.direction === 'debit').length,
    }),
    [selected]
  );

  const handleImport = async () => {
    if (selected.length === 0) {
      toast({ title: 'Nothing selected', description: 'Tick at least one row.', variant: 'destructive' });
      return;
    }

    setImporting(true);
    /*
     * One batch id for the whole file, written onto every row.
     *
     * It is what makes a mistaken import undoable: the entries can be found and removed as
     * a group afterwards, rather than hunted down one at a time.
     */
    const batchId = `stmt_${Date.now()}`;

    try {
      let done = 0;
      for (const row of selected) {
        const category = (row.category || bulkCategory).trim();
        const shared = {
          category,
          amount: row.amount,
          date: Timestamp.fromDate(new Date(`${row.date}T00:00:00`)),
          notes: row.description ? `Bank statement: ${row.description}` : 'Imported from bank statement',
          paymentMode: row.paymentMode,
          cashAmount: row.paymentMode === 'cash' ? row.amount : 0,
          onlineAmount: row.paymentMode === 'online' ? row.amount : 0,
          importedFrom: fileName,
          importBatchId: batchId,
          createdAt: Timestamp.now(),
        };

        if (row.direction === 'credit') {
          await addDoc(collection(db, 'income'), { ...shared, sourceName: row.name.trim() });
        } else {
          await addDoc(collection(db, 'expenses'), { ...shared, expenseName: row.name.trim() });
        }
        done++;
      }

      toast({
        title: `Imported ${done} entr${done === 1 ? 'y' : 'ies'}`,
        description: 'They are marked as imported, so they can be found and removed together.',
      });
      onImported();
      reset();
      onOpenChange(false);
    } catch (importError) {
      toast({
        title: 'Import failed',
        description: importError instanceof Error ? importError.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Upload bank statement</DialogTitle>
          <DialogDescription>
            Credits become income, debits become expenses. Nothing is saved until you press
            Import.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="space-y-4 py-4">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-10 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-700 dark:hover:border-blue-600 dark:hover:bg-blue-950/20"
            >
              <FileSpreadsheet className="h-10 w-10 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Choose a statement file
              </span>
              <span className="text-xs text-gray-500">
                CSV, XLS or XLSX — exported from your bank
              </span>
            </button>

            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xls,.xlsx,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
              }}
            />

            {error && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
              The file needs a date column and either credit/debit columns or a single amount
              column. Most bank exports already do.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3 border-b border-gray-200 pb-3 dark:border-gray-800">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {fileName}
                </p>
                <p className="text-xs text-gray-500">
                  {rows.length} transaction{rows.length === 1 ? '' : 's'} ·{' '}
                  {totals.credits} income · {totals.debits} expense
                  {skipped > 0 ? ` · ${skipped} row(s) skipped` : ''}
                </p>
              </div>
              <div className="w-44">
                <Label htmlFor="bulkCategory" className="text-xs">
                  Category for all
                </Label>
                <Input
                  id="bulkCategory"
                  value={bulkCategory}
                  onChange={(event) => setBulkCategory(event.target.value)}
                  placeholder="e.g. Bank"
                  className="mt-1 h-8"
                />
              </div>
              <Button variant="outline" size="sm" onClick={reset}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Different file
              </Button>
            </div>

            {/* One editable card per transaction — readable on a phone as well as a laptop. */}
            <div className="-mx-1 flex-1 overflow-y-auto px-1 py-3">
              <div className="flex flex-col gap-2">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      row.include
                        ? 'border-gray-200 dark:border-gray-800'
                        : 'border-dashed border-gray-200 opacity-50 dark:border-gray-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={row.include}
                        onCheckedChange={(checked) => update(row.id, { include: checked === true })}
                        className="mt-1"
                        aria-label={`Include ${row.date} ${row.amount}`}
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              row.direction === 'credit'
                                ? 'border-green-300 bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300'
                                : 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                            }
                          >
                            {row.direction === 'credit' ? (
                              <ArrowDownLeft className="mr-1 h-3 w-3" />
                            ) : (
                              <ArrowUpRight className="mr-1 h-3 w-3" />
                            )}
                            {row.direction === 'credit' ? 'Income' : 'Expense'}
                          </Badge>
                          <span className="font-mono text-xs text-gray-500">{row.date}</span>
                          <span className="ml-auto font-semibold text-gray-900 dark:text-gray-100">
                            ₹{row.amount.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {row.description && (
                          <p className="truncate text-xs text-gray-500" title={row.description}>
                            {row.description}
                          </p>
                        )}

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <Input
                            value={row.name}
                            onChange={(event) => update(row.id, { name: event.target.value })}
                            placeholder={row.direction === 'credit' ? 'Source name' : 'Expense name'}
                            className="h-8 text-sm"
                          />
                          <Input
                            value={row.category}
                            onChange={(event) => update(row.id, { category: event.target.value })}
                            placeholder={bulkCategory || 'Category'}
                            className="h-8 text-sm"
                          />
                          <Select
                            value={row.paymentMode}
                            onValueChange={(value) =>
                              update(row.id, { paymentMode: value as 'cash' | 'online' })
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="online">Online (UPI/Card/Bank)</SelectItem>
                              <SelectItem value="cash">Cash</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <DialogFooter className="border-t border-gray-200 pt-3 dark:border-gray-800">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          {rows.length > 0 && (
            <Button onClick={handleImport} disabled={importing || selected.length === 0}>
              {importing
                ? 'Importing…'
                : `Import ${selected.length} entr${selected.length === 1 ? 'y' : 'ies'}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BankStatementImport;
