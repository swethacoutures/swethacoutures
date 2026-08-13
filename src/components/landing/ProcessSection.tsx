import React from 'react';
import { PROCESS } from './landingContent';
import Reveal from './Reveal';

/**
 * How an order actually runs, in four steps.
 *
 * The running-stitch line threading through the numerals is the page's motif made
 * literal: on wide screens it runs horizontally through all four, and on a phone it
 * turns and runs down the left-hand side instead.
 */
const ProcessSection: React.FC = () => (
  <section
    id="process"
    className="relative scroll-mt-24 overflow-hidden bg-[var(--paper-deep)]/60 py-24 sm:py-32"
  >
    <div className="mx-auto max-w-[var(--shell)] px-5 sm:px-8 lg:px-12">
      <div className="grid gap-10 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <p className="eyebrow text-[var(--madder)]">How It Works</p>
          <h2 className="mt-5 text-[clamp(2.25rem,1.4rem+3.4vw,3.5rem)]">
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
          {/* The thread. Horizontal on desktop, vertical on mobile. */}
          <div
            className="stitch-rule absolute left-0 right-0 top-[1.55rem] hidden md:block"
            aria-hidden="true"
          />
          <div
            className="stitch-rule-v absolute bottom-6 left-[1.05rem] top-6 md:hidden"
            aria-hidden="true"
          />

          <ol className="relative grid gap-10 md:grid-cols-2 lg:gap-x-12">
            {PROCESS.map((step, index) => (
              <Reveal as="li" key={step.no} delay={index * 110}>
                <div className="flex gap-5 md:block">
                  <span className="flex h-[2.1rem] w-[2.1rem] shrink-0 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--paper)] text-[0.72rem] font-medium tracking-[0.08em] text-[var(--madder)]">
                    {step.no}
                  </span>
                  <div className="md:mt-6">
                    <h3 className="text-[1.4rem]">{step.title}</h3>
                    <p className="mt-2.5 max-w-sm text-[0.88rem] leading-relaxed text-[var(--ink-soft)]">
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
