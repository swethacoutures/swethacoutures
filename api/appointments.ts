/**
 * POST /api/appointments — the public website's booking form.
 *
 * Thin adapter only: validation and the write live in `_appointmentIntake.ts`, so the Vite
 * dev server runs the identical code path.
 *
 * ⚠️ Relative imports in api/ MUST carry an explicit `.js` extension. `package.json` sets
 * `"type": "module"`, so Node ESM will not resolve `'./_foo'`. TypeScript does not add the
 * extension, the build succeeds, and the function then throws ERR_MODULE_NOT_FOUND at load
 * time — surfacing as a bare FUNCTION_INVOCATION_FAILED 500 with no usable message. This
 * exact bug sat in api/biotime.ts for months.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleAppointmentRequest } from './_appointmentIntake.js';

interface VercelRequest extends IncomingMessage {
  body?: unknown;
}

/** A booking form is a few hundred bytes; anything larger is not a booking. */
const MAX_BODY_BYTES = 32 * 1024;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = Buffer.from(JSON.stringify(body), 'utf8');
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', String(payload.length));
  res.setHeader('Cache-Control', 'no-store');
  res.end(payload);
}

/**
 * Reads the body as raw bytes.
 *
 * `req.body` is not trusted — what the platform leaves there depends on the runtime and on
 * the Content-Type the browser happened to send. The stream is read directly while it is
 * still readable, with req.body only as the fallback for a runtime that already drained it.
 */
async function readBody(req: VercelRequest): Promise<string> {
  if (!req.readableEnded) {
    const chunks: Buffer[] = [];
    let total = 0;
    try {
      for await (const chunk of req) {
        const buffer = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : (chunk as Buffer);
        total += buffer.length;
        if (total > MAX_BODY_BYTES) break;
        chunks.push(buffer);
      }
    } catch {
      /* fall through to req.body */
    }
    if (chunks.length > 0) return Buffer.concat(chunks).toString('utf8');
  }

  const body = req.body;
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  if (body && typeof body === 'object') return JSON.stringify(body);
  return '';
}

export default async function handler(req: VercelRequest, res: ServerResponse): Promise<void> {
  if ((req.method || 'GET').toUpperCase() !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { ok: false, error: 'Use POST.' });
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse((await readBody(req)) || '{}');
  } catch {
    sendJson(res, 400, { ok: false, error: 'Could not read that request.' });
    return;
  }

  try {
    // Imported lazily for the same reason the device endpoint does it: this pulls in
    // firebase-admin, and a module-load failure there would happen before any handler code
    // runs, producing a 500 no try/catch could reach.
    const { getAdminDb, createFirestoreStore } = await import('./_firebaseAdmin.js');
    const store = createFirestoreStore(getAdminDb());

    const result = await handleAppointmentRequest(payload, store);
    console.log(`[appointments] ${result.log}`);
    sendJson(res, result.status, result.body);
  } catch (error) {
    console.error('[appointments] Failed to record request:', error);
    // Deliberately unhelpful to the caller, deliberately loud in the logs. The customer is
    // shown the shop's phone number and WhatsApp link instead, so a broken server does not
    // mean a lost customer.
    sendJson(res, 500, {
      ok: false,
      error: 'We could not save that just now. Please call or WhatsApp us instead.',
    });
  }
}
