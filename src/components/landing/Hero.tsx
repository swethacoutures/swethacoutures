import React from 'react';
import { ArrowRight, MapPin, Star } from 'lucide-react';
import { CONTACT, CRAFT_WORDS } from './landingContent';
import HeroCarousel, { type HeroFrame } from './HeroCarousel';

interface HeroProps {
  onBook: () => void;
}

/**
 * The rotating hero images.
 *
 * All four are the same red-and-gold register as the logo, so the background changes
 * without the page changing character. `position` keeps each subject's face clear of the
 * headline as the viewport shape changes.
 */
const FRAMES: HeroFrame[] = [
  {
    src: '/images/hero-1.webp',
    alt: 'A bride in a red and gold lehenga with hand-worked embroidery',
    position: '62% 22%',
  },
  { src: '/images/hero-2.webp', alt: '', position: '58% 20%' },
  { src: '/images/hero-3.webp', alt: '', position: '55% 18%' },
  { src: '/images/hero-4.webp', alt: '', position: '60% 20%' },
];

/** Claims we can actually stand behind — no invented review counts or years in business. */
const MARKS = [
  'Cut to your measurements',
  'Dyeing & embroidery in-house',
  'Trial fitting before delivery',
  'Measurements kept on file',
];

/**
 * The hero.
 *
 * The photography sits full-bleed behind the type at every width, cross-fading between the
 * four frames above (see HeroCarousel). Every frame was chosen for a subject already lit
 * against a dark ground, so the scrim that makes the headline legible only deepens what is
 * already in the picture instead of fighting it.
 */
const Hero: React.FC<HeroProps> = ({ onBook }) => (
  <section id="top" className="relative isolate min-h-[100svh] overflow-hidden">
    <HeroCarousel frames={FRAMES} />

    <div className="mx-auto flex min-h-[100svh] max-w-[var(--shell)] flex-col justify-end px-4 pb-10 pt-28 sm:px-6 sm:pb-14 lg:justify-center lg:px-10 lg:pb-24 lg:pt-32">
      <div className="max-w-2xl">
        <p
          className="rise eyebrow flex items-center gap-3 text-[var(--gold-light)]"
          style={{ animationDelay: '0.15s' }}
        >
          <span className="inline-block h-px w-7 bg-[var(--gold)] sm:w-9" />
          <span className="min-w-0">Bespoke tailoring house · Kakinada</span>
        </p>

        <h1
          className="rise mt-5 text-[clamp(2.5rem,1.1rem+6.4vw,5.75rem)] text-[var(--cream)]"
          style={{ animationDelay: '0.28s' }}
        >
          Clothes that fit
          <br />
          the way they were
          <br />
          <span className="accent-word">meant</span> to.
        </h1>

        <p className="rise lede mt-6 max-w-xl" style={{ animationDelay: '0.42s' }}>
          Blouses, sarees, lehengas and gowns cut to your own measurements and finished by hand
          in our workroom on Temple Street. Dyeing, embroidery, falls and tassels are all done
          here — nothing is sent out and hoped for.
        </p>

        <div
          className="rise mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          style={{ animationDelay: '0.55s' }}
        >
          <button
            type="button"
            onClick={onBook}
            className="shine group inline-flex items-center justify-center gap-3 bg-[var(--gold)] px-7 py-4 text-[0.68rem] font-medium uppercase tracking-[0.24em] text-[var(--ink)] transition-colors duration-300 hover:bg-[var(--gold-light)] sm:px-8"
          >
            Book an appointment
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
          </button>

          <a
            href="#services"
            className="inline-flex items-center justify-center gap-2 border border-[var(--ink-line-strong)] px-7 py-4 text-[0.68rem] font-medium uppercase tracking-[0.24em] text-[var(--cream-dim)] transition-all duration-300 hover:border-[var(--gold)] hover:text-[var(--gold-light)]"
          >
            See what we do
          </a>
        </div>

        <ul
          className="rise mt-9 grid max-w-xl grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2"
          style={{ animationDelay: '0.68s' }}
        >
          {MARKS.map((mark) => (
            <li
              key={mark}
              className="flex items-start gap-2.5 text-[0.8rem] text-[var(--cream-muted)] sm:text-[0.84rem]"
            >
              <Star className="mt-[0.3rem] h-2.5 w-2.5 shrink-0 fill-[var(--gold)] text-[var(--gold)]" />
              {mark}
            </li>
          ))}
        </ul>

        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT.mapsQuery)}`}
          target="_blank"
          rel="noreferrer"
          className="rise group mt-8 inline-flex items-center gap-2.5 border border-[var(--ink-line)] bg-[var(--ink-raised)]/70 px-4 py-2.5 text-[0.72rem] text-[var(--cream-dim)] backdrop-blur-sm transition-all duration-300 hover:border-[var(--gold)] hover:text-[var(--gold-light)]"
          style={{ animationDelay: '0.8s' }}
        >
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--gold)]" />
          Temple Street, beside Tanishq · Mon–Sat 9–7
        </a>
      </div>
    </div>

    {/* ------------------------------------------------------------- craft ribbon */}
    <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t border-[var(--ink-line)] bg-[var(--ink)]/85 py-2.5 backdrop-blur-sm">
      <div className="marquee-track flex w-max items-center gap-8 whitespace-nowrap will-change-transform">
        {/* Rendered twice so the loop has something to slide into. */}
        {[0, 1].map((copy) => (
          <React.Fragment key={copy}>
            {CRAFT_WORDS.map((word) => (
              <span key={`${copy}-${word}`} className="flex items-center gap-8">
                <span className="ff-display text-[1.15rem] italic text-[var(--cream-muted)] sm:text-[1.4rem]">
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
