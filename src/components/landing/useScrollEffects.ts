import { useEffect, useRef, type RefObject } from 'react';

/**
 * Scroll-driven decoration: the reading-progress bar and the parallax on images.
 *
 * One rAF-throttled scroll listener drives both, and it writes CSS custom properties
 * straight onto the elements. Deliberately no React state: a progress bar that re-rendered
 * the page on every scroll frame is the classic way to make a smooth site feel heavy, and
 * these values are pure presentation that React has no reason to know about.
 *
 * Everything is a `transform`, so it stays on the compositor and never triggers layout.
 */
export function useScrollEffects(enabled = true): RefObject<HTMLDivElement> {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Progress is information, so it is kept even under reduced motion; parallax is
    // decoration, so it is not.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let ticking = false;
    let parallaxNodes: HTMLElement[] = [];

    const collect = () => {
      parallaxNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
    };

    const update = () => {
      ticking = false;

      const scrolled = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const progress = total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;

      progressRef.current?.style.setProperty('--progress', String(progress));

      if (reduced) return;

      const viewport = window.innerHeight;
      for (const node of parallaxNodes) {
        const rect = node.getBoundingClientRect();
        // Skip anything off screen: no point computing a transform nobody can see.
        if (rect.bottom < -200 || rect.top > viewport + 200) continue;

        // -1 while the element is entering at the bottom, +1 as it leaves at the top.
        const centre = rect.top + rect.height / 2;
        const offset = (centre - viewport / 2) / (viewport / 2);
        const strength = Number(node.dataset.parallax) || 12;

        node.style.setProperty('--shift', `${(-offset * strength).toFixed(2)}px`);
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    collect();
    update();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    // Sections mount as the page settles, so re-scan once things have quietened down.
    const rescan = window.setTimeout(() => {
      collect();
      update();
    }, 1200);

    return () => {
      window.clearTimeout(rescan);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [enabled]);

  return progressRef;
}
