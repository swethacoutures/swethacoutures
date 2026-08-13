import React from 'react';
import { CONTACT } from './landingContent';
import { StitchDivider, ThreadLoop } from './ornaments';
import Reveal from './Reveal';

/** What actually happens in the workroom. Each of these is a real in-house capability. */
const IN_HOUSE = [
  { title: 'Cutting & stitching', body: 'Every garment cut to a fresh set of measurements, never to a standard size chart.' },
  { title: 'Dyeing', body: 'Shade matching and full-length dyeing, so a blouse and a saree finally agree with each other.' },
  { title: 'Embroidery', body: 'Aari and machine work on blouses, yokes and borders, worked to the design you choose.' },
  { title: 'Finishing', body: 'Falls, lining, can-can, lace, tassels, hooks and zips — the work that decides how a piece wears.' },
];

const AtelierSection: React.FC = () => (
  <section id="atelier" className="relative scroll-mt-24 py-24 sm:py-32">
    <ThreadLoop
      className="pointer-events-none absolute -right-32 top-10 h-[34rem] w-[34rem] rotate-180 text-[var(--gold)] opacity-[0.16]"
    />

    <div className="relative mx-auto max-w-[var(--shell)] px-5 sm:px-8 lg:px-12">
      <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
        {/* Title column — sticks while the prose scrolls past it on wide screens. */}
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <Reveal>
              <p className="eyebrow text-[var(--madder)]">The Atelier</p>
              <h2 className="mt-5 text-[clamp(2.25rem,1.4rem+3.4vw,3.75rem)]">
                A workroom,
                <br />
                not a <span className="accent-word">factory</span>.
              </h2>
            </Reveal>

            <Reveal delay={120}>
              <StitchDivider className="my-8 max-w-xs" />
              <p className="lede max-w-md">
                Swetha's Couture is a tailoring house on Temple Street in Kakinada. The
                measurements are taken here, the fabric is cut here, and the finishing is done
                here — by the same hands, in the same room.
              </p>
            </Reveal>

            <Reveal delay={200}>
              <div className="mt-9 flex flex-wrap gap-x-10 gap-y-5">
                <div>
                  <p className="text-[0.6rem] uppercase tracking-[0.28em] text-[var(--ink-muted)]">
                    Open
                  </p>
                  <p className="ff-display mt-1.5 text-[1.35rem] text-[var(--ink)]">
                    Mon — Sat
                  </p>
                  <p className="text-[0.8rem] text-[var(--ink-soft)]">9:00 am — 7:00 pm</p>
                </div>
                <div>
                  <p className="text-[0.6rem] uppercase tracking-[0.28em] text-[var(--ink-muted)]">
                    Speak to us
                  </p>
                  <a
                    href={`tel:+91${CONTACT.phone}`}
                    className="ff-display mt-1.5 block text-[1.35rem] text-[var(--ink)] transition-colors hover:text-[var(--madder)]"
                  >
                    {CONTACT.phone}
                  </a>
                  <p className="text-[0.8rem] text-[var(--ink-soft)]">Call or WhatsApp</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Prose column. */}
        <div className="lg:col-span-7">
          <Reveal>
            {/* A pulled quote set in ink — the one dark block in an otherwise pale section. */}
            <figure className="weave relative bg-[var(--ink)] px-7 py-10 sm:px-11 sm:py-12">
              <div
                className="absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent"
                aria-hidden="true"
              />
              <blockquote className="ff-display text-[1.6rem] leading-[1.28] text-[var(--paper)] sm:text-[2rem]">
                “A blouse that fits is not a luxury. It is the least a garment owes the person
                <span className="italic text-[var(--gold-light)]"> wearing it</span>.”
              </blockquote>
              <figcaption className="mt-6 text-[0.68rem] uppercase tracking-[0.28em] text-[var(--paper)]/50">
                How we work
              </figcaption>
            </figure>
          </Reveal>

          <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {IN_HOUSE.map((item, index) => (
              <Reveal key={item.title} delay={index * 90}>
                <div className="border-t border-[var(--line)] pt-5">
                  <h3 className="text-[1.3rem] text-[var(--ink)]">{item.title}</h3>
                  <p className="mt-2.5 text-[0.88rem] leading-relaxed text-[var(--ink-soft)]">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <p className="mt-10 max-w-2xl border-l-2 border-[var(--gold)] pl-5 text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
              Bring your own fabric or choose from what we have. Either way you get a trial
              fitting before the piece is handed over, and your measurements stay on file so the
              next order starts from a fit we already know is right.
            </p>
          </Reveal>
        </div>
      </div>
    </div>
  </section>
);

export default AtelierSection;
