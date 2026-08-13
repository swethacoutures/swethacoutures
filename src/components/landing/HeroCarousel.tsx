import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface HeroFrame {
  src: string;
  alt: string;
  /** object-position, so each subject stays in frame at every aspect ratio. */
  position: string;
}

interface HeroCarouselProps {
  frames: HeroFrame[];
  /** Milliseconds each frame is held. */
  interval?: number;
}

/**
 * The rotating hero background.
 *
 * Every frame is stacked and cross-faded rather than slid, because the headline sits on top
 * of it: a horizontal slide drags the eye sideways and makes the type feel unmoored, while a
 * dissolve leaves the composition still. Each frame also drifts very slowly (a Ken Burns
 * move) so a held image never looks like a frozen JPEG.
 *
 * Three behaviours that matter more than the effect itself:
 *
 *  1. **Only the first frame is eager.** It is the largest paint on the page. The rest are
 *     fetched one ahead of the rotation, so the carousel costs nothing at first load.
 *  2. **It stops when it cannot be seen.** A background timer that keeps swapping images in
 *     a hidden tab burns battery for nobody.
 *  3. **Reduced motion means one still image**, not a slower carousel — the request is for
 *     less movement, and honouring it halfway is not honouring it.
 */
const HeroCarousel: React.FC<HeroCarouselProps> = ({ frames, interval = 6500 }) => {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0]));
  const [paused, setPaused] = useState(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion.current) setPaused(true);
  }, []);

  /** Fetch the next frame slightly before it is needed. */
  const preload = useCallback(
    (target: number) => {
      const frame = frames[target];
      if (!frame || loaded.has(target)) return;
      const image = new Image();
      image.src = frame.src;
      image.onload = () => setLoaded((current) => new Set(current).add(target));
    },
    [frames, loaded]
  );

  useEffect(() => {
    preload((index + 1) % frames.length);
  }, [index, frames.length, preload]);

  /**
   * `index` is a dependency on purpose: every change restarts the clock.
   *
   * Without it the timer keeps its original schedule, so tapping a control could show your
   * chosen frame for a fraction of a second before the next tick replaced it. Choosing a
   * frame should buy you a full turn to look at it.
   */
  useEffect(() => {
    if (paused || frames.length < 2) return;

    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % frames.length);
    }, interval);

    return () => window.clearTimeout(timer);
  }, [index, paused, interval, frames.length]);

  // Stop while the tab is in the background.
  useEffect(() => {
    const onVisibility = () => {
      if (reduceMotion.current) return;
      setPaused(document.hidden);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <>
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {frames.map((frame, position) => {
          const active = position === index;
          return (
            <img
              key={frame.src}
              src={frame.src}
              alt={position === 0 ? frame.alt : ''}
              aria-hidden={position === 0 ? undefined : 'true'}
              width={1100}
              height={1466}
              loading={position === 0 ? 'eager' : 'lazy'}
              // Only the first frame is the LCP candidate.
              {...(position === 0 ? { fetchPriority: 'high' as const } : {})}
              decoding="async"
              style={{ objectPosition: frame.position }}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ease-in-out ${
                active ? 'opacity-100' : 'opacity-0'
              } ${active && !reduceMotion.current ? 'kenburns' : ''}`}
            />
          );
        })}

        {/* Two scrims: one lifts the bottom into the page, one darkens the left so the
            headline has a quiet ground to sit on at every width. */}
        <div
          className="absolute inset-0 bg-[linear-gradient(to_top,var(--ink)_2%,rgba(16,11,7,0.72)_38%,rgba(16,11,7,0.45)_100%)]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,11,7,0.94)_0%,rgba(16,11,7,0.72)_38%,rgba(16,11,7,0.15)_78%,transparent_100%)]"
          aria-hidden="true"
        />
      </div>

      {/* Frame indicators. Thin gold rules rather than dots — they read as a progress
          scale, and they double as controls for anyone who wants a particular image. */}
      {frames.length > 1 && (
        <div className="absolute bottom-16 right-4 z-20 flex items-center gap-2 sm:bottom-20 sm:right-6 lg:right-10">
          {frames.map((frame, position) => (
            <button
              key={frame.src}
              type="button"
              onClick={() => setIndex(position)}
              // A generous tap target around a hairline: the visible rule is 2px tall, the
              // touchable area is 44px, which is the accessible minimum.
              className="group relative h-11 w-8 sm:w-10"
              aria-label={`Show image ${position + 1} of ${frames.length}`}
              aria-current={position === index}
            >
              <span
                className={`absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 transition-all duration-500 ${
                  position === index
                    ? 'bg-[var(--gold)]'
                    : 'bg-[var(--cream)]/30 group-hover:bg-[var(--gold-light)]/70'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </>
  );
};

export default HeroCarousel;
