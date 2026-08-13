import React from 'react';

/**
 * The one place the logo is drawn.
 *
 * ── Why there is a `bar` variant ──────────────────────────────────────────────
 * The supplied lockup is 1223×692, and inside it the dress-form mark occupies the full
 * 692px of height while the script "Swetha's Couture" is only about 166px tall. So sizing
 * the lockup by its overall height — the obvious thing to do in a 48px header — renders the
 * name at roughly a fifth of that, and it turns into an illegible gold smudge. Making the
 * whole lockup bigger is not the fix either: the mark then towers over the bar.
 *
 * `bar` solves it by drawing the mark and the wordmark as two images with **independent
 * heights**, so the name can be scaled up relative to the emblem until it is properly
 * readable. That is why `logo-wordmark.png` exists as its own file.
 *
 * ── Why alignment is handled here ─────────────────────────────────────────────
 * Alignment problems with a logo are almost never about the logo, they are about the
 * `<img>` box around it:
 *
 *  1. **`display: block`.** An `<img>` is inline by default, so it sits on the text baseline
 *     and leaves ~4px of descender space underneath. That phantom gap is what makes a logo
 *     look a few pixels high inside a flex row, and no amount of `items-center` fixes it.
 *  2. **A known aspect ratio.** Every file was trimmed to its own artwork, so there is no
 *     transparent padding skewing the shape. Declaring width *and* height from the ratio
 *     means the box is correct before the image loads — nothing shifts, and it is optically
 *     centred from the first paint.
 *  3. **Sizing by height.** Call sites ask for a height and get the right width, which is
 *     what keeps the header, footer, dialog and login page looking like the same logo.
 */

/** Ratios measured from the exported artwork. Re-crop the files and these must be redone. */
const RATIO = {
  lockup: 1223 / 692,
  mark: 99 / 200,
  wordmark: 760 / 137,
} as const;

const SRC = {
  lockup: '/images/logo-lockup.png',
  mark: '/images/logo-mark.png',
  wordmark: '/images/logo-wordmark.png',
} as const;

/**
 * How tall the script is drawn relative to the mark in the `bar` variant.
 *
 * 0.62 was chosen by eye against the real thing: below about 0.5 the script starts losing
 * its hairline strokes at header sizes, and above about 0.7 it overpowers the emblem.
 */
const WORDMARK_SCALE = 0.62;

type Variant = keyof typeof RATIO | 'bar';

interface LogoProps {
  variant?: Variant;
  /** Rendered height in pixels. For `bar` this is the height of the mark. */
  height: number;
  className?: string;
  /** Only the primary logo on a page should be eager; the rest can wait. */
  priority?: boolean;
  /** Decorative when the name is already present as text next to it. */
  decorative?: boolean;
}

const Logo: React.FC<LogoProps> = ({
  variant = 'lockup',
  height,
  className = '',
  priority = false,
  decorative = false,
}) => {
  const loading = priority ? 'eager' : 'lazy';
  // fetchpriority is not in React 18's typings yet, but the browser reads it.
  const priorityAttrs = { fetchpriority: priority ? 'high' : 'auto' } as Record<string, string>;

  if (variant === 'bar') {
    const markWidth = Math.round(height * RATIO.mark);
    const wordHeight = Math.round(height * WORDMARK_SCALE);
    const wordWidth = Math.round(wordHeight * RATIO.wordmark);

    return (
      <span
        className={`inline-flex shrink-0 items-center ${className}`}
        style={{ gap: Math.round(height * 0.18) }}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : "Swetha's Couture"}
        aria-hidden={decorative || undefined}
      >
        <img
          src={SRC.mark}
          width={markWidth}
          height={height}
          style={{ height, width: markWidth }}
          className="block shrink-0 select-none object-contain"
          alt=""
          aria-hidden="true"
          loading={loading}
          {...priorityAttrs}
          decoding="async"
          draggable={false}
        />
        <img
          src={SRC.wordmark}
          width={wordWidth}
          height={wordHeight}
          style={{ height: wordHeight, width: wordWidth }}
          className="block shrink-0 select-none object-contain"
          alt=""
          aria-hidden="true"
          loading={loading}
          {...priorityAttrs}
          decoding="async"
          draggable={false}
        />
      </span>
    );
  }

  const width = Math.round(height * RATIO[variant]);

  return (
    <img
      src={SRC[variant]}
      width={width}
      height={height}
      style={{ height, width }}
      className={`block shrink-0 select-none object-contain ${className}`}
      alt={decorative ? '' : "Swetha's Couture"}
      aria-hidden={decorative || undefined}
      loading={loading}
      {...priorityAttrs}
      decoding="async"
      draggable={false}
    />
  );
};

export default Logo;
