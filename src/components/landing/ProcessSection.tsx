import React from 'react';
import { PROCESS } from './landingContent';
import Reveal from './Reveal';

/**
 * How an order actually runs, in four steps.
 *
 * The running-stitch line threading through the numerals is the page's motif made literal:
 * on wide screens it runs horizontally through all four, and on a phone it turns and runs
 * down the left-hand side instead.
 */
const ProcessSection: React.FC = () => (
  <section
    id="process"
    className="relative scroll-mt-20 overflow-hidden border-y border-[var(--ink-line)] py-20 sm:py-28 lg:py-32"
  >
    {/* A silk texture, held far back — enough to warm the band, not enough to read as an
        image competing with the type. */}
    <img
      src="/images/texture-gold-silk.webp"
      data-parallax="34"
      alt=""
      aria-hidden="true"
      width={1400}
      height={787}
      loading="lazy"
      decoding="async"
      className="parallax absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.14]"
    />
    <div className="absolute inset-0 -z-10 bg-[var(--ink)]/85" aria-hidden="true" />

    <div className="mx-auto max-w-[var(--shell)] px-4 sm:px-6 lg:px-10">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <Reveal className="lg:col-span-4">
          <p className="eyebrow text-[var(--gold-light)]">How It Works</p>
          <h2 className="mt-5 text-[clamp(2rem,1.3rem+3vw,3.25rem)] text-[var(--cream)]">
            Four visits,
            <br />
            <span className="accent-word">one</span> good fit.
          </h2>
          <p className="lede mt-6 max-w-sm">
            Most orders are ready in a week to ten days. Anything with heavy embroidery or
            dyeing takes longer, and we will tell you the real date rather than the one you
            want to hear.
          </p>
        </Reveal>

        <div className="relative lg:col-span-8">
          {/* The thread. Horizontal from md up, vertical below. */}
          <div
            className="stitch-rule absolute left-0 right-0 top-[1.4rem] hidden md:block"
            aria-hidden="true"
          />
          <div
            className="stitch-rule-v absolute bottom-6 left-[1.4rem] top-6 md:hidden"
            aria-hidden="true"
          />

          <ol className="relative grid gap-9 md:grid-cols-2 lg:gap-x-10">
            {PROCESS.map((step, index) => (
              <Reveal as="li" key={step.no} delay={index * 110}>
                <div className="flex gap-4 md:block">
                  <span className="flex h-[2.8rem] w-[2.8rem] shrink-0 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--ink)] text-[0.72rem] font-medium tracking-[0.08em] text-[var(--gold-light)]">
                    {step.no}
                  </span>
                  <div className="min-w-0 md:mt-6">
                    <h3 className="text-[1.3rem] text-[var(--cream)]">{step.title}</h3>
                    <p className="mt-2 max-w-sm text-[0.86rem] leading-relaxed text-[var(--cream-muted)]">
                      {step.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </div>
  </section>
);

export default ProcessSection;
