import React, { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: React.ReactNode;
  /** Milliseconds to stagger this element behind its neighbours. */
  delay?: number;
  className?: string;
  as?: 'div' | 'li' | 'article' | 'section' | 'figure';
}

/**
 * One shared scroll watcher for every Reveal on the page.
 *
 * The obvious implementation is an IntersectionObserver per element, and it has a bug that
 * hides content permanently: the observer only fires when an element *crosses* a threshold
 * during a sampled frame. Scroll further than one viewport in a single jump — a flick on a
 * phone, a scrollbar drag, an anchor link — and an element can go from below the fold to
 * above it without ever being sampled as visible. Its ratio reads 0 both times, no callback
 * runs, and the element stays at `opacity: 0` for the rest of the visit. That was reproduced
 * on the real page: two blocks of the Atelier section never appeared on a phone.
 *
 * So the test is a plain geometry check — "has this element's top ever been above the
 * bottom of the viewport" — which is true whether you crept past it or flew past it. One
 * rAF-throttled listener serves every element, and each unsubscribes as it fires, so a long
 * page does not accumulate work.
 */
type Waiter = { el: HTMLElement; show: () => void };

const waiting = new Set<Waiter>();
let scheduled = false;
let listening = false;

/** Reveal a little before the element reaches the very bottom edge. */
const TRIGGER_INSET = 0.08;

function sweep() {
  scheduled = false;
  const limit = window.innerHeight * (1 - TRIGGER_INSET);

  for (const waiter of [...waiting]) {
    const rect = waiter.el.getBoundingClientRect();
    // `rect.top < limit` covers "coming into view"; anything already scrolled past has a
    // negative top and matches too, which is the case the observer version lost.
    if (rect.top < limit) {
      waiting.delete(waiter);
      waiter.show();
    }
  }

  if (waiting.size === 0 && listening) {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    listening = false;
  }
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(sweep);
}

function watch(waiter: Waiter): () => void {
  waiting.add(waiter);

  if (!listening) {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    listening = true;
  }

  schedule();
  return () => {
    waiting.delete(waiter);
  };
}

/**
 * Fades and lifts its children in the first time they reach the viewport.
 *
 * The transition itself lives in landing.css so the reduced-motion media query can switch
 * the whole effect off in one place rather than every component checking a flag.
 */
const Reveal: React.FC<RevealProps> = ({ children, delay = 0, className = '', as = 'div' }) => {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    // No element yet, or no browser APIs (a test renderer): show rather than hide. Content
    // that depends on JS to become visible must fail open.
    if (!node || typeof window === 'undefined') {
      setVisible(true);
      return;
    }

    return watch({ el: node, show: () => setVisible(true) });
  }, []);

  const Tag = as as React.ElementType;

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
};

export default Reveal;
