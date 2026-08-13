import React from 'react';
import { CONTACT } from './landingContent';
import Reveal from './Reveal';

/** What actually happens in the workroom. Each of these is a real in-house capability. */
const IN_HOUSE = [
  {
    title: 'Cutting & stitching',
    body: 'Every garment cut to a fresh set of measurements, never to a standard size chart.',
  },
  {
    title: 'Dyeing',
    body: 'Shade matching and full-length dyeing, so a blouse and a saree finally agree with each other.',
  },
  {
    title: 'Embroidery',
    body: 'Aari and machine work on blouses, yokes and borders, worked to the design you choose.',
  },
  {
    title: 'Finishing',
    body: 'Falls, lining, can-can, lace, tassels, hooks and zips — the work that decides how a piece wears.',
  },
];

/**
 * The atelier.
 *
 * Three photographs in a deliberately uneven stack — a tall portrait, the shop itself, and
 * a close crop of a machine in use. The asymmetry is the point: a neat 2×2 of images would
 * read as a stock template, while an overlapping arrangement reads as a scrapbook of one
 * real place.
 */
const AtelierSection: React.FC = () => (
  <section id="atelier" className="relative scroll-mt-20 py-20 sm:py-28 lg:py-32">
    <div className="mx-auto max-w-[var(--shell)] px-4 sm:px-6 lg:px-10">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
        {/* ------------------------------------------------------------ pictures */}
        <div className="lg:col-span-6">
          {/* Sticky on wide screens: the prose column is roughly twice as tall as the
              pictures, and without this the section ends with a large panel of empty
              ground where the images used to be. */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:sticky lg:top-28">
            <Reveal className="col-span-1 row-span-2">
              <figure className="photo-scrim-soft relative h-full overflow-hidden border border-[var(--ink-line)]">
                <img
                  src="/images/atelier-portrait.webp"
                  data-parallax="18"
                  alt="A bride in a red and gold saree with gold jewellery"
                  width={1000}
                  height={1250}
                  loading="lazy"
                  decoding="async"
                  className="photo parallax aspect-[4/5] transition-transform duration-[1.2s] lg:aspect-auto lg:h-full"
                />
              </figure>
            </Reveal>

            <Reveal delay={120}>
              <figure className="photo-scrim-soft relative overflow-hidden border border-[var(--ink-line)]">
                <img
                  src="/images/atelier-boutique.webp"
                  data-parallax="26"
                  alt="Racks of finished ethnic wear in the shop"
                  width={1000}
                  height={1250}
                  loading="lazy"
                  decoding="async"
                  className="photo parallax aspect-[4/5] transition-transform duration-[1.2s]"
                />
              </figure>
            </Reveal>

            <Reveal delay={220}>
              <figure className="photo-scrim-soft relative overflow-hidden border border-[var(--ink-line)]">
                <img
                  src="/images/atelier-machine.webp"
                  data-parallax="12"
                  alt="A hand guiding cloth under a sewing machine needle"
                  width={1000}
                  height={666}
                  loading="lazy"
                  decoding="async"
                  className="photo parallax aspect-[3/2] transition-transform duration-[1.2s]"
                />
              </figure>
            </Reveal>
          </div>
        </div>

        {/* ---------------------------------------------------------------- text */}
        <div className="lg:col-span-6">
          <Reveal>
            <p className="eyebrow text-[var(--gold-light)]">The Atelier</p>
            <h2 className="mt-5 text-[clamp(2rem,1.3rem+3vw,3.5rem)] text-[var(--cream)]">
              A workroom,
              <br />
              not a <span className="accent-word">factory</span>.
            </h2>
            <div className="rule-fade my-7 max-w-xs" />
            <p className="lede max-w-lg">
              Swetha's Couture is a tailoring house on Temple Street in Kakinada. The
              measurements are taken here, the fabric is cut here, and the finishing is done
              here — by the same hands, in the same room.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <figure className="weave mt-9 border-l-2 border-[var(--gold)] bg-[var(--ink-raised)] px-5 py-6 sm:px-7 sm:py-7">
              <blockquote className="ff-display text-[1.35rem] leading-[1.3] text-[var(--cream)] sm:text-[1.7rem]">
                “A blouse that fits is not a luxury. It is the least a garment owes the person
                <span className="italic text-[var(--gold-light)]"> wearing it</span>.”
              </blockquote>
            </figure>
          </Reveal>

          <div className="mt-9 grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {IN_HOUSE.map((item, index) => (
              <Reveal key={item.title} delay={index * 90}>
                <div className="border-t border-[var(--ink-line)] pt-4">
                  <h3 className="text-[1.2rem] text-[var(--gold-light)]">{item.title}</h3>
                  <p className="mt-2 text-[0.86rem] leading-relaxed text-[var(--cream-muted)]">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <div className="mt-9 flex flex-wrap gap-x-10 gap-y-5">
              <div>
                <p className="text-[0.58rem] uppercase tracking-[0.28em] text-[var(--cream-faint)]">
                  Open
                </p>
                <p className="ff-display mt-1.5 text-[1.3rem] text-[var(--cream)]">Mon — Sat</p>
                <p className="text-[0.8rem] text-[var(--cream-muted)]">9:00 am — 7:00 pm</p>
              </div>
              <div>
                <p className="text-[0.58rem] uppercase tracking-[0.28em] text-[var(--cream-faint)]">
                  Speak to us
                </p>
                <a
                  href={`tel:+91${CONTACT.phone}`}
                  className="ff-display mt-1.5 block text-[1.3rem] text-[var(--cream)] transition-colors hover:text-[var(--gold-light)]"
                >
                  {CONTACT.phone}
                </a>
                <p className="text-[0.8rem] text-[var(--cream-muted)]">Call or WhatsApp</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  </section>
);

export default AtelierSection;
