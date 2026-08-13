import React from 'react';

/**
 * The site's drawings.
 *
 * The shop has no photography, and stock imagery of other people's garments would be a
 * lie told in pictures. So the visual language is line-art instead: everything here is
 * drawn as a single-weight ink stroke, the way a pattern is chalked onto cloth. Paths
 * carry a `--len` custom property so the `.draw` class in landing.css can run them on
 * with a stroke-dashoffset animation — the drawing stitches itself in.
 */

const strokeProps = {
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  vectorEffect: 'non-scaling-stroke' as const,
};

/* ------------------------------------------------------------------- monogram */

/** The "SC" mark: two initials sharing a needle-thin gold stroke. */
export const Monogram: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 44 44" className={className} aria-hidden="true">
    <circle cx="22" cy="22" r="20.5" stroke="currentColor" strokeWidth="0.9" opacity="0.45" {...strokeProps} />
    <circle
      cx="22"
      cy="22"
      r="17"
      stroke="currentColor"
      strokeWidth="0.7"
      strokeDasharray="3 3"
      opacity="0.7"
      {...strokeProps}
    />
    <text
      x="22"
      y="28.5"
      textAnchor="middle"
      fontFamily="'Cormorant Garamond', Georgia, serif"
      fontSize="16"
      fontStyle="italic"
      fill="currentColor"
    >
      SC
    </text>
  </svg>
);

/* --------------------------------------------------------------- hero drawing */

/**
 * A dress form with a saree pallu falling from the shoulder, and a threaded needle
 * looping in above it. The centrepiece of the hero — it draws itself on load.
 */
export const AtelierForm: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 340 460" className={`draw ${className}`} aria-hidden="true" role="presentation">
    <defs>
      <linearGradient id="atelier-thread" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#9a7830" />
        <stop offset="45%" stopColor="#d9bc72" />
        <stop offset="100%" stopColor="#8c6c2c" />
      </linearGradient>
    </defs>

    {/* Stand: base ellipse, pole, collar. */}
    <ellipse
      cx="170"
      cy="430"
      rx="62"
      ry="11"
      stroke="#17130f"
      strokeWidth="1.1"
      opacity="0.55"
      style={{ ['--len' as string]: '240', animationDelay: '1.5s' }}
      {...strokeProps}
    />
    <path
      d="M170 318 L170 428"
      stroke="#17130f"
      strokeWidth="1.3"
      style={{ ['--len' as string]: '120', animationDelay: '1.3s' }}
      {...strokeProps}
    />
    <path
      d="M156 344 L184 344 M158 356 L182 356"
      stroke="#17130f"
      strokeWidth="1"
      opacity="0.6"
      style={{ ['--len' as string]: '60', animationDelay: '1.6s' }}
      {...strokeProps}
    />

    {/* The form itself. */}
    <path
      d="M146 74 C146 64 152 56 170 56 C188 56 194 64 194 74 L194 84
         C226 92 242 114 244 150 C246 184 236 208 229 232
         C224 254 228 284 235 314 L105 314
         C112 284 116 254 111 232 C104 208 94 184 96 150
         C98 114 114 92 146 84 Z"
      stroke="#17130f"
      strokeWidth="1.6"
      style={{ ['--len' as string]: '1100', animationDelay: '0.15s' }}
      {...strokeProps}
    />

    {/* Princess seams — the detail that makes it read as a tailor's form. */}
    <path
      d="M143 96 C136 150 138 200 132 244 C128 272 130 296 133 314"
      stroke="#17130f"
      strokeWidth="0.9"
      opacity="0.42"
      style={{ ['--len' as string]: '260', animationDelay: '0.9s' }}
      {...strokeProps}
    />
    <path
      d="M197 96 C204 150 202 200 208 244 C212 272 210 296 207 314"
      stroke="#17130f"
      strokeWidth="0.9"
      opacity="0.42"
      style={{ ['--len' as string]: '260', animationDelay: '1s' }}
      {...strokeProps}
    />
    <path
      d="M104 236 C140 224 200 224 236 236"
      stroke="#17130f"
      strokeWidth="0.9"
      opacity="0.42"
      style={{ ['--len' as string]: '150', animationDelay: '1.1s' }}
      {...strokeProps}
    />

    {/* The pallu: cloth thrown over the left shoulder and falling away. */}
    <path
      d="M150 88 C120 118 96 168 84 226 C76 268 70 306 62 344"
      stroke="url(#atelier-thread)"
      strokeWidth="1.8"
      style={{ ['--len' as string]: '340', animationDelay: '0.6s' }}
      {...strokeProps}
    />
    <path
      d="M176 92 C154 132 128 184 116 240 C108 280 102 316 96 350"
      stroke="url(#atelier-thread)"
      strokeWidth="1.4"
      opacity="0.85"
      style={{ ['--len' as string]: '330', animationDelay: '0.75s' }}
      {...strokeProps}
    />
    <path
      d="M62 344 C74 352 84 354 96 350"
      stroke="url(#atelier-thread)"
      strokeWidth="1.4"
      style={{ ['--len' as string]: '60', animationDelay: '1.7s' }}
      {...strokeProps}
    />
    {/* Kuchu — the tassels knotted along the pallu edge. */}
    <path
      d="M64 352 L60 368 M72 355 L69 371 M80 356 L78 372 M88 355 L87 371 M96 352 L96 368"
      stroke="url(#atelier-thread)"
      strokeWidth="1.2"
      style={{ ['--len' as string]: '96', animationDelay: '1.9s' }}
      {...strokeProps}
    />

    {/* Needle and its thread, looping in from the top corner. */}
    <path
      d="M300 44 L246 108"
      stroke="#17130f"
      strokeWidth="1.6"
      style={{ ['--len' as string]: '90', animationDelay: '2s' }}
      {...strokeProps}
    />
    <ellipse
      cx="295"
      cy="50"
      rx="3.4"
      ry="6"
      transform="rotate(-40 295 50)"
      stroke="#17130f"
      strokeWidth="1.1"
      style={{ ['--len' as string]: '32', animationDelay: '2.15s' }}
      {...strokeProps}
    />
    <path
      d="M296 44 C318 32 330 52 312 66 C296 78 274 66 268 48 C262 28 286 12 306 20"
      stroke="url(#atelier-thread)"
      strokeWidth="1.3"
      style={{ ['--len' as string]: '210', animationDelay: '2.2s' }}
      {...strokeProps}
    />
  </svg>
);

/* ------------------------------------------------------------ garment drawings */

const GARMENT_PATHS: Record<string, React.ReactNode> = {
  /* Fitted saree blouse, front view, with darts. */
  blouse: (
    <>
      <path
        d="M40 26 C38 25 37 25 36 25 L21 34 L27 48 L38 43 L36 76 L64 76 L62 43 L73 48 L79 34 L64 25
           C63 25 62 25 60 26 C58 33 55 38 50 38 C45 38 42 33 40 26 Z"
        strokeWidth="1.4"
      />
      <path d="M44 50 C45 58 45 68 44 76" strokeWidth="0.8" opacity="0.45" />
      <path d="M56 50 C55 58 55 68 56 76" strokeWidth="0.8" opacity="0.45" />
      <path d="M50 38 L50 76" strokeWidth="0.7" opacity="0.3" strokeDasharray="3 3" />
    </>
  ),

  /* A length of saree, drawn as a drape with its border and kuchu. */
  saree: (
    <>
      <path d="M30 16 L70 16 C74 46 78 76 80 104 L20 104 C22 76 26 46 30 16 Z" strokeWidth="1.4" />
      <path d="M40 18 C39 46 37 76 34 102" strokeWidth="0.8" opacity="0.4" />
      <path d="M50 18 C50 46 50 76 50 102" strokeWidth="0.8" opacity="0.4" />
      <path d="M60 18 C61 46 63 76 66 102" strokeWidth="0.8" opacity="0.4" />
      <path d="M21 94 L79 94" strokeWidth="1.1" opacity="0.75" />
      <path d="M20.5 99 L79.5 99" strokeWidth="0.7" opacity="0.5" />
      <path
        d="M26 105 L25 112 M36 105 L35 112 M46 105 L46 112 M56 105 L56 112 M66 105 L67 112 M75 105 L76 112"
        strokeWidth="0.9"
        opacity="0.7"
      />
    </>
  ),

  /* Choli and a can-canned skirt. */
  lehenga: (
    <>
      <path
        d="M41 14 C44 20 48 22 50 22 C52 22 56 20 59 14 L66 17 L63 36 L37 36 L34 17 Z"
        strokeWidth="1.3"
      />
      <path d="M37 44 C28 62 21 86 18 108 L82 108 C79 86 72 62 63 44 Z" strokeWidth="1.4" />
      <path d="M44 45 C39 66 35 88 33 107" strokeWidth="0.8" opacity="0.4" />
      <path d="M50 45 L50 107" strokeWidth="0.8" opacity="0.4" />
      <path d="M56 45 C61 66 65 88 67 107" strokeWidth="0.8" opacity="0.4" />
      <path d="M19 100 L81 100" strokeWidth="1" opacity="0.7" />
    </>
  ),

  /* A-line gown with a waist seam. */
  dress: (
    <>
      <path
        d="M42 16 C45 24 48 27 50 27 C52 27 55 24 58 16 L64 19 L61 52 L39 52 L36 19 Z"
        strokeWidth="1.3"
      />
      <path d="M39 52 C33 74 29 94 27 110 L73 110 C71 94 67 74 61 52" strokeWidth="1.4" />
      <path d="M39 52 L61 52" strokeWidth="0.9" opacity="0.5" />
      <path d="M45 54 C41 76 38 96 37 109" strokeWidth="0.8" opacity="0.38" />
      <path d="M55 54 C59 76 62 96 63 109" strokeWidth="0.8" opacity="0.38" />
    </>
  ),

  /* A length of dupatta caught mid-drape, tasselled at both ends. */
  dupatta: (
    <>
      <path d="M16 40 C34 24 62 54 84 34" strokeWidth="1.4" />
      <path d="M16 58 C34 42 62 72 84 52" strokeWidth="1.4" />
      <path d="M16 40 L16 58" strokeWidth="1.2" />
      <path d="M84 34 L84 52" strokeWidth="1.2" />
      <path d="M30 33 C34 42 34 51 31 61" strokeWidth="0.8" opacity="0.4" />
      <path d="M50 44 C52 53 52 62 50 71" strokeWidth="0.8" opacity="0.4" />
      <path d="M68 44 C70 52 70 61 68 70" strokeWidth="0.8" opacity="0.4" />
      <path
        d="M14 60 L13 68 M16 60 L16 68 M18 60 L19 68 M82 54 L81 62 M84 54 L84 62 M86 54 L87 62"
        strokeWidth="0.9"
        opacity="0.7"
      />
    </>
  ),

  /* Little occasion frock with puff sleeves and a scalloped hem. */
  frock: (
    <>
      <path
        d="M41 24 C44 30 47 32 50 32 C53 32 56 30 59 24 L64 27 L62 56 L38 56 L36 27 Z"
        strokeWidth="1.3"
      />
      <path d="M36 27 C29 30 26 36 28 42 C31 46 36 45 38 41" strokeWidth="1.1" />
      <path d="M64 27 C71 30 74 36 72 42 C69 46 64 45 62 41" strokeWidth="1.1" />
      <path d="M38 56 C33 70 30 82 29 92 L71 92 C70 82 67 70 62 56" strokeWidth="1.4" />
      <path
        d="M29 92 C32 98 36 98 39 92 C42 98 46 98 50 92 C54 98 58 98 61 92 C64 98 68 98 71 92"
        strokeWidth="1.1"
      />
      <path d="M38 56 L62 56" strokeWidth="0.9" opacity="0.5" />
    </>
  ),
};

/** One garment drawing, sized by its container. */
export const GarmentArt: React.FC<{ kind: string; className?: string }> = ({
  kind,
  className = '',
}) => (
  <svg
    viewBox="0 0 100 120"
    className={className}
    aria-hidden="true"
    role="presentation"
    stroke="currentColor"
    {...strokeProps}
  >
    {GARMENT_PATHS[kind] ?? GARMENT_PATHS.blouse}
  </svg>
);

/* ----------------------------------------------------------------- decoration */

/** A running-stitch rule with a small diamond at its centre. Separates major sections. */
export const StitchDivider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-4 ${className}`} aria-hidden="true">
    <div className="stitch-rule flex-1" />
    <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-[var(--gold)]">
      <path d="M12 2 L22 12 L12 22 L2 12 Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
    <div className="stitch-rule flex-1" />
  </div>
);

/**
 * The thread that loops behind a section. Purely atmospheric — it gives the flat paper
 * ground some depth without resorting to a blurred colour blob.
 */
export const ThreadLoop: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 400 400" className={className} aria-hidden="true" role="presentation">
    <path
      d="M-20 220 C60 120 160 300 240 180 C300 92 380 140 420 60"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
    />
    <path
      d="M-20 260 C70 170 150 330 250 220 C320 144 390 190 420 110"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.7"
      strokeDasharray="4 6"
      strokeLinecap="round"
      opacity="0.7"
    />
  </svg>
);
