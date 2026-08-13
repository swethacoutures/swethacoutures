/**
 * Appointment requests coming from the public website.
 *
 * WHY THIS RUNS ON THE SERVER
 * The obvious implementation is to let the browser write to the `appointments` collection
 * directly. That needs a Firestore rule allowing unauthenticated creates, and such a rule
 * cannot be taken back once a stranger finds it: anyone could write anything into the
 * shop's live operational data, at any rate they liked. Instead the browser posts here, the
 * service account does the write, and `firestore.rules` keeps denying public writes to
 * every collection. The rules stay closed and the validation lives in code that a caller
 * cannot edit.
 *
 * Like `_deviceIngest.ts`, this file is deliberately **import-free and self-contained**, so
 * the identical logic runs in Vercel (`api/appointments.ts`), in the Vite dev server, and
 * in tests, with the database injected as a `Store`.
 */

export const APPOINTMENTS_COLLECTION = 'appointments';

/** The minimum surface of Firestore this needs. Matches `DocStore` in _deviceIngest.ts. */
export interface Store {
  set(collection: string, id: string, data: Record<string, unknown>): Promise<void>;
}

export interface AppointmentRequest {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  service?: unknown;
  date?: unknown;
  time?: unknown;
  notes?: unknown;
  /**
   * Honeypot. A real person never sees this field, so anything in it came from a bot
   * filling in every input on the page.
   */
  company?: unknown;
}

export interface IntakeResult {
  status: number;
  body: { ok: boolean; id?: string; error?: string; field?: string };
  log: string;
}

const MAX = { name: 80, service: 70, notes: 600, email: 120 };

/** How far ahead somebody may request. Beyond this it is not a booking, it is a wish. */
const MAX_DAYS_AHEAD = 120;

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Strips everything a phone number cannot contain, so "+91 99594 94567" is accepted. */
const digitsOnly = (value: string): string => value.replace(/\D/g, '');

/**
 * Collapses whitespace and drops control characters.
 *
 * Free text ends up in a WhatsApp message and in the admin table; a newline-stuffed name
 * would wreck both. This is not an XSS defence — React escapes on render — it is about the
 * value being sane wherever it is displayed.
 */
function clean(value: string, max: number): string {
  // Control characters are removed by code point rather than by a regex: a character class
  // containing them either puts raw control bytes in this file or trips no-control-regex,
  // and a careless `[ -]` would be read as space-through-hyphen and strip the apostrophes
  // out of people's names.
  let stripped = '';
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    stripped += code < 0x20 || code === 0x7f ? ' ' : character;
  }

  return stripped.replace(/\s+/g, ' ').trim().slice(0, max);
}

const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isTime = (value: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** 'YYYY-MM-DD' in local terms for the given date. */
function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Builds the Date stored on the appointment.
 *
 * Constructed from the parts rather than `new Date('2026-08-20T15:00')`, because a bare
 * date string is parsed as UTC by spec while a date-time string is parsed as local — the
 * exact inconsistency that put every device punch 5.5 hours out until it was fixed there.
 */
function toDateTime(isoDate: string, time: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  const [hour, minute] = (isTime(time) ? time : '10:00').split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/**
 * Validates a request and writes it.
 *
 * `now` is injected so the date-window checks are testable without freezing the clock.
 */
export async function handleAppointmentRequest(
  input: AppointmentRequest,
  store: Store,
  now: Date = new Date()
): Promise<IntakeResult> {
  const reject = (error: string, field?: string): IntakeResult => ({
    status: 400,
    body: { ok: false, error, field },
    log: `rejected (${field || 'request'}): ${error}`,
  });

  // Bots fill in everything they find. A human never sees this field.
  if (str(input.company)) {
    // Answer 200 so a scraper cannot tell the honeypot from a success and start probing.
    return { status: 200, body: { ok: true }, log: 'honeypot triggered, discarded' };
  }

  const name = clean(str(input.name), MAX.name);
  if (name.length < 2) return reject('Please tell us your name.', 'name');

  const phoneRaw = str(input.phone);
  const phone = digitsOnly(phoneRaw);
  // 10 digits for an Indian mobile; up to 12 allows a 91 country prefix.
  if (phone.length < 10 || phone.length > 12) {
    return reject('Enter a 10-digit mobile number.', 'phone');
  }

  const email = clean(str(input.email), MAX.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return reject('That email address does not look right.', 'email');
  }

  const service = clean(str(input.service), MAX.service) || 'Consultation';
  const notes = clean(str(input.notes), MAX.notes);

  const requestedDate = str(input.date);
  const requestedTime = str(input.time);

  if (requestedDate && !isIsoDate(requestedDate)) {
    return reject('Choose a valid day.', 'date');
  }
  if (requestedTime && !isTime(requestedTime)) {
    return reject('Choose a valid time.', 'time');
  }

  const today = dayKey(now);
  if (requestedDate && requestedDate < today) {
    return reject('That day has already passed.', 'date');
  }

  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + MAX_DAYS_AHEAD);
  if (requestedDate && requestedDate > dayKey(horizon)) {
    return reject('Please pick a day within the next few months.', 'date');
  }

  /**
   * The document id is derived from the phone number and the requested day rather than
   * being random. Two consequences, both wanted: a double-tapped submit button updates one
   * request instead of creating twins, and someone refining their request ("actually, make
   * it 4pm") replaces their earlier one rather than leaving the shop to guess which is
   * current. It also caps how much one number can create.
   */
  const id = `web_${phone}_${requestedDate || 'asap'}`;

  const appointmentDate = requestedDate
    ? toDateTime(requestedDate, requestedTime)
    : // No preference given: park it on today so it sorts to the top of the admin's list
      // as something needing a call back, rather than vanishing into the far future.
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0, 0);

  await store.set(APPOINTMENTS_COLLECTION, id, {
    customerName: name,
    customerPhone: phone,
    customerEmail: email || null,
    appointmentDate,
    appointmentTime: requestedTime || '',
    duration: 60,
    purpose: service,
    notes: notes || null,
    gmeetUrl: null,
    /**
     * 'scheduled' is the admin page's own initial status, so a website request lands in
     * exactly the same state as one typed in at the counter and needs no special handling
     * anywhere downstream. `source` is what distinguishes it in the UI.
     */
    status: 'scheduled',
    source: 'website',
    /** Nobody has replied yet — the admin page uses this for its reminder flag. */
    reminderSent: false,
    requestedDay: requestedDate || '',
    createdAt: now,
    updatedAt: now,
  });

  return {
    status: 200,
    body: { ok: true, id },
    log: `appointment ${id} from ${name} (${phone}) for ${service}`,
  };
}
