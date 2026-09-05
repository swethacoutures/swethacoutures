/**
 * Reading a downloaded bank statement into reviewable rows.
 *
 * Banks do not agree on anything. The column may be called "Withdrawal", "Debit", "Dr" or
 * "Amount" with a sign; dates arrive as 05/09/2026, 2026-09-05, 5-Sep-26 or an Excel serial
 * number; and most exports carry two or three junk lines above the real header. So rather
 * than demanding one shape, this finds the header row by looking for the columns it needs
 * and reads whatever it can, leaving anything unparseable out.
 *
 * Nothing here writes to the database. It produces rows for the admin to look at, correct
 * and approve — the import is deliberately a review step, not a one-click merge.
 */
import * as XLSX from 'xlsx';

export type StatementDirection = 'credit' | 'debit';

export interface StatementRow {
  /** Stable within one parse, used as the React key and the selection id. */
  id: string;
  /** 'YYYY-MM-DD' */
  date: string;
  amount: number;
  direction: StatementDirection;
  /** Whatever the bank called the transaction, kept as a starting point for the name. */
  description: string;
}

/** Header spellings seen across Indian bank exports, lower-cased. */
const DATE_KEYS = ['date', 'txn date', 'transaction date', 'value date', 'posting date', 'tran date'];
const CREDIT_KEYS = ['credit', 'deposit', 'cr', 'deposits', 'credit amount', 'cr amount'];
const DEBIT_KEYS = ['debit', 'withdrawal', 'dr', 'withdrawals', 'debit amount', 'dr amount', 'withdrawal amt'];
const AMOUNT_KEYS = ['amount', 'transaction amount', 'txn amount', 'amt'];
const TYPE_KEYS = ['type', 'dr/cr', 'cr/dr', 'drcr', 'transaction type', 'debit/credit'];
const DESC_KEYS = ['description', 'narration', 'particulars', 'remarks', 'details', 'transaction details', 'narrative'];

const normalise = (value: unknown) => String(value ?? '').trim().toLowerCase();

/** Finds the index of the first cell whose text matches one of `keys`. */
function findColumn(header: unknown[], keys: string[]): number {
  return header.findIndex((cell) => {
    const text = normalise(cell);
    return text.length > 0 && keys.some((key) => text === key || text.includes(key));
  });
}

/**
 * Turns a cell into 'YYYY-MM-DD', or '' when it is not a date.
 *
 * Excel stores dates as a day count from 1899-12-30, so a numeric cell is converted through
 * that epoch. Text dates are read as day-first, which is what Indian statements use — the
 * ambiguity between 05/09 and 09/05 is real and unresolvable from one row, so the
 * convention has to be picked, and picked visibly.
 */
export function parseStatementDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toKey(value);
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + Math.round(value) * 86400000);
    return Number.isNaN(date.getTime()) ? '' : toKey(date);
  }

  const text = String(value ?? '').trim();
  if (!text) return '';

  // Already ISO.
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // 05/09/2026, 05-09-26, 5.9.2026 — day first.
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(text);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 5-Sep-2026 and friends.
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : toKey(parsed);
}

function toKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Strips currency symbols, thousands separators and stray brackets. */
function parseAmount(value: unknown): number {
  if (typeof value === 'number') return Math.abs(value);
  const text = String(value ?? '').replace(/[₹$,\s]/g, '').replace(/[()]/g, '');
  const amount = Number(text);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

export interface ParseResult {
  rows: StatementRow[];
  /** Rows the parser had to skip, so the admin is told rather than left to notice. */
  skipped: number;
  /** Set when the file could not be understood at all. */
  error?: string;
}

/**
 * Parses a CSV / XLS / XLSX statement.
 *
 * Looks for the header in the first 20 rows: exports routinely open with the account
 * holder's name, the branch and a blank line before the real columns start.
 */
export function parseBankStatement(data: ArrayBuffer, fileName: string): ParseResult {
  let sheet: unknown[][];
  try {
    const book = XLSX.read(data, { type: 'array', cellDates: true });
    const first = book.SheetNames[0];
    if (!first) return { rows: [], skipped: 0, error: 'That file has no sheets in it.' };
    sheet = XLSX.utils.sheet_to_json(book.Sheets[first], { header: 1, raw: true, defval: '' });
  } catch {
    return {
      rows: [],
      skipped: 0,
      error: `Could not read ${fileName}. Export the statement as CSV or Excel and try again.`,
    };
  }

  let headerIndex = -1;
  let columns = { date: -1, credit: -1, debit: -1, amount: -1, type: -1, description: -1 };

  for (let index = 0; index < Math.min(sheet.length, 20); index++) {
    const row = sheet[index] || [];
    const date = findColumn(row, DATE_KEYS);
    if (date === -1) continue;

    const credit = findColumn(row, CREDIT_KEYS);
    const debit = findColumn(row, DEBIT_KEYS);
    const amount = findColumn(row, AMOUNT_KEYS);
    // A usable header needs a date and at least one money column.
    if (credit === -1 && debit === -1 && amount === -1) continue;

    headerIndex = index;
    columns = {
      date,
      credit,
      debit,
      amount,
      type: findColumn(row, TYPE_KEYS),
      description: findColumn(row, DESC_KEYS),
    };
    break;
  }

  if (headerIndex === -1) {
    return {
      rows: [],
      skipped: 0,
      error:
        'Could not find the columns. The statement needs a date column and either ' +
        'credit/debit columns or an amount column.',
    };
  }

  const rows: StatementRow[] = [];
  let skipped = 0;

  for (let index = headerIndex + 1; index < sheet.length; index++) {
    const row = sheet[index] || [];
    if (row.every((cell) => String(cell ?? '').trim() === '')) continue;

    const date = parseStatementDate(row[columns.date]);
    if (!date) {
      skipped++;
      continue;
    }

    const credit = columns.credit >= 0 ? parseAmount(row[columns.credit]) : 0;
    const debit = columns.debit >= 0 ? parseAmount(row[columns.debit]) : 0;

    let amount = 0;
    let direction: StatementDirection;

    if (credit > 0 || debit > 0) {
      // Separate columns: whichever is filled decides the direction.
      direction = credit > 0 ? 'credit' : 'debit';
      amount = credit > 0 ? credit : debit;
    } else if (columns.amount >= 0) {
      const raw = row[columns.amount];
      amount = parseAmount(raw);
      const typeText = columns.type >= 0 ? normalise(row[columns.type]) : '';
      const negative = typeof raw === 'number' ? raw < 0 : /^-|\(/.test(String(raw ?? '').trim());

      if (typeText) {
        direction = /^(c|cr|credit|deposit)/.test(typeText) ? 'credit' : 'debit';
      } else {
        // A single signed amount column: a minus means money left the account.
        direction = negative ? 'debit' : 'credit';
      }
    } else {
      skipped++;
      continue;
    }

    if (!(amount > 0)) {
      skipped++;
      continue;
    }

    rows.push({
      id: `${date}-${index}-${amount}`,
      date,
      amount: Math.round(amount * 100) / 100,
      direction,
      description:
        columns.description >= 0 ? String(row[columns.description] ?? '').trim().slice(0, 120) : '',
    });
  }

  return { rows, skipped };
}
