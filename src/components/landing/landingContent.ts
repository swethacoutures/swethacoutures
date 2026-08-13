/**
 * What the public site says the atelier does.
 *
 * This is not invented copy. Every service and garment below was read out of the shop's
 * own billing history — the sub-item descriptions on 362 real bills (Stitching, lining,
 * fabric, dye, saree tassels, embroidery, falls, lace, alterations) and the product names
 * on those same bills (blouse, dress, saree, lehenga, dupatta, frock, top, inskirt).
 * The "from" prices are the shop's own configured default rates in
 * `settings/workDescriptions`, so the website quotes the same numbers the bill will.
 *
 * If the shop starts offering something new, add it here — the page reads from this file
 * rather than having copy scattered through the markup.
 */

export interface Service {
  /** Two-digit index, shown as an editorial numeral. */
  no: string;
  title: string;
  blurb: string;
  /** Sub-items as they actually appear on bills. */
  detail: string[];
  /** Lowest configured rate, in rupees. Omitted where the shop quotes per piece. */
  from?: number;
}

export const SERVICES: Service[] = [
  {
    no: '01',
    title: 'Bespoke Stitching',
    blurb:
      'The heart of the house. Blouses, dresses, churidars and lehengas cut to your own measurements and finished by hand.',
    detail: ['Simple blouse', 'Saree blouse', 'Churidar', 'Lehenga', 'Dresses & gowns'],
    from: 500,
  },
  {
    no: '02',
    title: 'Saree Falls & Lining',
    blurb:
      'Falls stitched, lining set and the drape corrected so a saree sits the way it was meant to from the first wear.',
    detail: ['Falls', 'Falls with lining', 'Lining 2×2', 'Can-can & inskirts'],
  },
  {
    no: '03',
    title: 'Fabric Dyeing',
    blurb:
      'Matching a blouse to a saree, refreshing a faded favourite, or taking a length of raw fabric to the exact shade you had in mind.',
    detail: ['Shade matching', 'Full-length dyeing', 'Lace & border dyeing'],
  },
  {
    no: '04',
    title: 'Embroidery & Hand Work',
    blurb:
      'Aari and machine embroidery worked onto blouses, yokes and borders — from a single motif to a fully covered panel.',
    detail: ['Blouse embroidery', 'Yoke & neckline work', 'Border embroidery'],
    from: 800,
  },
  {
    no: '05',
    title: 'Tassels & Knots',
    blurb:
      'Saree kuchu, tassels and knots tied in thread, beads or zari to finish a pallu properly instead of leaving it raw.',
    detail: ['Saree tassels (kuchu)', 'Blouse tassels', 'Lehenga tassels', 'Saree knots'],
  },
  {
    no: '06',
    title: 'Lace, Border & Trims',
    blurb:
      'Laces, borders, piping, buttons and zips sourced and applied — the small things that decide whether a garment looks finished.',
    detail: ['Lace application', 'Contrast borders', 'Buttons, zips & hooks'],
  },
  {
    no: '07',
    title: 'Alterations & Refitting',
    blurb:
      'Anything that no longer fits, whether it was made here or not. Taken in, let out, shortened or reshaped.',
    detail: ['Fitting corrections', 'Length adjustment', 'Size adjustment'],
    from: 150,
  },
];

export interface Product {
  name: string;
  note: string;
  /** Which line-art drawing accompanies the card. */
  art: 'blouse' | 'saree' | 'lehenga' | 'dress' | 'dupatta' | 'frock';
}

export const PRODUCTS: Product[] = [
  {
    name: 'Blouses',
    note: 'Saree blouses, designer backs, princess-cut and padded — the most-made piece in the shop.',
    art: 'blouse',
  },
  {
    name: 'Sarees',
    note: 'Tussar, silk, organza and cotton. Falls, lining, tassels and pre-pleating on request.',
    art: 'saree',
  },
  {
    name: 'Lehengas',
    note: 'Bridal and festive sets cut, lined and can-canned to hold their shape all evening.',
    art: 'lehenga',
  },
  {
    name: 'Dresses & Gowns',
    note: 'Long dresses, A-lines and party gowns stitched from your fabric or ours.',
    art: 'dress',
  },
  {
    name: 'Dupattas & Stoles',
    note: 'Dyed to match, edged with lace, finished with tassels or left plain and simply hemmed well.',
    art: 'dupatta',
  },
  {
    name: 'Frocks & Kidswear',
    note: 'Little occasion frocks with the same finishing as the grown-up pieces.',
    art: 'frock',
  },
];

export interface ProcessStep {
  no: string;
  title: string;
  body: string;
}

export const PROCESS: ProcessStep[] = [
  {
    no: 'I',
    title: 'Consultation',
    body: 'Bring the fabric or the idea. We talk through the neckline, the sleeve, the fall and what the occasion needs.',
  },
  {
    no: 'II',
    title: 'Measurement',
    body: 'A full set of measurements is taken and kept on file, so every later order starts from a known fit.',
  },
  {
    no: 'III',
    title: 'Cutting & Craft',
    body: 'Cut, stitched, lined and hand-finished in our own workroom. Embroidery and dyeing happen in-house.',
  },
  {
    no: 'IV',
    title: 'Trial & Delivery',
    body: 'A trial fitting before delivery, and any correction made on the spot. You leave with the bill in hand.',
  },
];

/** Straight from `settings/business` — the same details that print on every invoice. */
export const CONTACT = {
  name: "Swetha's Couture",
  tagline: 'Bespoke tailoring house',
  phone: '9959494567',
  /** E.164 without the +, which is what wa.me expects. */
  whatsapp: '919959494567',
  email: 'swetha.pydah02@gmail.com',
  addressLines: ['36-4-41, Temple Street', 'Beside Tanishq Showroom', 'Kakinada, Andhra Pradesh'],
  mapsQuery: "Swetha's Couture, Temple Street, Kakinada",
  hours: [
    { days: 'Monday — Saturday', time: '9:00 am — 7:00 pm' },
    { days: 'Sunday', time: 'Closed' },
  ],
};

/** The words that run through the marquee ribbon. All of them are real bill line items. */
export const CRAFT_WORDS = [
  'Stitching',
  'Lining',
  'Dyeing',
  'Saree Tassels',
  'Embroidery',
  'Falls',
  'Lace',
  'Can-can',
  'Borders',
  'Alterations',
  'Kuchu',
  'Inskirts',
];

export const NAV_LINKS = [
  { label: 'The Atelier', href: '#atelier' },
  { label: 'Services', href: '#services' },
  { label: 'What We Make', href: '#products' },
  { label: 'How It Works', href: '#process' },
  { label: 'Visit', href: '#visit' },
];
