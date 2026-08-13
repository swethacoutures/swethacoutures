import React from 'react';
import { ArrowRight, MapPin, Phone, Mail, Clock, MessageCircle } from 'lucide-react';
import { CONTACT } from './landingContent';
import { ThreadLoop } from './ornaments';
import Reveal from './Reveal';

interface VisitSectionProps {
  onBook: () => void;
}

const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  CONTACT.mapsQuery
)}`;

const whatsappHref = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(
  `Hello ${CONTACT.name}, I would like to ask about an order.`
)}`;

/** The closing call to action, paired with everything needed to actually turn up. */
const VisitSection: React.FC<VisitSectionProps> = ({ onBook }) => (
  <section id="visit" className="relative scroll-mt-24 py-24 sm:py-32">
    <div className="mx-auto max-w-[var(--shell)] px-5 sm:px-8 lg:px-12">
      <div className="weave relative overflow-hidden bg-[var(--ink)] text-[var(--paper)]">
        <ThreadLoop className="pointer-events-none absolute -right-20 -top-24 h-[30rem] w-[30rem] text-[var(--gold)] opacity-25" />

        <div className="relative grid gap-px lg:grid-cols-[1.15fr_1fr]">
          {/* ------------------------------------------------------------- the ask */}
          <div className="px-7 py-14 sm:px-12 sm:py-16 lg:py-20">
            <Reveal>
              <p className="eyebrow text-[var(--gold-light)]">Visit the atelier</p>
              <h2 className="mt-6 text-[clamp(2.3rem,1.4rem+3.6vw,4rem)] text-[var(--paper)]">
                Bring the fabric.
                <br />
                We will do the
                <br />
                <span className="italic text-[var(--gold-light)]">rest</span>.
              </h2>
              <p className="mt-7 max-w-md text-[0.95rem] leading-relaxed text-[var(--paper)]/65">
                Walk in during shop hours, or book a time so someone is free to sit with you and
                take measurements properly.
              </p>
            </Reveal>

            <Reveal delay={140}>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onBook}
                  className="group inline-flex items-center justify-center gap-3 bg-[var(--gold)] px-8 py-4 text-[0.7rem] font-medium uppercase tracking-[0.24em] text-[var(--ink)] transition-colors duration-300 hover:bg-[var(--gold-light)]"
                >
                  Book Appointment
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                </button>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2.5 border border-[var(--paper)]/25 px-7 py-4 text-[0.7rem] font-medium uppercase tracking-[0.24em] text-[var(--paper)] transition-colors duration-300 hover:border-[var(--gold)] hover:text-[var(--gold-light)]"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              </div>
            </Reveal>
          </div>

          {/* ------------------------------------------------------- the practicals */}
          <div className="border-t border-[var(--paper)]/12 px-7 py-12 sm:px-12 lg:border-l lg:border-t-0 lg:py-20">
            <dl className="space-y-8">
              <Reveal>
                <div className="flex gap-4">
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-[var(--gold)]" />
                  <div>
                    <dt className="text-[0.6rem] uppercase tracking-[0.28em] text-[var(--paper)]/45">
                      Address
                    </dt>
                    <dd className="mt-2 text-[0.95rem] leading-relaxed text-[var(--paper)]/85">
                      {CONTACT.addressLines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </dd>
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noreferrer"
                      className="link-stitch mt-3 inline-block text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold-light)]"
                    >
                      Open in maps
                    </a>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={90}>
                <div className="flex gap-4">
                  <Clock className="mt-1 h-4 w-4 shrink-0 text-[var(--gold)]" />
                  <div>
                    <dt className="text-[0.6rem] uppercase tracking-[0.28em] text-[var(--paper)]/45">
                      Hours
                    </dt>
                    <dd className="mt-2 space-y-1 text-[0.95rem] text-[var(--paper)]/85">
                      {CONTACT.hours.map((entry) => (
                        <span key={entry.days} className="flex flex-wrap gap-x-3">
                          <span>{entry.days}</span>
                          <span className="text-[var(--paper)]/55">{entry.time}</span>
                        </span>
                      ))}
                    </dd>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={180}>
                <div className="flex gap-4">
                  <Phone className="mt-1 h-4 w-4 shrink-0 text-[var(--gold)]" />
                  <div>
                    <dt className="text-[0.6rem] uppercase tracking-[0.28em] text-[var(--paper)]/45">
                      Telephone
                    </dt>
                    <dd className="mt-2">
                      <a
                        href={`tel:+91${CONTACT.phone}`}
                        className="ff-display text-[1.65rem] text-[var(--paper)] transition-colors hover:text-[var(--gold-light)]"
                      >
                        {CONTACT.phone}
                      </a>
                    </dd>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={260}>
                <div className="flex gap-4">
                  <Mail className="mt-1 h-4 w-4 shrink-0 text-[var(--gold)]" />
                  <div>
                    <dt className="text-[0.6rem] uppercase tracking-[0.28em] text-[var(--paper)]/45">
                      Email
                    </dt>
                    <dd className="mt-2">
                      <a
                        href={`mailto:${CONTACT.email}`}
                        className="break-all text-[0.95rem] text-[var(--paper)]/85 transition-colors hover:text-[var(--gold-light)]"
                      >
                        {CONTACT.email}
                      </a>
                    </dd>
                  </div>
                </div>
              </Reveal>
            </dl>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default VisitSection;
