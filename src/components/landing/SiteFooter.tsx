import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { CONTACT, NAV_LINKS, SERVICES } from './landingContent';
import Logo from './Logo';

const year = new Date().getFullYear();

const SiteFooter: React.FC = () => (
  <footer className="weave relative border-t border-[var(--ink-line)] bg-[var(--ink-raised)] pt-14 sm:pt-16">
    <div className="mx-auto max-w-[var(--shell)] px-4 sm:px-6 lg:px-10">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
        {/* Identity */}
        <div className="sm:col-span-2 lg:col-span-4">
          <Logo variant="bar" height={58} />

          <p className="mt-6 max-w-xs text-[0.85rem] leading-relaxed text-[var(--cream-muted)]">
            {CONTACT.addressLines.join(', ')}.
          </p>

          <div className="mt-5 space-y-1.5 text-[0.85rem]">
            <a
              href={`tel:+91${CONTACT.phone}`}
              className="block text-[var(--cream-dim)] transition-colors hover:text-[var(--gold-light)]"
            >
              {CONTACT.phone}
            </a>
            <a
              href={`mailto:${CONTACT.email}`}
              className="wrap-anywhere block text-[var(--cream-dim)] transition-colors hover:text-[var(--gold-light)]"
            >
              {CONTACT.email}
            </a>
          </div>
        </div>

        {/* Navigation */}
        <nav className="lg:col-span-3" aria-label="Footer">
          <h2 className="text-[0.58rem] uppercase tracking-[0.28em] text-[var(--cream-faint)]">
            Explore
          </h2>
          <ul className="mt-5 space-y-2.5">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-[0.86rem] text-[var(--cream-dim)] transition-colors hover:text-[var(--gold-light)]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Services, so the footer earns its keep for search as well as for readers. */}
        <div className="lg:col-span-3">
          <h2 className="text-[0.58rem] uppercase tracking-[0.28em] text-[var(--cream-faint)]">
            Services
          </h2>
          <ul className="mt-5 space-y-2.5">
            {SERVICES.map((service) => (
              <li key={service.no}>
                <a
                  href="#services"
                  className="text-[0.86rem] text-[var(--cream-dim)] transition-colors hover:text-[var(--gold-light)]"
                >
                  {service.title}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Hours */}
        <div className="lg:col-span-2">
          <h2 className="text-[0.58rem] uppercase tracking-[0.28em] text-[var(--cream-faint)]">
            Hours
          </h2>
          <ul className="mt-5 space-y-3">
            {CONTACT.hours.map((entry) => (
              <li key={entry.days} className="text-[0.85rem] text-[var(--cream-muted)]">
                <span className="block text-[var(--cream-dim)]">{entry.days}</span>
                <span>{entry.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rule-fade mt-12" />

      <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.74rem] text-[var(--cream-faint)]">
          © {year} {CONTACT.name}. Kakinada, Andhra Pradesh.
        </p>

        <div className="flex items-center gap-6">
          {/* The only way into the back office from the public site. Deliberately plain:
              it is a staff door, not a feature. */}
          <Link
            to="/admin"
            className="text-[0.7rem] uppercase tracking-[0.2em] text-[var(--cream-faint)] transition-colors hover:text-[var(--gold-light)]"
          >
            Staff Login
          </Link>
          <a
            href="#top"
            className="group flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.2em] text-[var(--cream-faint)] transition-colors hover:text-[var(--gold-light)]"
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
