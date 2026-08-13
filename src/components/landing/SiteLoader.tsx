import React, { useEffect, useRef, useState } from 'react';

/** Once per browser session — a loader you sit through twice stops being a flourish. */
const SESSION_KEY = 'sc-intro-played';

/** Never hold the page longer than this, whatever the network is doing. */
const HARD_LIMIT = 2600;

/** The shortest run that still reads as intentional rather than as a flicker. */
const MIN_SHOW = 1500;

interface SiteLoaderProps {
  /** Called once the curtain has lifted, so the page can start its own entrance. */
  onDone?: () => void;
}

/**
 * The opening curtain.
 *
 * A loader's job is to make the wait feel intended. This one draws the mark, writes the
 * name in underneath it, runs a bar of light across the gold, and then splits down the
 * middle to reveal the site — the two halves parting like fabric being drawn back.
 *
 * The rules it obeys, which matter more than the animation:
 *
 *  1. **It never traps anyone.** The curtain lifts on whichever comes first: the hero image
 *     finishing, or `HARD_LIMIT`. A slow connection gets the site, not a longer logo.
 *  2. **Once per session.** Stored in sessionStorage, so navigating back to the home page
 *     from the admin login does not replay it.
 *  3. **Reduced motion skips it entirely** — it is pure decoration, and the setting says
 *     decoration is unwelcome.
 *  4. **It does not block scrolling forever.** `overflow: hidden` on the body is released in
 *     the same effect that removes the curtain, including on unmount.
 */
const SiteLoader: React.FC<SiteLoaderProps> = ({ onDone }) => {
  const [active, setActive] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let alreadyPlayed = false;
    try {
      alreadyPlayed = window.sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      // Private browsing can throw on sessionStorage; treat it as "not played".
    }

    if (reduced || alreadyPlayed) {
      onDone?.();
      return;
    }

    setActive(true);
    document.body.style.overflow = 'hidden';

    const startedAt = Date.now();

    const finish = () => {
      if (finished.current) return;
      finished.current = true;

      // Hold the floor for a moment even on a warm cache, so it reads as a reveal.
      const remaining = Math.max(0, MIN_SHOW - (Date.now() - startedAt));
      window.setTimeout(() => {
        setLeaving(true);
        try {
          window.sessionStorage.setItem(SESSION_KEY, '1');
        } catch {
          /* nothing to do */
        }
        // Matches the curtain transition below.
        window.setTimeout(() => {
          setActive(false);
          document.body.style.overflow = '';
          onDone?.();
        }, 1000);
      }, remaining);
    };

    // Whichever happens first: the hero's first frame arrives, or we run out of patience.
    const hero = new Image();
    hero.src = '/images/hero-1.webp';
    if (hero.complete) finish();
    else {
      hero.onload = finish;
      hero.onerror = finish;
    }

    const limit = window.setTimeout(finish, HARD_LIMIT);

    return () => {
      window.clearTimeout(limit);
      document.body.style.overflow = '';
    };
  }, [onDone]);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="status"
      aria-live="polite"
      aria-label="Loading Swetha's Couture"
    >
      {/* The two curtain halves. They part rather than fade, which is the one gesture that
          belongs to a tailoring house. */}
      <div
        className={`weave absolute inset-y-0 left-0 w-1/2 bg-[var(--ink)] transition-transform duration-[1000ms] ease-[cubic-bezier(0.76,0,0.24,1)] ${
          leaving ? '-translate-x-full' : 'translate-x-0'
        }`}
      />
      <div
        className={`weave absolute inset-y-0 right-0 w-1/2 bg-[var(--ink)] transition-transform duration-[1000ms] ease-[cubic-bezier(0.76,0,0.24,1)] ${
          leaving ? 'translate-x-full' : 'translate-x-0'
        }`}
      />

      {/* A hairline seam where the halves meet, so the split reads as deliberate. */}
      <div
        className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[var(--gold)]/50 to-transparent transition-opacity duration-500 ${
          leaving ? 'opacity-0' : 'opacity-100'
        }`}
        aria-hidden="true"
      />

      <div
        className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 ${
          leaving ? 'scale-105 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* The mark drops in first… */}
        <img
          src="/images/logo-mark.png"
          alt=""
          aria-hidden="true"
          width={45}
          height={91}
          className="intro-mark block h-[91px] w-[45px] object-contain sm:h-[110px] sm:w-[55px]"
        />

        {/* …then the name is written in under it, behind a sweep of light. */}
        <div className="intro-word sheen relative mt-5 overflow-hidden">
          <img
            src="/images/logo-wordmark.png"
            alt=""
            aria-hidden="true"
            width={222}
            height={40}
            className="block h-[34px] w-[189px] object-contain sm:h-[42px] sm:w-[233px]"
          />
        </div>

        {/* A thread drawing itself across, which is also the progress cue. */}
        <div className="intro-rule mt-7 h-px w-[140px] origin-left bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent sm:w-[200px]" />

        <p className="intro-caption mt-5 text-[0.58rem] uppercase tracking-[0.42em] text-[var(--cream-faint)]">
          Kakinada
        </p>
      </div>
    </div>
  );
};

export default SiteLoader;
