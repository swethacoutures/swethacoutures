import React from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { CONTACT, CRAFT_WORDS } from './landingContent';
import { AtelierForm, ThreadLoop } from './ornaments';

interface HeroProps {
  onBook: () => void;
}

/** Claims we can actually stand behind — no invented review counts or years in business. */
const MARKS = [
  'Cut to your measurements',
  'Dyeing & embroidery in-house',
  'Trial fitting before delivery',
  'Measurements kept on file',
];

const Hero: React.FC<HeroProps> = ({ onBook }) => (
  <section id="top" className="relative overflow-hidden pt-28 sm:pt-32 lg:pt-36">
    {/* Atmosphere: a thread looping behind the type, and a wash of warm paper at the top. */}
    <div
      className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] bg-gradient-to-b from-[var(--paper-warm)] via-[var(--paper)] to-transparent"
      aria-hidden="true"
    />
    <ThreadLoop className="drift pointer-events-none absolute -left-24 top-24 h-[38rem] w-[38rem] text-[var(--gold)] opacity-[0.18]" />

    <div className="relative mx-auto max-w-[var(--shell)] px-5 sm:px-8 lg:px-12">
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
        {/* ---------------------------------------------------------------- type */}
        <div className="lg:col-span-7">
          <p
            className="rise eyebrow flex items-center gap-3 text-[var(--madder)]"
            style={{ animationDelay: '0.1s' }}
          >
            <span className="inline-block h-px w-8 bg-[var(--madder)]" />
            Bespoke tailoring house · Kakinada
          </p>

          <h1
            className="rise mt-6 text-[clamp(2.85rem,1.4rem+6.2vw,6.25rem)]"
            style={{ animationDelay: '0.22s' }}
          >
            Clothes that fit
            <br />
            the way they were
            <br />
            <span className="accent-word">meant</span> to.
          </h1>

          <p
            className="rise lede mt-7 max-w-xl"
            style={{ animationDelay: '0.36s' }}
          >
            Blouses, sarees, lehengas and gowns cut to your own measurements and finished by
            hand in our workroom on Temple Street. Dyeing, embroidery, falls and tassels are
            all done here — nothing is sent out and hoped for.
          </p>

          <div
            className="rise mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: '0.48s' }}
          >
            <button
              type="button"
              onClick={onBook}
              className="group inline-flex items-center justify-center gap-3 bg-[var(--ink)] px-8 py-4 text-[0.7rem] font-medium uppercase tracking-[0.24em] text-[var(--paper-warm)] transition-colors duration-300 hover:bg-[var(--madder)]"
            >
              Book an appointment
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
            </button>

            <a
              href="#services"
              className="inline-flex items-center justify-center gap-2 border border-[var(--line)] px-7 py-4 text-[0.7rem] font-medium uppercase tracking-[0.24em] text-[var(--ink-soft)] transition-all duration-300 hover:border-[var(--gold)] hover:text-[var(--madder)]"
            >
              See what we do
            </a>
          </div>

          <ul
            className="rise mt-10 grid max-w-xl grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2"
            style={{ animationDelay: '0.6s' }}
          >
            {MARKS.map((mark) => (
              <li
                key={mark}
                className="flex items-start gap-2.5 text-[0.82rem] text-[var(--ink-soft)]"
              >
                <svg viewBox="0 0 12 12" className="mt-[0.4rem] h-2 w-2 shrink-0 text-[var(--gold)]">
                  <path d="M6 0 L12 6 L6 12 L0 6 Z" fill="currentColor" />
                </svg>
                {mark}
              </li>
            ))}
          </ul>
        </div>

        {/* -------------------------------------------------------------- drawing */}
        <div className="lg:col-span-5">
          <div className="relative mx-auto max-w-sm lg:max-w-none">
            {/* Gold frame, offset behind the card — the overlap is what stops the
                composition sitting flat in its column. */}
            <div
              className="absolute -right-3 -top-3 bottom-6 left-6 border border-[var(--gold)]/45 sm:-right-5 sm:-top-5 sm:left-10"
              aria-hidden="true"
            />

            {/* pb-16 leaves room for the address chip that hangs off the bottom edge —
                without it the chip sits on top of the price. */}
            <div className="relative border border-[var(--line)] bg-[var(--paper-warm)]/70 px-6 pb-16 pt-8 backdrop-blur-[2px]">
              <AtelierForm className="mx-auto h-auto w-full max-w-[19rem]" />

              <div className="mt-4 flex items-end justify-between gap-4 border-t border-[var(--line-soft)] pt-4">
                <div>
                  <p className="text-[0.6rem] uppercase tracking-[0.28em] text-[var(--ink-muted)]">
                    Stitching from
                  </p>
                  <p className="ff-display mt-1 text-[2rem] leading-none text-[var(--ink)]">
                    ₹500
                  </p>
                </div>
                <p className="max-w-[10rem] text-right text-[0.72rem] leading-relaxed text-[var(--ink-muted)]">
                  Simple blouse. Fabric, lining and work quoted separately.
                </p>
              </div>
            </div>

            {/* Address chip, floated off the card's edge. */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT.mapsQuery)}`}
              target="_blank"
              rel="noreferrer"
              className="group absolute -bottom-5 left-0 flex items-center gap-2.5 border border-[var(--line)] bg-[var(--paper-warm)] px-4 py-3 text-[0.72rem] text-[var(--ink-soft)] shadow-[0_1rem_2rem_-1rem_rgba(23,19,15,0.35)] transition-all duration-300 hover:border-[var(--gold)] sm:-left-6"
            >
              <MapPin className="h-3.5 w-3.5 text-[var(--madder)]" />
              Temple Street, Kakinada
              <ArrowRight className="h-3 w-3 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
            </a>
          </div>
        </div>
      </div>
    </div>

    {/* ------------------------------------------------------------- craft ribbon */}
    <div className="relative mt-24 overflow-hidden border-y border-[var(--line-soft)] bg-[var(--paper-deep)]/50 py-4 sm:mt-28">
      <div className="marquee-track flex w-max items-center gap-10 whitespace-nowrap will-change-transform">
        {/* Rendered twice so the loop has something to slide into. */}
        {[0, 1].map((copy) => (
          <React.Fragment key={copy}>
            {CRAFT_WORDS.map((word) => (
              <span key={`${copy}-${word}`} className="flex items-center gap-10">
                <span className="ff-display text-[1.4rem] italic text-[var(--ink-soft)] sm:text-[1.7rem]">
                  {word}
                </span>
                <svg viewBox="0 0 12 12" className="h-1.5 w-1.5 text-[var(--gold)]" aria-hidden="true">
                  <path d="M6 0 L12 6 L6 12 L0 6 Z" fill="currentColor" />
                </svg>
              </span>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  </section>
);

export default Hero;
