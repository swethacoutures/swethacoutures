import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Phone, MessageCircle, ArrowRight, X } from 'lucide-react';
import { CONTACT, SERVICES } from './landingContent';
import { Monogram } from './ornaments';

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The next seven days, so nobody can book an appointment in the past. */
function upcomingDates(): { value: string; label: string }[] {
  const days: { value: string; label: string }[] = [];
  const cursor = new Date();

  for (let offset = 0; offset < 14 && days.length < 8; offset += 1) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + offset);
    // The shop is shut on Sunday (settings/business), so offering it would waste a trip.
    if (date.getDay() === 0) continue;

    days.push({
      value: date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
      label:
        offset === 0
          ? 'Today'
          : offset === 1
            ? 'Tomorrow'
            : date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
    });
  }

  return days;
}

/** Shop hours are 9–7, so the slots stop at 6. */
const SLOTS = [
  '10:00 am',
  '11:00 am',
  '12:00 pm',
  '1:00 pm',
  '3:00 pm',
  '4:00 pm',
  '5:00 pm',
  '6:00 pm',
];

/**
 * Appointment booking.
 *
 * There is no public write path into the shop's database — the Firestore rules deny
 * unauthenticated writes on every collection, and opening one so a stranger could create
 * records would be a worse trade than it looks. So the form composes a message and hands
 * it to WhatsApp, which is how this shop already talks to its customers: the request lands
 * on the phone that is already in the owner's hand, with a thread to reply in.
 */
const BookingDialog: React.FC<BookingDialogProps> = ({ open, onOpenChange }) => {
  const dates = useMemo(upcomingDates, []);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState(SERVICES[0].title);
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);

  const nameOk = name.trim().length > 1;
  // Indian mobile numbers are ten digits; anything else is a typo we can catch here
  // rather than sending the owner a message she cannot reply to.
  const digits = phone.replace(/\D/g, '');
  const phoneOk = digits.length >= 10 && digits.length <= 12;
  const valid = nameOk && phoneOk;

  const message = [
    `Hello ${CONTACT.name}, I would like to book an appointment.`,
    '',
    `Name: ${name.trim()}`,
    `Phone: ${phone.trim()}`,
    `For: ${service}`,
    date ? `Preferred day: ${date}` : null,
    slot ? `Preferred time: ${slot}` : null,
    notes.trim() ? `Notes: ${notes.trim()}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!valid) return;

    window.open(
      `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer'
    );
    onOpenChange(false);
  };

  const fieldClass =
    'w-full border-b border-[var(--line)] bg-transparent px-0 py-2.5 text-[0.95rem] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-muted)]/70 focus:border-[var(--madder)]';

  const labelClass =
    'block text-[0.625rem] font-medium uppercase tracking-[0.28em] text-[var(--ink-muted)]';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="atelier max-h-[92vh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-none border-[var(--gold)]/35 bg-[var(--paper-warm)] p-0 shadow-[0_2rem_5rem_-1rem_rgba(23,19,15,0.5)] sm:rounded-none"
        aria-describedby={undefined}
      >
        {/* The stock close button is styled for the admin app; this one matches the paper. */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center text-[var(--ink-muted)] transition-colors hover:text-[var(--madder)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="grid gap-0 md:grid-cols-[1fr_1.35fr]">
          {/* Left rail — who you are about to write to. */}
          <aside className="weave relative hidden flex-col justify-between bg-[var(--ink)] p-8 text-[var(--paper)] md:flex">
            <div>
              <Monogram className="h-11 w-11 text-[var(--gold-light)]" />
              <h2 className="mt-7 ff-display text-[2.1rem] leading-[1.06] text-[var(--paper)]">
                Book a<br />
                <span className="italic text-[var(--gold-light)]">fitting</span>
              </h2>
              <p className="mt-4 text-[0.82rem] leading-relaxed text-[var(--paper)]/65">
                Tell us what you have in mind and when you can come in. We reply on WhatsApp,
                usually the same day.
              </p>
            </div>

            <div className="mt-10 space-y-4 text-[0.78rem] text-[var(--paper)]/60">
              <div className="stitch-rule" />
              <p className="leading-relaxed">
                {CONTACT.addressLines.join(', ')}
              </p>
              <p>
                {CONTACT.hours[0].days}
                <br />
                {CONTACT.hours[0].time}
              </p>
            </div>
          </aside>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8">
            <p className="eyebrow text-[var(--madder)] md:hidden">Appointment</p>
            <h2 className="mt-2 ff-display text-[1.9rem] leading-tight md:hidden">
              Book a <span className="accent-word">fitting</span>
            </h2>

            <div className="mt-5 space-y-6 md:mt-0">
              <div className="grid gap-6 sm:grid-cols-2">
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
                    <p className="mt-1.5 text-xs text-[var(--madder)]">Please tell us your name.</p>
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
                  onChange={(event) => setService(event.target.value)}
                >
                  {SERVICES.map((item) => (
                    <option key={item.title} value={item.title}>
                      {item.title}
                    </option>
                  ))}
                  <option value="Something else">Something else</option>
                </select>
              </div>

              <fieldset>
                <legend className={labelClass}>Preferred day</legend>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {dates.map((option) => {
                    const active = date === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDate(active ? '' : option.value)}
                        className={`border px-3 py-1.5 text-[0.78rem] transition-all duration-300 ${
                          active
                            ? 'border-[var(--madder)] bg-[var(--madder)] text-[var(--paper-warm)]'
                            : 'border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--gold)]'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className={labelClass}>Preferred time</legend>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {SLOTS.map((option) => {
                    const active = slot === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSlot(active ? '' : option)}
                        className={`border px-3 py-1.5 text-[0.78rem] transition-all duration-300 ${
                          active
                            ? 'border-[var(--madder)] bg-[var(--madder)] text-[var(--paper-warm)]'
                            : 'border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--gold)]'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <label className={labelClass} htmlFor="booking-notes">
                  Anything else <span className="normal-case tracking-normal">(optional)</span>
                </label>
                <textarea
                  id="booking-notes"
                  className={`${fieldClass} min-h-[3.5rem] resize-y`}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Fabric you're bringing, the occasion, a deadline…"
                  rows={2}
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                className="group inline-flex flex-1 items-center justify-center gap-2.5 bg-[var(--madder)] px-6 py-3.5 text-[0.7rem] font-medium uppercase tracking-[0.24em] text-[var(--paper-warm)] transition-colors duration-300 hover:bg-[var(--madder-bright)]"
              >
                <MessageCircle className="h-4 w-4" />
                Send on WhatsApp
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
              <a
                href={`tel:+91${CONTACT.phone}`}
                className="inline-flex items-center justify-center gap-2 border border-[var(--line)] px-5 py-3.5 text-[0.7rem] font-medium uppercase tracking-[0.24em] text-[var(--ink-soft)] transition-colors duration-300 hover:border-[var(--gold)] hover:text-[var(--madder)]"
              >
                <Phone className="h-3.5 w-3.5" />
                Call
              </a>
            </div>

            <p className="mt-4 text-[0.72rem] leading-relaxed text-[var(--ink-muted)]">
              Nothing is stored on this website. Your details go straight to the shop's WhatsApp
              as a message you can read before you send it.
            </p>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookingDialog;
