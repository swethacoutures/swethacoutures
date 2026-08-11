/**
 * Audit trail for anything an admin changes by hand.
 *
 * Attendance decides what people are paid, and the admin can edit or delete any of it. That
 * is necessary — a missed punch has to be correctable — but an editable payroll record with
 * no history is not evidence of anything. This module records who changed what, when, and
 * what the value was before, so a disputed month can be reconstructed.
 *
 * Deliberately fire-and-forget: a logging failure must never block or undo the change the
 * user asked for. A missing log line is a gap in the record; a failed save because the log
 * was unavailable is lost work.
 */
import { addDoc, collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const ACTIVITY_LOG_COLLECTION = 'activityLog';

export type ActivityAction =
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'block'
  | 'settings'
  | 'pay'
  | 'undo-pay';

export type ActivityEntity =
  | 'attendanceRecord'
  | 'devicePunch'
  | 'attendanceEmployee'
  | 'device'
  | 'attendanceSettings'
  | 'salaryPayment';

export interface ActivityEntry {
  id: string;
  action: ActivityAction;
  entity: ActivityEntity;
  entityId: string;
  /** One line an admin can read without expanding anything. */
  summary: string;
  /** The values that changed. Only the changed fields, not the whole document. */
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  byUid?: string;
  byName: string;
  at: string;
}

/**
 * Who is making the change.
 *
 * Set once when the app loads the signed-in user, so every call site does not have to pass
 * it. A log entry with no name is far worse than one with a stale one, so this falls back
 * to a marker rather than to nothing.
 */
let currentActor: { uid?: string; name: string } = { name: 'unknown' };

export function setActivityActor(actor: { uid?: string; name?: string | null } | null): void {
  currentActor = { uid: actor?.uid, name: actor?.name || 'unknown' };
}

/** Keeps only the fields that actually differ, so the log reads as a diff not a dump. */
export function diffFields(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  for (const key of keys) {
    // Timestamps change on every write and would drown the real edits.
    if (key === 'updatedAt' || key === 'createdAt') continue;

    const from = before?.[key];
    const to = after?.[key];
    if (JSON.stringify(from) === JSON.stringify(to)) continue;

    if (from !== undefined) changedBefore[key] = from;
    if (to !== undefined) changedAfter[key] = to;
  }

  return { before: changedBefore, after: changedAfter };
}

export async function logActivity(entry: {
  action: ActivityAction;
  entity: ActivityEntity;
  entityId: string;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { before, after } = diffFields(entry.before, entry.after);

    await addDoc(collection(db, ACTIVITY_LOG_COLLECTION), {
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      summary: entry.summary,
      before,
      after,
      byUid: currentActor.uid || '',
      byName: currentActor.name,
      at: new Date().toISOString(),
    });
  } catch (error) {
    // Never rethrow. The user's change already succeeded; losing the audit line is bad,
    // but undoing their work or showing them an error they cannot act on is worse.
    console.error('[activityLog] could not record entry', error);
  }
}

/** Most recent entries first. `entity` narrows to one kind of change. */
export async function fetchActivity(options?: {
  entity?: ActivityEntity;
  max?: number;
}): Promise<ActivityEntry[]> {
  const constraints = [];
  if (options?.entity) constraints.push(where('entity', '==', options.entity));

  const snapshot = await getDocs(
    query(
      collection(db, ACTIVITY_LOG_COLLECTION),
      ...constraints,
      orderBy('at', 'desc'),
      limit(options?.max ?? 300)
    )
  );

  return snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }) as ActivityEntry);
}
