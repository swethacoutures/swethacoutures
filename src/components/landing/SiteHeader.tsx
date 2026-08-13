import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Phone } from 'lucide-react';
import { CONTACT, NAV_LINKS } from './landingContent';
import Logo from './Logo';

interface SiteHeaderProps {
  onBook: () => void;
}

/**
 * The site header.
 *
 * Transparent over the hero photograph so the image is not boxed in, then it takes on the
 * dark ground and a gold hairline once the page scrolls — the change is what tells you the
 * bar is now floating over content rather than sitting in it.
 *
 * The logo is sized by height (see Logo.tsx) so the mark, the wordmark and the nav all sit
 * on one optical line at every breakpoint — including phones, where the shop's name must
 * still be readable rather than reduced to an emblem.
 */
const SiteHeader: React.FC<SiteHeaderProps> = ({ onBook }) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /** Highlights the nav link for whichever section is currently under the header. */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(`#${visible.target.id}`);
      },
      { rootMargin: '-45% 0px -45% 0px' }
    );

    NAV_LINKS.forEach((link) => {
      const node = document.querySelector(link.href);
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);

  // A full-screen menu that still scrolled the page behind it would be a bug on a phone.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  // Escape must close it — the close button can scroll out of reach on a short screen.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'border-b border-[var(--ink-line)] bg-[var(--ink)]/92 backdrop-blur-md'
            : 'border-b border-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-[var(--shell)] items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 lg:px-10">
          <a
            href="#top"
            className="sheen relative flex items-center overflow-hidden py-1"
            aria-label={`${CONTACT.name} — top of page`}
          >
            {/*
              The `bar` variant, at every width — the shop's name has to be readable on a
              phone too, and the supplied lockup renders it far too small at header sizes.
              See Logo.tsx for why the mark and the script are drawn as two images.
            */}
            <Logo
              variant="bar"
              height={scrolled ? 34 : 40}
              priority
              className="transition-all duration-500 sm:hidden"
            />
            <Logo
              variant="bar"
              height={scrolled ? 40 : 50}
              priority
              className="hidden transition-all duration-500 sm:inline-flex"
            />
          </a>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                data-active={activeSection === link.href}
                className="link-stitch text-[0.68rem] font-medium uppercase tracking-[0.2em] text-[var(--cream-dim)] transition-colors duration-300 hover:text-[var(--gold-light)] data-[active=true]:text-[var(--gold-light)]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={`tel:+91${CONTACT.phone}`}
              className="hidden items-center gap-2 text-[0.78rem] tracking-wide text-[var(--cream-dim)] transition-colors hover:text-[var(--gold-light)] xl:flex"
            >
              <Phone className="h-3.5 w-3.5" />
              {CONTACT.phone}
            </a>

            <button
              type="button"
              onClick={onBook}
              className="shine hidden border border-[var(--gold)] bg-[var(--gold)] px-5 py-2.5 text-[0.62rem] font-medium uppercase tracking-[0.22em] text-[var(--ink)] transition-colors duration-300 hover:bg-transparent hover:text-[var(--gold-light)] sm:block"
            >
              Book Appointment
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="-mr-1 flex h-10 w-10 items-center justify-center text-[var(--cream)] lg:hidden"
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu — a full sheet, so the small screen gets the same sense of occasion
          the desktop layout has. */}
      <div
        className={`fixed inset-0 z-[70] lg:hidden ${menuOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!menuOpen}
      >
        <div
          className={`weave absolute inset-0 bg-[var(--ink)] transition-opacity duration-500 ${
            menuOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div className="relative flex h-full flex-col overflow-y-auto px-5 py-4">
          <div className="flex items-center justify-between">
            <div
              className={`transition-opacity duration-500 ${menuOpen ? 'opacity-100' : 'opacity-0'}`}
            >
              <Logo variant="bar" height={40} />
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className={`-mr-1 flex h-10 w-10 items-center justify-center text-[var(--cream)] transition-opacity duration-500 ${
                menuOpen ? 'opacity-100' : 'opacity-0'
              }`}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex flex-1 flex-col justify-center py-8" aria-label="Mobile">
            {NAV_LINKS.map((link, index) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="ff-display flex items-baseline gap-4 border-b border-[var(--ink-line)] py-4 text-[1.85rem] text-[var(--cream)] transition-all duration-500 sm:text-[2.4rem]"
                style={{
                  opacity: menuOpen ? 1 : 0,
                  transform: menuOpen ? 'none' : 'translateY(1rem)',
                  transitionDelay: menuOpen ? `${120 + index * 60}ms` : '0ms',
                }}
              >
                <span className="ff-sans text-[0.65rem] tracking-[0.2em] text-[var(--gold)]">
                  0{index + 1}
                </span>
                {link.label}
              </a>
            ))}
          </nav>

          <div
            className="space-y-4 pb-2 transition-all duration-500"
            style={{ opacity: menuOpen ? 1 : 0, transitionDelay: menuOpen ? '420ms' : '0ms' }}
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onBook();
              }}
              className="shine w-full bg-[var(--gold)] px-6 py-4 text-[0.68rem] font-medium uppercase tracking-[0.24em] text-[var(--ink)]"
            >
              Book Appointment
            </button>
            <div className="flex items-center justify-between text-[0.78rem] text-[var(--cream-muted)]">
              <a href={`tel:+91${CONTACT.phone}`} className="hover:text-[var(--gold-light)]">
                {CONTACT.phone}
              </a>
              <Link to="/admin" className="hover:text-[var(--gold-light)]">
                Staff login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SiteHeader;
