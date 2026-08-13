import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Phone } from 'lucide-react';
import { CONTACT, NAV_LINKS } from './landingContent';
import { Monogram } from './ornaments';

interface SiteHeaderProps {
  onBook: () => void;
}

/**
 * The site header.
 *
 * Transparent over the hero so the drawing behind it is not boxed in, then it takes on
 * the paper ground and a gold hairline once the page scrolls — the change is what tells
 * you the bar is now floating over content rather than sitting in it.
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

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'border-b border-[var(--gold)]/25 bg-[var(--paper)]/92 backdrop-blur-md'
            : 'border-b border-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-[var(--shell)] items-center justify-between gap-6 px-5 py-4 sm:px-8 lg:px-12">
          <a
            href="#top"
            className="group flex items-center gap-3"
            aria-label={`${CONTACT.name} — home`}
          >
            <Monogram className="h-9 w-9 shrink-0 text-[var(--madder)] transition-transform duration-500 group-hover:rotate-[8deg]" />
            <span className="leading-none">
              <span className="ff-display block text-[1.35rem] tracking-tight text-[var(--ink)] sm:text-[1.5rem]">
                Swetha's <span className="italic">Couture</span>
              </span>
              <span className="mt-1 block text-[0.5625rem] uppercase tracking-[0.32em] text-[var(--ink-muted)]">
                Kakinada · Est. Atelier
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                data-active={activeSection === link.href}
                className="link-stitch text-[0.7rem] font-medium uppercase tracking-[0.2em] text-[var(--ink-soft)] transition-colors duration-300 hover:text-[var(--madder)] data-[active=true]:text-[var(--madder)]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href={`tel:+91${CONTACT.phone}`}
              className="hidden items-center gap-2 text-[0.78rem] tracking-wide text-[var(--ink-soft)] transition-colors hover:text-[var(--madder)] md:flex"
            >
              <Phone className="h-3.5 w-3.5" />
              {CONTACT.phone}
            </a>

            <button
              type="button"
              onClick={onBook}
              className="hidden bg-[var(--madder)] px-5 py-3 text-[0.65rem] font-medium uppercase tracking-[0.22em] text-[var(--paper-warm)] transition-colors duration-300 hover:bg-[var(--madder-bright)] sm:block"
            >
              Book Appointment
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center text-[var(--ink)] lg:hidden"
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu — a full sheet of ink rather than a dropdown, so the small screen
          gets the same sense of occasion the desktop layout has. */}
      <div
        className={`fixed inset-0 z-[60] lg:hidden ${menuOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!menuOpen}
      >
        <div
          className={`weave absolute inset-0 bg-[var(--ink)] transition-opacity duration-500 ${
            menuOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div className="relative flex h-full flex-col px-6 py-5">
          <div className="flex items-center justify-between">
            <Monogram
              className={`h-9 w-9 text-[var(--gold-light)] transition-opacity duration-500 ${
                menuOpen ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className={`flex h-10 w-10 items-center justify-center text-[var(--paper)] transition-opacity duration-500 ${
                menuOpen ? 'opacity-100' : 'opacity-0'
              }`}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex flex-1 flex-col justify-center gap-1" aria-label="Mobile">
            {NAV_LINKS.map((link, index) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="ff-display border-b border-[var(--paper)]/10 py-4 text-[2rem] text-[var(--paper)] transition-all duration-500 sm:text-[2.5rem]"
                style={{
                  opacity: menuOpen ? 1 : 0,
                  transform: menuOpen ? 'none' : 'translateY(1rem)',
                  transitionDelay: menuOpen ? `${120 + index * 60}ms` : '0ms',
                }}
              >
                <span className="mr-4 align-super text-[0.7rem] tracking-[0.2em] text-[var(--gold)]">
                  0{index + 1}
                </span>
                {link.label}
              </a>
            ))}
          </nav>

          <div
            className="space-y-4 pb-4 transition-all duration-500"
            style={{
              opacity: menuOpen ? 1 : 0,
              transitionDelay: menuOpen ? '420ms' : '0ms',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onBook();
              }}
              className="w-full bg-[var(--madder)] px-6 py-4 text-[0.7rem] font-medium uppercase tracking-[0.24em] text-[var(--paper-warm)]"
            >
              Book Appointment
            </button>
            <div className="flex items-center justify-between text-[0.78rem] text-[var(--paper)]/60">
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
