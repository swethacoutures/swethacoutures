import React from 'react';
import { ArrowRight } from 'lucide-react';
import { PRODUCTS } from './landingContent';
import Reveal from './Reveal';

interface ProductsSectionProps {
  onBook: () => void;
}

/**
 * What the shop makes.
 *
 * The six categories are the garment names that appear most often on real bills, so this is
 * a picture of the actual order book rather than an aspirational catalogue.
 *
 * Each card is a photograph with the label sitting on it, which is only legible because of
 * the gradient baked into `.photo-scrim`. Two columns on a phone rather than one: these are
 * browsing tiles, and a single column of tall images turns the section into a very long
 * scroll for very little information.
 */
const ProductsSection: React.FC<ProductsSectionProps> = ({ onBook }) => (
  <section id="products" className="relative scroll-mt-20 py-20 sm:py-28 lg:py-32">
    <div className="mx-auto max-w-[var(--shell)] px-4 sm:px-6 lg:px-10">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="eyebrow text-[var(--gold-light)]">What We Make</p>
        <h2 className="mt-5 text-[clamp(2rem,1.3rem+3vw,3.5rem)] text-[var(--cream)]">
          Six things we make
          <br />
          <span className="accent-word">every week</span>.
        </h2>
        <div className="rule-fade mx-auto mt-7 max-w-[16rem]" />
        <p className="lede mx-auto mt-6 max-w-lg">
          Bring your own fabric or choose from ours. Every piece below is cut for one person
          and finished by hand.
        </p>
      </Reveal>

      <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-5">
        {PRODUCTS.map((product, index) => (
          <Reveal as="article" key={product.name} delay={(index % 3) * 90}>
            <button
              type="button"
              onClick={onBook}
              className="card-lift group relative block h-full w-full overflow-hidden border border-[var(--ink-line)] text-left"
            >
              <span className="photo-scrim relative block overflow-hidden">
                <img
                  src={product.image}
                  alt={product.alt}
                  width={800}
                  height={1066}
                  loading="lazy"
                  decoding="async"
                  className="photo aspect-[3/4] transition-transform duration-[1.4s] group-hover:scale-[1.07]"
                />
              </span>

              <span className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 p-3 sm:p-4 lg:p-5">
                <span className="min-w-0">
                  <span className="ff-display block text-[1.15rem] leading-tight text-[var(--cream)] transition-colors duration-500 group-hover:text-[var(--gold-light)] sm:text-[1.5rem] lg:text-[1.7rem]">
                    {product.name}
                  </span>
                  {/* The note is a nicety, not the message — it would crowd a 160px card. */}
                  <span className="mt-1.5 hidden text-[0.78rem] leading-relaxed text-[var(--cream-muted)] sm:block">
                    {product.note}
                  </span>
                </span>

                <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--ink-line-strong)] text-[var(--cream-dim)] transition-all duration-500 group-hover:border-[var(--gold)] group-hover:bg-[var(--gold)] group-hover:text-[var(--ink)] sm:flex">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </span>
            </button>
          </Reveal>
        ))}
      </div>

      <Reveal delay={100}>
        <p className="mt-8 text-center text-[0.84rem] text-[var(--cream-faint)]">
          Shirts, pants, suits and kurtas are stitched to order too — ask when you visit.
        </p>
      </Reveal>
    </div>
  </section>
);

export default ProductsSection;
