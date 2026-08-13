import React from 'react';
import { PRODUCTS } from './landingContent';
import { GarmentArt, StitchDivider } from './ornaments';
import Reveal from './Reveal';

interface ProductsSectionProps {
  onBook: () => void;
}

/**
 * What the shop makes.
 *
 * The six categories are the garment names that appear most often on real bills, so this
 * is a picture of the actual order book rather than an aspirational catalogue.
 */
const ProductsSection: React.FC<ProductsSectionProps> = ({ onBook }) => (
  <section id="products" className="relative scroll-mt-24 py-24 sm:py-32">
    <div className="mx-auto max-w-[var(--shell)] px-5 sm:px-8 lg:px-12">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="eyebrow text-[var(--madder)]">What We Make</p>
        <h2 className="mt-5 text-[clamp(2.25rem,1.4rem+3.4vw,3.75rem)]">
          Six things we make
          <br />
          <span className="accent-word">every week</span>.
        </h2>
        <StitchDivider className="mx-auto mt-8 max-w-[16rem]" />
        <p className="lede mx-auto mt-7 max-w-lg">
          Drawn, not photographed — because the piece we make for you will be yours, not a
          copy of somebody else's.
        </p>
      </Reveal>

      <div className="mt-16 grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((product, index) => (
          <Reveal
            as="article"
            key={product.name}
            delay={(index % 3) * 90}
            className="group relative bg-[var(--paper-warm)]"
          >
            <button
              type="button"
              onClick={onBook}
              className="flex h-full w-full flex-col items-center px-7 py-10 text-center transition-colors duration-500 hover:bg-[var(--paper-deep)]/45"
            >
              {/* The drawing sits in a gold-ruled well, so the cards read as plates in a
                  pattern book rather than as web tiles. */}
              <span className="relative flex h-[11rem] w-full items-center justify-center">
                <span
                  className="absolute inset-x-8 inset-y-2 border border-[var(--gold)]/25 transition-all duration-500 group-hover:inset-x-5 group-hover:border-[var(--gold)]/55"
                  aria-hidden="true"
                />
                <GarmentArt
                  kind={product.art}
                  className="relative h-full w-auto text-[var(--ink)] transition-transform duration-700 group-hover:-translate-y-1.5 group-hover:scale-[1.04]"
                />
              </span>

              <h3 className="mt-7 text-[1.55rem] transition-colors duration-500 group-hover:text-[var(--madder)]">
                {product.name}
              </h3>
              <p className="mt-3 max-w-[19rem] text-[0.85rem] leading-relaxed text-[var(--ink-soft)]">
                {product.note}
              </p>

              <span className="mt-6 text-[0.62rem] uppercase tracking-[0.26em] text-[var(--ink-muted)] transition-colors duration-500 group-hover:text-[var(--madder)]">
                Enquire
              </span>
            </button>
          </Reveal>
        ))}
      </div>

      <Reveal delay={100}>
        <p className="mt-9 text-center text-[0.85rem] text-[var(--ink-muted)]">
          Shirts, pants, suits and kurtas are stitched to order too — ask when you visit.
        </p>
      </Reveal>
    </div>
  </section>
);

export default ProductsSection;
