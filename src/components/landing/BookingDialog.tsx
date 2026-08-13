import React, { useEffect, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Phone, MessageCircle, ArrowRight, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { CONTACT, SERVICES } from './landingContent';
import Logo from './Logo';

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DayOption {
  /** 'YYYY-MM-DD' — what the server stores. */
  value: string;
  /** What the customer reads. */
  label: string;
  /** Spelled out, for the WhatsApp fallback message. */
  long: string;
}

/** 'YYYY-MM-DD' for a Date, in local terms rather than UTC. */
function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The next working days, so nobody can request a day the shop is shut or already past. */
function upcomingDays(): DayOption[] {
  const days: DayOption[] = [];
  const today = new Date();

  for (let offset = 0; offset < 16 && days.length < 8; offset += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    // The shop is shut on Sunday (settings/business), so offering it would waste a trip.
    if (date.getDay() === 0) continue;

    days.push({
      value: isoDay(date),
      label:
        offset === 0
          ? 'Today'
          : offset === 1
            ? 'Tomorrow'
            : date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
      long: date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
    });
  }

  return days;
}

/** Shop hours are 9–7. Value is what the server stores, label is what is shown. */
const SLOTS = [
  { value: '10:00', label: '10:00 am' },
  { value: '11:00', label: '11:00 am' },
  { value: '12:00', label: '12:00 pm' },
  { value: '13:00', label: '1:00 pm' },
  { value: '15:00', label: '3:00 pm' },
  { value: '16:00', label: '4:00 pm' },
  { value: '17:00', label: '5:00 pm' },
  { value: '18:00', label: '6:00 pm' },
];

const OTHER_SERVICE = 'Something else';

type Phase = 'form' | 'sending' | 'done' | 'failed';

/**
 * Appointment booking.
 *
 * The request is POSTed to /api/appointments, which writes it into the same `appointments`
 * collection the admin's Appointments page reads — so a booking made here appears in the
 * back office exactly like one typed in at the counter. The write happens server-side on
 * purpose: see api/_appointmentIntake.ts for why the alternative (a public Firestore write
 * rule) was not worth it.
 *
 * If that request fails for any reason, the customer is not left stranded — the failure
 * state hands them the same details pre-written for WhatsApp, plus the phone number. A shop
 * losing a customer because a serverless function had a bad day is the one outcome this
 * component exists to prevent.
 */
const BookingDialog: React.FC<BookingDialogProps> = ({ open, onOpenChange }) => {
  const days = useMemo(upcomingDays, []);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState(SERVICES[0].title);
  /** Only used when the dropdown is on "Something else". */
  const [customService, setCustomService] = useState('');
  const [day, setDay] = useState('');
  const [slot, setSlot] = useState('');
  const [notes, setNotes] = useState('');
  const [company, setCompany] = useState(''); // honeypot
  const [touched, setTouched] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [serverError, setServerError] = useState('');

  // Reopening after a booking should offer a clean form, not the last one's confirmation.
  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setPhase('form');
      setServerError('');
      setTouched(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open]);

  const nameOk = name.trim().length > 1;
  // Indian mobile numbers are ten digits; anything else is a typo we can catch here rather
  // than sending the owner a message she cannot reply to.
  const digits = phone.replace(/\D/g, '');
  const phoneOk = digits.length >= 10 && digits.length <= 12;
  // `customServiceOk` is folded in below, once `isOther` is known.

  const isOther = service === OTHER_SERVICE;
  /**
   * "Something else" on its own tells the shop nothing, so when it is picked the customer
   * types what they want and that is what is sent — the appointment lands in the admin's
   * book describing the actual job rather than a shrug.
   */
  const effectiveService = isOther ? customService.trim() || OTHER_SERVICE : service;
  const customServiceOk = !isOther || customService.trim().length > 1;

  const chosenDay = days.find((option) => option.value === day);
  const chosenSlot = SLOTS.find((option) => option.value === slot);
  const valid = nameOk && phoneOk && customServiceOk;

  const whatsappMessage = [
    `Hello ${CONTACT.name}, I would like to book an appointment.`,
    '',
    `Name: ${name.trim()}`,
    `Phone: ${phone.trim()}`,
    `For: ${effectiveService}`,
    chosenDay ? `Preferred day: ${chosenDay.long}` : null,
    chosenSlot ? `Preferred time: ${chosenSlot.label}` : null,
    notes.trim() ? `Notes: ${notes.trim()}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const whatsappHref = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(whatsappMessage)}`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!valid || phase === 'sending') return;

    setPhase('sending');
    setServerError('');

    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          service: effectiveService,
          date: day,
          time: slot,
          notes: notes.trim(),
          company,
        }),
      });

      /**
       * The SPA rewrite means a misconfigured deployment answers with the index page rather
       * than a 404, so a bare `response.json()` would throw "Unexpected token '<'" and read
       * as a network fault. Checking the content type turns that into the honest message
       * that the endpoint is not reachable.
       */
      const isJson = (response.headers.get('content-type') || '').includes('application/json');
      const payload = isJson ? await response.json() : null;

      if (response.ok && payload?.ok) {
        setPhase('done');
        return;
      }

      setServerError(
        payload?.error || 'We could not save that just now. Please send it on WhatsApp instead.'
      );
      setPhase('failed');
    } catch {
      setServerError('No connection. Please send it on WhatsApp or call the shop.');
      setPhase('failed');
    }
  };

  const fieldClass =
    'w-full border-b border-[var(--ink-line-strong)] bg-transparent px-0 py-2.5 text-[0.95rem] text-[var(--cream)] outline-none transition-colors placeholder:text-[var(--cream-faint)] focus:border-[var(--gold)]';

  const labelClass =
    'block text-[0.6rem] font-medium uppercase tracking-[0.26em] text-[var(--cream-faint)]';

  const chipClass = (active: boolean) =>
    `border px-3 py-1.5 text-[0.76rem] transition-all duration-300 ${
      active
        ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--ink)]'
        : 'border-[var(--ink-line-strong)] text-[var(--cream-dim)] hover:border-[var(--gold)] hover:text-[var(--gold-light)]'
    }`;

  return (
    /*
     * Built from the Radix primitives rather than the shared <DialogContent>.
     * That wrapper renders its own close button in the corner, which sat on top of this
     * dialog's own — two X buttons, one of them styled for the admin app. Composing the
     * primitives directly means there is exactly one close control, and it is ours.
     */
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="atelier fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-1.25rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-[var(--ink-line-strong)] bg-[var(--ink-raised)] p-0 shadow-[0_2rem_5rem_-1rem_rgba(0,0,0,0.8)] duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Book an appointment</DialogPrimitive.Title>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center text-[var(--cream-muted)] transition-colors hover:text-[var(--gold-light)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {phase === 'done' ? (
          /* ------------------------------------------------------- confirmation */
          <div className="px-5 py-12 text-center sm:px-10 sm:py-14">
            <Logo variant="mark" height={64} className="mx-auto" decorative />
            <span className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--gold)]">
              <Check className="h-5 w-5 text-[var(--gold-light)]" />
            </span>
            <h2 className="ff-display mt-5 text-[1.9rem] text-[var(--cream)] sm:text-[2.3rem]">
              Request <span className="accent-word">received</span>
            </h2>
            <p className="mx-auto mt-4 max-w-sm text-[0.9rem] leading-relaxed text-[var(--cream-dim)]">
              Thank you, {name.trim().split(' ')[0]}. Your request is with the shop
              {chosenDay ? ` for ${chosenDay.long}` : ''}
              {chosenSlot ? ` at ${chosenSlot.label}` : ''}. We will call {phone.trim()} to
              confirm the time.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2.5 border border-[var(--ink-line-strong)] px-6 py-3.5 text-[0.68rem] font-medium uppercase tracking-[0.22em] text-[var(--cream)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold-light)]"
              >
                <MessageCircle className="h-4 w-4" />
                Message us too
              </a>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="bg-[var(--gold)] px-7 py-3.5 text-[0.68rem] font-medium uppercase tracking-[0.22em] text-[var(--ink)] transition-colors hover:bg-[var(--gold-light)]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-[0.85fr_1.3fr]">
            {/* Left rail — who you are about to write to. */}
            <aside className="weave relative hidden flex-col justify-between border-r border-[var(--ink-line)] bg-[var(--ink)] p-8 md:flex">
              <div>
                <Logo variant="mark" height={72} decorative />
                <h2 className="ff-display mt-7 text-[2rem] leading-[1.08] text-[var(--cream)]">
                  Book a<br />
                  <span className="accent-word">fitting</span>
                </h2>
                <p className="mt-4 text-[0.8rem] leading-relaxed text-[var(--cream-muted)]">
                  Tell us what you have in mind and when you can come in. We confirm by phone,
                  usually the same day.
                </p>
              </div>

              <div className="mt-10 space-y-4 text-[0.76rem] text-[var(--cream-faint)]">
                <div className="stitch-rule" />
                <p className="leading-relaxed">{CONTACT.addressLines.join(', ')}</p>
                <p>
                  {CONTACT.hours[0].days}
                  <br />
                  {CONTACT.hours[0].time}
                </p>
              </div>
            </aside>

            <form onSubmit={handleSubmit} className="p-5 sm:p-8">
              <div className="mb-5 flex items-center gap-3 md:hidden">
                <Logo variant="mark" height={44} decorative />
                <div>
                  <p className="eyebrow text-[var(--gold-light)]">Appointment</p>
                  <h2 className="ff-display mt-1 text-[1.6rem] text-[var(--cream)]">
                    Book a <span className="accent-word">fitting</span>
                  </h2>
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="booking-name">
                      Your name
                    </label>
                    <input
                      id="booking-name"
                      className={fieldClass}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Full name"
                      autoComplete="name"
                    />
                    {touched && !nameOk && (
                      <p className="mt-1.5 text-xs text-[var(--madder)]">
                        Please tell us your name.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="booking-phone">
                      Phone
                    </label>
                    <input
                      id="booking-phone"
                      className={fieldClass}
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="10-digit mobile"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                    {touched && !phoneOk && (
                      <p className="mt-1.5 text-xs text-[var(--madder)]">
                        A 10-digit mobile number, so we can call you back.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className={labelClass} htmlFor="booking-service">
                    What is it for
                  </label>
                  <select
                    id="booking-service"
                    className={`${fieldClass} cursor-pointer`}
                    value={service}
                    onChange={(event) => {
                      setService(event.target.value);
                      if (event.target.value !== OTHER_SERVICE) setCustomService('');
                    }}
                  >
                    {SERVICES.map((item) => (
                      <option key={item.title} value={item.title}>
                        {item.title}
                      </option>
                    ))}
                    <option value={OTHER_SERVICE}>{OTHER_SERVICE}</option>
                  </select>
                </div>

                {isOther && (
                  <div>
                    <label className={labelClass} htmlFor="booking-service-other">
                      Tell us what you need
                    </label>
                    <input
                      id="booking-service-other"
                      className={fieldClass}
                      value={customService}
                      onChange={(event) => setCustomService(event.target.value)}
                      placeholder="e.g. re-line a jacket, pico & fall on 6 sarees"
                      autoFocus
                      maxLength={70}
                    />
                    {touched && !customServiceOk && (
                      <p className="mt-1.5 text-xs text-[var(--madder)]">
                        A few words about the work, so we can quote it.
                      </p>
                    )}
                  </div>
                )}

                <fieldset className="min-w-0">
                  <legend className={labelClass}>Preferred day</legend>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {days.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDay(day === option.value ? '' : option.value)}
                        className={chipClass(day === option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="min-w-0">
                  <legend className={labelClass}>Preferred time</legend>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {SLOTS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSlot(slot === option.value ? '' : option.value)}
                        className={chipClass(slot === option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label className={labelClass} htmlFor="booking-notes">
                    Anything else{' '}
                    <span className="normal-case tracking-normal">(optional)</span>
                  </label>
                  <textarea
                    id="booking-notes"
                    className={`${fieldClass} min-h-[3.25rem] resize-y`}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Fabric you're bringing, the occasion, a deadline…"
                    rows={2}
                  />
                </div>

                {/* Honeypot: off-screen and hidden from assistive tech, so only a bot
                    filling in every field will ever put anything in it. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label htmlFor="booking-company">Company</label>
                  <input
                    id="booking-company"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                  />
                </div>
              </div>

              {phase === 'failed' && (
                <div
                  role="alert"
                  className="mt-6 flex gap-3 border border-[var(--madder)]/60 bg-[var(--madder)]/10 p-3"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--madder)]" />
                  <div className="min-w-0">
                    <p className="text-[0.82rem] leading-relaxed text-[var(--cream-dim)]">
                      {serverError}
                    </p>
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noreferrer"
                      className="link-stitch mt-2 inline-block text-[0.72rem] uppercase tracking-[0.18em] text-[var(--gold-light)]"
                    >
                      Send it on WhatsApp
                    </a>
                  </div>
                </div>
              )}

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={phase === 'sending'}
                  className="shine group inline-flex flex-1 items-center justify-center gap-2.5 bg-[var(--gold)] px-6 py-3.5 text-[0.68rem] font-medium uppercase tracking-[0.22em] text-[var(--ink)] transition-colors duration-300 hover:bg-[var(--gold-light)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {phase === 'sending' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Request appointment
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                    </>
                  )}
                </button>
                <a
                  href={`tel:+91${CONTACT.phone}`}
                  className="inline-flex items-center justify-center gap-2 border border-[var(--ink-line-strong)] px-5 py-3.5 text-[0.68rem] font-medium uppercase tracking-[0.22em] text-[var(--cream-dim)] transition-colors duration-300 hover:border-[var(--gold)] hover:text-[var(--gold-light)]"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Call
                </a>
              </div>

              <p className="mt-4 text-[0.7rem] leading-relaxed text-[var(--cream-faint)]">
                Your request goes straight to the shop's appointment book. We will call to
                confirm the time before you travel.
              </p>
            </form>
          </div>
        )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default BookingDialog;
