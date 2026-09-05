/**
 * Salary settlements — paying people for a stretch of days, in whole or in part.
 *
 * The original model was one payment per employee per calendar month, keyed
 * `${empCode}_${YYYY-MM}`. That cannot express how this shop actually pays: some people are
 * settled every week, some take an advance mid-month and the balance later, and a month
 * that is half paid had nowhere to record the half.
 *
 * A settlement is therefore an append-only entry — who, which dates, what they earned over
 * those dates, and what was actually handed over. Several may exist for the same month, and
 * what is still owed is simply "earned in the range, less everything already settled inside
 * it". Nothing is ever rewritten: reverting a settlement marks it reverted and leaves it on
 * the record, so a mistaken payment and its correction are both visible afterwards.
 */
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  setDoc,
  doc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logActivity } from '@/utils/activityLog';
import type { SalaryMode } from './types';

export const SETTLEMENTS_COLLECTION = 'salarySettlements';

export interface SalarySettlement {
  id: string;
  empCode: string;
  employeeName: string;
  /** 'YYYY-MM-DD' — inclusive. */
  periodStart: string;
  /** 'YYYY-MM-DD' — inclusive. */
  periodEnd: string;
  /** What the attendance in that range worked out to. */
  earned: number;
  /** What was actually paid. Less than `earned` for a part payment. */
  amount: number;
  daysWorked: number;
  paidHours: number;
  salaryMode: SalaryMode | null;
  /** Free text — "advance", "weekly settlement", a cheque number. */
  note?: string;
  status: 'paid' | 'reverted';
  paidAt: string;
  paidBy: string;
  revertedAt?: string;
  revertedBy?: string;
}

const nowIso = () => new Date().toISOString();

/**
 * Every settlement, newest first.
 *
 * Loaded whole rather than by month, because a settlement's range can straddle two months
 * and filtering server-side by one of them would hide it from the other. The volume is one
 * document per person per payment — small enough that the simple thing is also the right
 * one for a long time.
 */
export async function fetchSettlements(empCode?: string): Promise<SalarySettlement[]> {
  const base = collection(db, SETTLEMENTS_COLLECTION);
  const snapshot = await getDocs(
    empCode
      ? query(base, where('empCode', '==', empCode))
      : query(base, orderBy('paidAt', 'desc'))
  );

  const rows = snapshot.docs.map((entry) => ({
    id: entry.id,
    ...(entry.data() as Omit<SalarySettlement, 'id'>),
  }));

  return rows.sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''));
}

/**
 * How much has already been settled for a range.
 *
 * A settlement counts when its own range falls inside the one being asked about, which is
 * what makes "pay the week, then look at the month" add up: four weekly settlements sit
 * inside their month and are all deducted from it. Reverted entries are ignored — that is
 * the whole point of reverting one.
 */
export function settledInRange(
  settlements: SalarySettlement[],
  empCode: string,
  periodStart: string,
  periodEnd: string
): number {
  const total = settlements
    .filter(
      (entry) =>
        entry.empCode === empCode &&
        entry.status === 'paid' &&
        entry.periodStart >= periodStart &&
        entry.periodEnd <= periodEnd
    )
    .reduce((sum, entry) => sum + (entry.amount || 0), 0);

  return Math.round(total * 100) / 100;
}

export async function recordSettlement(input: {
  empCode: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  earned: number;
  amount: number;
  daysWorked: number;
  paidHours: number;
  salaryMode: SalaryMode | null;
  note?: string;
  paidBy: string;
}): Promise<void> {
  await addDoc(collection(db, SETTLEMENTS_COLLECTION), {
    ...input,
    note: input.note || '',
    status: 'paid',
    paidAt: nowIso(),
  });

  const partial = input.amount < input.earned;
  await logActivity({
    action: 'pay',
    entity: 'salaryPayment',
    entityId: `${input.empCode}_${input.periodStart}_${input.periodEnd}`,
    summary:
      `Settled ₹${input.amount} to ${input.employeeName} for ` +
      `${input.periodStart} → ${input.periodEnd}` +
      (partial ? ` (part payment of ₹${input.earned} earned)` : ''),
    after: { amount: input.amount, earned: input.earned, daysWorked: input.daysWorked },
  });
}

/** Marks a settlement reverted. The entry stays, so the mistake and its undo both show. */
export async function revertSettlement(
  settlement: SalarySettlement,
  revertedBy: string
): Promise<void> {
  await setDoc(
    doc(db, SETTLEMENTS_COLLECTION, settlement.id),
    { status: 'reverted', revertedAt: nowIso(), revertedBy },
    { merge: true }
  );

  await logActivity({
    action: 'undo-pay',
    entity: 'salaryPayment',
    entityId: settlement.id,
    summary:
      `Undid the ₹${settlement.amount} settlement for ${settlement.employeeName} ` +
      `(${settlement.periodStart} → ${settlement.periodEnd})`,
    before: { status: 'paid', amount: settlement.amount },
    after: { status: 'reverted' },
  });
}
