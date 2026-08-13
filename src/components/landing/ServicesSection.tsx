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
 * Every row is fully legible without interaction — the hover only warms it up. A list
 * that hides its content behind a hover is unusable on the phones most of these visitors
 * are holding.
 */
const ServicesSection: React.FC<ServicesSectionProps> = ({ onBook }) => (
  <section
    id="services"
    className="weave relative scroll-mt-24 overflow-hidden bg-[var(--ink)] py-24 text-[var(--paper)] sm:py-32"
  >
    {/* Gold hairline top and bottom, fading at the edges. */}
    <div
      className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gold)]/70 to-transparent"
      aria-hidden="true"
    />

    <div className="relative mx-auto max-w-[var(--shell)] px-5 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <Reveal>
          <p className="eyebrow text-[var(--gold-light)]">Our Services</p>
          <h2 className="mt-5 max-w-2xl text-[clamp(2.25rem,1.4rem+3.4vw,3.75rem)] text-[var(--paper)]">
            Everything a garment
            <br />
            needs, <span className="italic text-[var(--gold-light)]">under one roof</span>.
          </h2>
        </Reveal>

        <Reveal delay={140}>
          <p className="max-w-sm text-[0.9rem] leading-relaxed text-[var(--paper)]/60">
            Seven kinds of work, taken from what our customers actually ask for. Prices shown
            are starting rates — the final figure depends on the fabric, the work and the fit.
          </p>
        </Reveal>
      </div>

      <ul className="mt-14 sm:mt-16">
        {SERVICES.map((service, index) => (
          <Reveal as="li" key={service.no} delay={index * 60}>
            <button
              type="button"
              onClick={onBook}
              className="group grid w-full grid-cols-1 items-start gap-4 border-t border-[var(--paper)]/12 py-7 text-left transition-colors duration-500 hover:border-[var(--gold)]/60 sm:gap-8 md:grid-cols-[5rem_1fr_1.15fr_auto] md:py-8"
            >
              <span className="ff-display foil text-[2.4rem] leading-none md:text-[3rem]">
                {service.no}
              </span>

              <span className="min-w-0">
                <span className="ff-display block text-[1.6rem] leading-tight text-[var(--paper)] transition-colors duration-500 group-hover:text-[var(--gold-light)] md:text-[2rem]">
                  {service.title}
                </span>
                {service.from !== undefined && (
                  <span className="mt-2 inline-block border border-[var(--gold)]/40 px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.2em] text-[var(--gold-light)]">
                    from ₹{service.from}
                  </span>
                )}
              </span>

              <span className="min-w-0">
                <span className="block text-[0.9rem] leading-relaxed text-[var(--paper)]/65">
                  {service.blurb}
                </span>
                <span className="mt-3 flex flex-wrap gap-x-2 gap-y-1.5">
                  {service.detail.map((item) => (
                    <span
                      key={item}
                      className="text-[0.72rem] uppercase tracking-[0.14em] text-[var(--paper)]/40 after:ml-2 after:text-[var(--gold)]/50 after:content-['·'] last:after:content-['']"
                    >
                      {item}
                    </span>
                  ))}
                </span>
              </span>

              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--paper)]/20 text-[var(--paper)]/70 transition-all duration-500 group-hover:border-[var(--gold)] group-hover:bg-[var(--gold)] group-hover:text-[var(--ink)]">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </button>
          </Reveal>
        ))}
      </ul>

      <div className="mt-4 h-px w-full bg-[var(--paper)]/12" aria-hidden="true" />

      <Reveal delay={120}>
        <p className="mt-10 text-[0.82rem] text-[var(--paper)]/45">
          Not sure which of these you need? Bring the garment in — we will tell you honestly
          whether it is worth the work.
        </p>
      </Reveal>
    </div>
  </section>
);

export default ServicesSection;
