import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { CONTACT, NAV_LINKS, SERVICES } from './landingContent';
import { Monogram, StitchDivider } from './ornaments';

const year = new Date().getFullYear();

const SiteFooter: React.FC = () => (
  <footer className="relative border-t border-[var(--line)] bg-[var(--paper-warm)] pt-16">
    <div className="mx-auto max-w-[var(--shell)] px-5 sm:px-8 lg:px-12">
      <div className="grid gap-12 lg:grid-cols-12">
        {/* Identity */}
        <div className="lg:col-span-4">
          <div className="flex items-center gap-3">
            <Monogram className="h-10 w-10 text-[var(--madder)]" />
            <span>
              <span className="ff-display block text-[1.5rem] leading-none text-[var(--ink)]">
                Swetha's <span className="italic">Couture</span>
              </span>
              <span className="mt-1.5 block text-[0.5625rem] uppercase tracking-[0.3em] text-[var(--ink-muted)]">
                {CONTACT.tagline}
              </span>
            </span>
          </div>

          <p className="mt-6 max-w-xs text-[0.85rem] leading-relaxed text-[var(--ink-soft)]">
            {CONTACT.addressLines.join(', ')}.
          </p>

          <div className="mt-5 space-y-1.5 text-[0.85rem]">
            <a
              href={`tel:+91${CONTACT.phone}`}
              className="block text-[var(--ink-soft)] transition-colors hover:text-[var(--madder)]"
            >
              {CONTACT.phone}
            </a>
            <a
              href={`mailto:${CONTACT.email}`}
              className="block break-all text-[var(--ink-soft)] transition-colors hover:text-[var(--madder)]"
            >
              {CONTACT.email}
            </a>
          </div>
        </div>

        {/* Navigation */}
        <nav className="lg:col-span-3" aria-label="Footer">
          <h2 className="text-[0.6rem] uppercase tracking-[0.28em] text-[var(--ink-muted)]">
            Explore
          </h2>
          <ul className="mt-5 space-y-2.5">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-[0.88rem] text-[var(--ink-soft)] transition-colors hover:text-[var(--madder)]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Services, so the footer earns its keep for search as well as for readers. */}
        <div className="lg:col-span-3">
          <h2 className="text-[0.6rem] uppercase tracking-[0.28em] text-[var(--ink-muted)]">
            Services
          </h2>
          <ul className="mt-5 space-y-2.5">
            {SERVICES.map((service) => (
              <li key={service.no}>
                <a
                  href="#services"
                  className="text-[0.88rem] text-[var(--ink-soft)] transition-colors hover:text-[var(--madder)]"
                >
                  {service.title}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Hours */}
        <div className="lg:col-span-2">
          <h2 className="text-[0.6rem] uppercase tracking-[0.28em] text-[var(--ink-muted)]">
            Hours
          </h2>
          <ul className="mt-5 space-y-3">
            {CONTACT.hours.map((entry) => (
              <li key={entry.days} className="text-[0.85rem] text-[var(--ink-soft)]">
                <span className="block text-[var(--ink)]">{entry.days}</span>
                <span>{entry.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <StitchDivider className="mt-14" />

      <div className="flex flex-col gap-4 py-7 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.75rem] text-[var(--ink-muted)]">
          © {year} {CONTACT.name}. Kakinada, Andhra Pradesh.
        </p>

        <div className="flex items-center gap-6">
          {/* The only way into the back office from the public site. Deliberately plain:
              it is a staff door, not a feature. */}
          <Link
            to="/admin"
            className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--ink-muted)] transition-colors hover:text-[var(--madder)]"
          >
            Staff Login
          </Link>
          <a
            href="#top"
            className="group flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--ink-muted)] transition-colors hover:text-[var(--madder)]"
          >
            Back to top
            <ArrowUp className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
