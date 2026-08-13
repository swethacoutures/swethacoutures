import React, { useEffect, useState } from 'react';
import '@/styles/landing.css';
import SiteHeader from '@/components/landing/SiteHeader';
import Hero from '@/components/landing/Hero';
import AtelierSection from '@/components/landing/AtelierSection';
import ServicesSection from '@/components/landing/ServicesSection';
import ProductsSection from '@/components/landing/ProductsSection';
import ProcessSection from '@/components/landing/ProcessSection';
import VisitSection from '@/components/landing/VisitSection';
import SiteFooter from '@/components/landing/SiteFooter';
import BookingDialog from '@/components/landing/BookingDialog';
import { CONTACT, PRODUCTS, SERVICES } from '@/components/landing/landingContent';
import { MessageCircle } from 'lucide-react';

/**
 * Structured data for the shop.
 *
 * A tailoring house lives or dies on local search — someone typing "blouse stitching
 * near me" in Kakinada. This tells Google the address, the hours and the fact that
 * this is a physical shop, none of which it can reliably infer from prose.
 */
const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'ClothingStore',
  name: CONTACT.name,
  description:
    'Bespoke tailoring house in Kakinada. Blouse, saree, lehenga and gown stitching, ' +
    'fabric dyeing, embroidery, saree falls, tassels and alterations.',
  telephone: `+91${CONTACT.phone}`,
  email: CONTACT.email,
  address: {
    '@type': 'PostalAddress',
    streetAddress: '36-4-41, Temple Street, Beside Tanishq Showroom',
    addressLocality: 'Kakinada',
    addressRegion: 'Andhra Pradesh',
    addressCountry: 'IN',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '09:00',
      closes: '19:00',
    },
  ],
  makesOffer: SERVICES.map((service) => ({
    '@type': 'Offer',
    itemOffered: { '@type': 'Service', name: service.title, description: service.blurb },
    ...(service.from !== undefined
      ? { priceSpecification: { '@type': 'PriceSpecification', minPrice: service.from, priceCurrency: 'INR' } }
      : {}),
  })),
  keywords: PRODUCTS.map((product) => product.name).join(', '),
};

/**
 * The public face of Swetha's Couture.
 *
 * This used to be a redirect straight into the admin dashboard, which meant the business
 * had no website at all — the domain led to a login box. The back office now lives behind
 * /admin, and this is what a customer arriving at the domain actually sees.
 */
const Landing: React.FC = () => {
  const [bookingOpen, setBookingOpen] = useState(false);

  /**
   * The admin app sets a `dark` class on <html> from the owner's saved preference. A
   * customer's brochure must not turn dark because of a setting inside the back office,
   * so the class is suspended while this page is mounted and restored on the way out.
   */
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    if (wasDark) root.classList.remove('dark');

    const previousTitle = document.title;
    document.title = "Swetha's Couture — Bespoke Tailoring in Kakinada";

    return () => {
      if (wasDark) root.classList.add('dark');
      document.title = previousTitle;
    };
  }, []);

  /**
   * Smooth in-page scrolling that lands below the fixed header.
   *
   * Done here rather than with `scroll-behavior: smooth` on <html>, which would leak into
   * the admin app and make every dashboard jump feel sluggish.
   */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.('a[href^="#"]');
      if (!anchor) return;

      const id = anchor.getAttribute('href');
      if (!id || id === '#') return;

      const target = document.querySelector(id);
      if (!target) return;

      event.preventDefault();
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const open = () => setBookingOpen(true);

  return (
    <div className="atelier atelier-page min-h-screen">
      {/* The only safe way to emit JSON-LD in React. The object is a constant defined
          above — no user input reaches it, so there is nothing here to escape. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />

      <SiteHeader onBook={open} />

      <main>
        <Hero onBook={open} />
        <AtelierSection />
        <ServicesSection onBook={open} />
        <ProductsSection onBook={open} />
        <ProcessSection />
        <VisitSection onBook={open} />
      </main>

      <SiteFooter />

      {/* Phone-only quick action. The header CTA is hidden below `sm`, so without this the
          most important button on the site would be two taps away behind a menu. */}
      <button
        type="button"
        onClick={open}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--madder)] text-[var(--paper-warm)] shadow-[0_1rem_2rem_-0.5rem_rgba(122,43,37,0.7)] transition-transform duration-300 hover:scale-105 active:scale-95 sm:hidden"
        aria-label="Book an appointment"
      >
        <MessageCircle className="h-5 w-5" />
      </button>

      <BookingDialog open={bookingOpen} onOpenChange={setBookingOpen} />
    </div>
  );
};

export default Landing;
