import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { SERVICES } from './landingContent';
import Reveal from './Reveal';

interface ServicesSectionProps {
  onBook: () => void;
}

/**
 * The services, as an editorial numbered list rather than a grid of identical boxes.
 *
 * Every row is fully legible without interaction — the hover only warms it up. A list that
 * hides its content behind a hover is unusable on the phones most of these visitors are
 * holding. The three services that carry a photograph show it on the right of their row
 * from `lg` up; below that the text is the whole row, because a 60px-tall thumbnail beside
 * four lines of copy helps nobody.
 */
const ServicesSection: React.FC<ServicesSectionProps> = ({ onBook }) => (
  <section
    id="services"
    className="weave relative scroll-mt-20 overflow-hidden bg-[var(--ink-raised)] py-20 sm:py-28 lg:py-32"
  >
    <div className="rule-fade absolute inset-x-0 top-0" aria-hidden="true" />

    <div className="mx-auto max-w-[var(--shell)] px-4 sm:px-6 lg:px-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <Reveal>
          <p className="eyebrow text-[var(--gold-light)]">Our Services</p>
          <h2 className="mt-5 max-w-2xl text-[clamp(2rem,1.3rem+3vw,3.5rem)] text-[var(--cream)]">
            Everything a garment
            <br />
            needs, <span className="accent-word">under one roof</span>.
          </h2>
        </Reveal>

        <Reveal delay={140}>
          <p className="max-w-sm text-[0.88rem] leading-relaxed text-[var(--cream-muted)]">
            Seven kinds of work, taken from what our customers actually ask for. Prices shown
            are starting rates — the final figure depends on the fabric, the work and the fit.
          </p>
        </Reveal>
      </div>

      <ul className="mt-12 sm:mt-14">
        {SERVICES.map((service, index) => (
          <Reveal as="li" key={service.no} delay={index * 55}>
            <button
              type="button"
              onClick={onBook}
              className="group grid w-full grid-cols-[2.75rem_1fr] items-start gap-x-3 gap-y-3 border-t border-[var(--ink-line)] py-6 text-left transition-colors duration-500 hover:border-[var(--ink-line-strong)] sm:grid-cols-[4rem_1fr] sm:gap-x-5 lg:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1.05fr)_9rem_3rem] lg:items-center lg:gap-x-6 lg:py-7"
            >
              <span className="ff-display foil text-[1.9rem] leading-none sm:text-[2.4rem] lg:text-[2.75rem]">
                {service.no}
              </span>

              <span className="min-w-0">
                <span className="ff-display block text-[1.4rem] leading-tight text-[var(--cream)] transition-colors duration-500 group-hover:text-[var(--gold-light)] sm:text-[1.75rem]">
                  {service.title}
                </span>
                {service.from !== undefined && (
                  <span className="mt-2 inline-block border border-[var(--ink-line-strong)] px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.18em] text-[var(--gold-light)]">
                    from ₹{service.from}
                  </span>
                )}
              </span>

              {/* On mobile this drops under the title and spans both columns. */}
              <span className="col-span-2 min-w-0 lg:col-span-1">
                <span className="block text-[0.86rem] leading-relaxed text-[var(--cream-muted)]">
                  {service.blurb}
                </span>
                <span className="mt-2.5 flex flex-wrap gap-x-2 gap-y-1">
                  {service.detail.map((item) => (
                    <span
                      key={item}
                      className="text-[0.68rem] uppercase tracking-[0.12em] text-[var(--cream-faint)] after:ml-2 after:text-[var(--gold)]/60 after:content-['·'] last:after:content-['']"
                    >
                      {item}
                    </span>
                  ))}
                </span>
              </span>

              <span className="hidden lg:block">
                {service.image ? (
                  <span className="block overflow-hidden border border-[var(--ink-line)]">
                    <img
                      src={service.image}
                      alt=""
                      aria-hidden="true"
                      width={1000}
                      height={666}
                      loading="lazy"
                      decoding="async"
                      className="photo aspect-[3/2] opacity-70 transition-all duration-700 group-hover:scale-[1.06] group-hover:opacity-100"
                    />
                  </span>
                ) : null}
              </span>

              <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--ink-line-strong)] text-[var(--cream-muted)] transition-all duration-500 group-hover:border-[var(--gold)] group-hover:bg-[var(--gold)] group-hover:text-[var(--ink)] lg:flex">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </button>
          </Reveal>
        ))}
      </ul>

      <div className="h-px w-full bg-[var(--ink-line)]" aria-hidden="true" />

      <Reveal delay={120}>
        <p className="mt-8 text-[0.82rem] text-[var(--cream-faint)]">
          Not sure which of these you need? Bring the garment in — we will tell you honestly
          whether it is worth the work.
        </p>
      </Reveal>
    </div>
  </section>
);

export default ServicesSection;
