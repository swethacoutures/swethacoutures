import React from 'react';
import { ArrowRight, MapPin, Phone, Mail, Clock, MessageCircle } from 'lucide-react';
import { CONTACT } from './landingContent';
import Logo from './Logo';
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
  <section id="visit" className="relative scroll-mt-20 py-20 sm:py-28 lg:py-32">
    <div className="mx-auto max-w-[var(--shell)] px-4 sm:px-6 lg:px-10">
      <div className="relative overflow-hidden border border-[var(--ink-line-strong)]">
        {/* Red silk behind the whole block — the one warm-toned panel on the page. */}
        <img
          src="/images/texture-red-silk.webp"
          alt=""
          aria-hidden="true"
          width={1400}
          height={787}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(115deg,rgba(16,11,7,0.96)_0%,rgba(16,11,7,0.88)_45%,rgba(16,11,7,0.72)_100%)]"
          aria-hidden="true"
        />

        <div className="relative grid lg:grid-cols-[1.1fr_1fr]">
          {/* ------------------------------------------------------------- the ask */}
          <div className="px-5 py-12 sm:px-10 sm:py-14 lg:py-16">
            <Reveal>
              <Logo variant="bar" height={52} className="mb-8" />
              <p className="eyebrow text-[var(--gold-light)]">Visit the atelier</p>
              <h2 className="mt-5 text-[clamp(2rem,1.3rem+3.2vw,3.5rem)] text-[var(--cream)]">
                Bring the fabric.
                <br />
                We will do the <span className="accent-word">rest</span>.
              </h2>
              <p className="mt-6 max-w-md text-[0.92rem] leading-relaxed text-[var(--cream-dim)]">
                Walk in during shop hours, or book a time so someone is free to sit with you
                and take measurements properly.
              </p>
            </Reveal>

            <Reveal delay={140}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onBook}
                  className="shine group inline-flex items-center justify-center gap-3 bg-[var(--gold)] px-7 py-4 text-[0.68rem] font-medium uppercase tracking-[0.24em] text-[var(--ink)] transition-colors duration-300 hover:bg-[var(--gold-light)]"
                >
                  Book Appointment
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                </button>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2.5 border border-[var(--ink-line-strong)] px-6 py-4 text-[0.68rem] font-medium uppercase tracking-[0.24em] text-[var(--cream)] transition-colors duration-300 hover:border-[var(--gold)] hover:text-[var(--gold-light)]"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              </div>
            </Reveal>
          </div>

          {/* --------------------------------------------------------- practicals */}
          <div className="border-t border-[var(--ink-line)] px-5 py-10 sm:px-10 lg:border-l lg:border-t-0 lg:py-16">
            <dl className="space-y-7">
              <Reveal>
                <div className="flex gap-4">
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-[var(--gold)]" />
                  <div className="min-w-0">
                    <dt className="text-[0.58rem] uppercase tracking-[0.28em] text-[var(--cream-faint)]">
                      Address
                    </dt>
                    <dd className="mt-2 text-[0.92rem] leading-relaxed text-[var(--cream-dim)]">
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
                      className="link-stitch mt-3 inline-block text-[0.7rem] uppercase tracking-[0.2em] text-[var(--gold-light)]"
                    >
                      Open in maps
                    </a>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={90}>
                <div className="flex gap-4">
                  <Clock className="mt-1 h-4 w-4 shrink-0 text-[var(--gold)]" />
                  <div className="min-w-0">
                    <dt className="text-[0.58rem] uppercase tracking-[0.28em] text-[var(--cream-faint)]">
                      Hours
                    </dt>
                    <dd className="mt-2 space-y-1 text-[0.92rem] text-[var(--cream-dim)]">
                      {CONTACT.hours.map((entry) => (
                        <span key={entry.days} className="flex flex-wrap gap-x-3">
                          <span>{entry.days}</span>
                          <span className="text-[var(--cream-faint)]">{entry.time}</span>
                        </span>
                      ))}
                    </dd>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={180}>
                <div className="flex gap-4">
                  <Phone className="mt-1 h-4 w-4 shrink-0 text-[var(--gold)]" />
                  <div className="min-w-0">
                    <dt className="text-[0.58rem] uppercase tracking-[0.28em] text-[var(--cream-faint)]">
                      Telephone
                    </dt>
                    <dd className="mt-2">
                      <a
                        href={`tel:+91${CONTACT.phone}`}
                        className="ff-display text-[1.6rem] text-[var(--cream)] transition-colors hover:text-[var(--gold-light)]"
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
                  <div className="min-w-0">
                    <dt className="text-[0.58rem] uppercase tracking-[0.28em] text-[var(--cream-faint)]">
                      Email
                    </dt>
                    <dd className="mt-2">
                      <a
                        href={`mailto:${CONTACT.email}`}
                        className="wrap-anywhere text-[0.92rem] text-[var(--cream-dim)] transition-colors hover:text-[var(--gold-light)]"
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
