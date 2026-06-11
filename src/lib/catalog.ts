import type { SiteCopyBundle } from "@/lib/site-copy";
import type { ProductSizeOptions } from "@/lib/product-sizes";

export type { ProductSizeOptions } from "@/lib/product-sizes";

export type Category =
  | "necklaces"
  | "rings"
  | "earrings"
  | "bracelets"
  | "watches"
  | "bridal";

/** Staff-defined division (e.g. women's rings) — slug stored on products.category. */
export type CustomCategory = {
  id: string;
  slug: string;
  labelAr: string;
  labelEn: string;
  image?: string;
  /** Optional built-in parent for default imagery / grouping. */
  parentCategory?: Category;
  /** Show tile on homepage category strip (after built-in strip). */
  showInHomeStrip?: boolean;
};

export type Material = "gold" | "platinum" | "silver" | "rose-gold" | "white-gold";
export type Stone =
  | "diamond"
  | "emerald"
  | "ruby"
  | "sapphire"
  | "pearl"
  | "topaz"
  | "amethyst"
  | "none";

export type Currency = "EUR" | "USD" | "AED" | "JPY" | "IQD";

export interface Product {
  id: string;
  slug: string;
  name: string;
  collection: string;
  /** Built-in slug (rings, earrings…) or a custom category slug from site.customCategories. */
  category: string;
  price: number;
  currency: Currency;
  materials: Material[];
  stones: Stone[];
  images: string[];
  /** MP4 / WebM URLs on R2 (e.g. media.muhrajewelry.com). */
  videos?: string[];
  description: string;
  story: string;
  related: string[];
  /** @deprecated Denormalized — prefer `sizeOptions` + {@link resolveProductSizes}. */
  sizes?: string[];
  /** Staff toggles: necklace / bracelet / ring size lists (enabled independently). */
  sizeOptions?: ProductSizeOptions;
  isHighJewelry?: boolean;
  isNew?: boolean;
}

export interface Collection {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  coverImage: string;
  editorialImage: string;
}

export interface JournalArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  image: string;
  author: string;
  date: string;
  category: string;
}

export interface Boutique {
  id: string;
  city: string;
  country: string;
  address: string;
  phone: string;
  hours: string;
  image: string;
}

export type CategoryOverride = {
  /** Display name override (catalogue chips + homepage strip). */
  label?: string;
  /** Tile / chip image URL (R2 or https). */
  image?: string;
  /** Second image (bridal editorial column on /bridal). */
  secondaryImage?: string;
};

export type HomepageConfig = {
  /** Product ids for «Iconic creations» — order preserved. */
  featuredProductIds?: string[];
  /** Collection slug for the homepage featured split block. */
  featuredCollectionSlug?: string;
  /** Maison story column image on the homepage. */
  atelierImage?: string;
};

export interface SiteContent {
  brandName: string;
  tagline: string;
  supportEmail: string;
  heroHeadline: string;
  heroSubhead: string;
  /**
   * Optional override for the homepage hero video. Accepts a remote URL or a
   * `data:` URL (uploaded by staff from their computer). When empty, the bundled
   * `HERO_VIDEO_URL` constant is used.
   */
  heroVideo?: string;
  /** Optional poster image shown before the hero video loads. */
  heroPoster?: string;
  /** Per-category labels and images (staff-managed, synced via Supabase `site_settings`). */
  categories?: Partial<Record<Category, CategoryOverride>>;
  /** Extra catalogue divisions (women's rings, men's watches, etc.). */
  customCategories?: CustomCategory[];
  homepage?: HomepageConfig;
  /** Optional English UI copy overrides (empty field = use i18n). */
  copyEn?: SiteCopyBundle;
  /** Optional Arabic UI copy overrides. */
  copyAr?: SiteCopyBundle;
  /** IQD per 1 USD — updated daily by staff for IQD conversion on the storefront. */
  usdIqdRate?: number;
  /** Flat domestic shipping fee in IQD (Iraq checkout). Falls back to {@link SHIPPING_FEE_IQD}. */
  shippingFeeIqd?: number;
  /** Promotional discount codes managed by staff. */
  discountCodes?: DiscountCode[];
}

export type DiscountAppliesTo = "all" | "products";

export interface DiscountCode {
  id: string;
  code: string;
  percentOff: number;
  appliesTo: DiscountAppliesTo;
  productIds?: string[];
  active: boolean;
  expiresAt?: string;
}

const u = (id: string, w: number = 1600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

/** Engagement rings on stone — Mixkit free license (MUHRA jewelry default). */
export const HERO_VIDEO_URL = "https://assets.mixkit.co/videos/5218/5218-720.mp4";
/** Jewels with gemstones — Mixkit free license (fallback if primary fails). */
export const HERO_VIDEO_FALLBACK = "https://assets.mixkit.co/videos/2865/2865-720.mp4";
export const HERO_POSTER =
  "https://assets.mixkit.co/videos/5218/5218-thumb-720-0.jpg";

export const COLLECTIONS: Collection[] = [
  {
    id: "c1",
    slug: "muhra-heritage",
    name: "MUHRA Heritage",
    tagline: "An ode to the Maison's archive",
    description:
      "Heritage gathers the most emblematic silhouettes of the House — sculpted gold, bevelled diamonds, and the architectural grace that has defined MUHRA since the very beginning. Each piece is a chapter, set in metal and stone.",
    coverImage: u("1599643478518-a784e5dc4c8f", 2000),
    editorialImage: u("1605100804763-247f67b3557e", 2000),
  },
  {
    id: "c2",
    slug: "muhra-aurora",
    name: "MUHRA Aurora",
    tagline: "Light captured in colour",
    description:
      "Aurora celebrates the rare prism of dawn — sapphires set in cascading platinum, emeralds nested in lattices of gold, opals chosen for the slow drift of fire within. A collection composed in the language of light.",
    coverImage: u("1611652022419-a9419f74343d", 2000),
    editorialImage: u("1535632787350-4e68ef0ac584", 2000),
  },
  {
    id: "c3",
    slug: "muhra-solstice",
    name: "MUHRA Solstice",
    tagline: "The longest day, in gold",
    description:
      "Inspired by the Mediterranean noon, Solstice is a study in warmth: brushed yellow gold, citrines like distilled sunlight, and the unbroken curves of forms that recall water and wind. Wearable, daily, alive.",
    coverImage: u("1573408301185-9146fe634ad0", 2000),
    editorialImage: u("1622398925373-3f91b1e275f5", 2000),
  },
  {
    id: "c4",
    slug: "muhra-lumiere",
    name: "MUHRA Lumière",
    tagline: "An archive of brilliance",
    description:
      "Lumière is the Maison's high jewelry vocabulary — singular stones, ateliers measured in months, signatures that travel from hand to hand across generations. Each Lumière creation is numbered and accompanied by its own monograph.",
    coverImage: u("1602173574767-37ac01994b2a", 2000),
    editorialImage: u("1620656798579-1984d9e87df7", 2000),
  },
  {
    id: "c5",
    slug: "muhra-nuit",
    name: "MUHRA Nuit",
    tagline: "Onyx, diamond, midnight",
    description:
      "Nuit is the Maison after dark: high-polish black onyx, brilliant pavé, and lines that recall the geometry of the boulevards at midnight. A counterpoint to gold — quiet, exact, and entirely modern.",
    coverImage: u("1617038220319-276d3cfab638", 2000),
    editorialImage: u("1611591437281-460bfbe1220a", 2000),
  },
];

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    slug: "heritage-pavé-necklace",
    name: "Heritage Pavé Necklace",
    collection: "muhra-heritage",
    category: "necklaces",
    price: 24800,
    currency: "EUR",
    materials: ["white-gold"],
    stones: ["diamond"],
    images: [
      u("1599643478518-a784e5dc4c8f"),
      u("1605100804763-247f67b3557e"),
      u("1611652022419-a9419f74343d"),
      u("1535632787350-4e68ef0ac584"),
    ],
    description:
      "A close-set rivière of round brilliant diamonds, articulated by hand to fall like a single uninterrupted line of light along the collarbone.",
    story:
      "Drawn from the Maison's 1962 archive, the Heritage Pavé is reinterpreted in 18-karat white gold by the Paris atelier. Each diamond is selected for whiteness and clarity within a tight tolerance, then set on a flexible chain that follows the architecture of the neck.",
    related: ["p2", "p4", "p9"],
    isNew: true,
  },
  {
    id: "p2",
    slug: "aurora-emerald-pendant",
    name: "Aurora Emerald Pendant",
    collection: "muhra-aurora",
    category: "necklaces",
    price: 18600,
    currency: "EUR",
    materials: ["platinum", "white-gold"],
    stones: ["emerald", "diamond"],
    images: [
      u("1611652022419-a9419f74343d"),
      u("1573408301185-9146fe634ad0"),
      u("1591348278863-a8fb3887e2aa"),
      u("1601121141461-9d6647bca1ed"),
    ],
    description:
      "A 3.42-carat Colombian emerald, suspended within a halo of 1.18 carats of pavé diamonds, set in polished platinum.",
    story:
      "The Aurora pendant frames a single Colombian emerald chosen for its 'jardin' — the natural inclusions that mark the stone's origin. Set in platinum to keep its chromatic purity, it reads green in daylight, deep forest at night.",
    related: ["p1", "p7", "p11"],
  },
  {
    id: "p3",
    slug: "solstice-cuff-bracelet",
    name: "Solstice Cuff Bracelet",
    collection: "muhra-solstice",
    category: "bracelets",
    price: 12400,
    currency: "EUR",
    materials: ["gold"],
    stones: ["none"],
    images: [
      u("1573408301185-9146fe634ad0"),
      u("1622398925373-3f91b1e275f5"),
      u("1620656798579-1984d9e87df7"),
      u("1631730359585-38a4935cbec4"),
    ],
    description:
      "An architectural cuff in 18-karat brushed yellow gold, hand-finished to a satin grain that catches light without glare.",
    story:
      "The Solstice Cuff is shaped over a single mandrel, then brushed by hand in the Maison's Geneva atelier. The closure is fully hidden, leaving an unbroken line that wraps the wrist like a sleeve of warm gold.",
    related: ["p4", "p10", "p12"],
    sizes: ["XS", "S", "M", "L"],
    isNew: true,
  },
  {
    id: "p4",
    slug: "heritage-trinity-ring",
    name: "Heritage Trinity Ring",
    collection: "muhra-heritage",
    category: "rings",
    price: 4900,
    currency: "EUR",
    materials: ["gold", "white-gold", "rose-gold"],
    stones: ["none"],
    images: [
      u("1535632787350-4e68ef0ac584"),
      u("1599643478518-a784e5dc4c8f"),
      u("1611591437281-460bfbe1220a"),
      u("1606760227091-3dd870d97f1d"),
    ],
    description:
      "Three interlocking bands in yellow, white, and rose 18-karat gold — symbols of friendship, fidelity, and love.",
    story:
      "Created in 1924 and quietly perfected ever since, the Trinity has become a syntax of its own — three colours of gold, three meanings, one continuous line. Worn alone or stacked.",
    related: ["p3", "p9", "p12"],
    sizes: ["48", "50", "52", "54", "56", "58", "60"],
  },
  {
    id: "p5",
    slug: "lumiere-sapphire-earrings",
    name: "Lumière Sapphire Earrings",
    collection: "muhra-lumiere",
    category: "earrings",
    price: 39500,
    currency: "EUR",
    materials: ["platinum"],
    stones: ["sapphire", "diamond"],
    images: [
      u("1602173574767-37ac01994b2a"),
      u("1535632787350-4e68ef0ac584"),
      u("1611652022419-a9419f74343d"),
      u("1633934542430-0905ccb5f050"),
    ],
    description:
      "Two oval Ceylon sapphires, 4.81 and 4.79 carats, framed by graduating brilliant diamonds in platinum.",
    story:
      "From the Lumière atelier, this matched pair of cornflower Ceylon sapphires was identified over the course of a year and finally set this winter. Hand-pierced platinum mounts keep the stones light and the cool blue uninterrupted.",
    related: ["p2", "p7", "p11"],
    isHighJewelry: true,
  },
  {
    id: "p6",
    slug: "nuit-onyx-bangle",
    name: "Nuit Onyx Bangle",
    collection: "muhra-nuit",
    category: "bracelets",
    price: 8900,
    currency: "EUR",
    materials: ["white-gold"],
    stones: ["diamond"],
    images: [
      u("1617038220319-276d3cfab638"),
      u("1611591437281-460bfbe1220a"),
      u("1601121141461-9d6647bca1ed"),
      u("1620656798579-1984d9e87df7"),
    ],
    description:
      "Polished black onyx and pavé diamonds, alternated on a slim white-gold bangle that closes invisibly.",
    story:
      "Nuit is composed entirely after sunset. Black onyx is hand-cut in Idar-Oberstein, then graded for evenness of tone before being set against pavé diamonds. The result is a bangle that reads as a single dark line, lit by points.",
    related: ["p1", "p3", "p10"],
    sizes: ["S", "M", "L"],
  },
  {
    id: "p7",
    slug: "aurora-ruby-ring",
    name: "Aurora Ruby Ring",
    collection: "muhra-aurora",
    category: "rings",
    price: 28700,
    currency: "EUR",
    materials: ["rose-gold"],
    stones: ["ruby", "diamond"],
    images: [
      u("1605100804763-247f67b3557e"),
      u("1622398925373-3f91b1e275f5"),
      u("1571781926291-c477ebfd024b"),
      u("1611591437281-460bfbe1220a"),
    ],
    description:
      "A 2.18-carat Burmese pigeon-blood ruby crowned by tapered baguette diamonds, set in 18-karat rose gold.",
    story:
      "The ruby for this ring was selected for the singular crimson of Mogok. Its setting in rose gold is a deliberate warmth — a frame for the stone's fire rather than a counterpoint to it.",
    related: ["p2", "p5", "p11"],
    sizes: ["48", "50", "52", "54", "56"],
  },
  {
    id: "p8",
    slug: "muhra-tank-watch",
    name: "MUHRA Tank Watch",
    collection: "muhra-heritage",
    category: "watches",
    price: 7900,
    currency: "EUR",
    materials: ["gold"],
    stones: ["none"],
    images: [
      u("1622398925373-3f91b1e275f5"),
      u("1571781926291-c477ebfd024b"),
      u("1543294001-f7cd5d7fb516"),
      u("1583292650898-7d22cd27ca6f"),
    ],
    description:
      "A rectilinear 18-karat yellow gold case, silvered guilloché dial, sapphire crown, and an alligator strap.",
    story:
      "First drawn in 1919 and refined every decade since, the MUHRA Tank reduces a wristwatch to four lines and a face. The current edition is automatic, water-resistant, and made entirely in our Geneva manufacture.",
    related: ["p3", "p4", "p10"],
  },
  {
    id: "p9",
    slug: "bridal-eternal-band",
    name: "Eternal Diamond Band",
    collection: "muhra-heritage",
    category: "bridal",
    price: 5400,
    currency: "EUR",
    materials: ["platinum"],
    stones: ["diamond"],
    images: [
      u("1611591437281-460bfbe1220a"),
      u("1543294001-f7cd5d7fb516"),
      u("1503236823255-94609f598e71"),
      u("1465056836041-7f43ac27dcb5"),
    ],
    description:
      "A continuous channel of round brilliant diamonds, set in 950 platinum — 1.65 carats total.",
    story:
      "The Eternal Band is offered in matched pairs, hand-set so the line of diamonds is unbroken at the join. It is engraved on the inner band with the date you choose.",
    related: ["p4", "p11", "p12"],
    sizes: ["48", "50", "52", "54", "56", "58", "60"],
  },
  {
    id: "p10",
    slug: "solstice-stud-earrings",
    name: "Solstice Gold Studs",
    collection: "muhra-solstice",
    category: "earrings",
    price: 2200,
    currency: "EUR",
    materials: ["gold"],
    stones: ["none"],
    images: [
      u("1631730359585-38a4935cbec4"),
      u("1620656798579-1984d9e87df7"),
      u("1611652022419-a9419f74343d"),
      u("1611085583191-a3b181a88401"),
    ],
    description:
      "Domed studs in 18-karat brushed yellow gold, finished to catch light evenly from any angle.",
    story:
      "The smallest piece in the Solstice family, but composed with the same restraint — a sphere of brushed gold, no setting, no embellishment, only proportion.",
    related: ["p3", "p4", "p12"],
  },
  {
    id: "p11",
    slug: "lumiere-emerald-tiara",
    name: "Lumière Emerald Tiara",
    collection: "muhra-lumiere",
    category: "necklaces",
    price: 184000,
    currency: "EUR",
    materials: ["platinum"],
    stones: ["emerald", "diamond"],
    images: [
      u("1620656798579-1984d9e87df7", 2000),
      u("1611652022419-a9419f74343d"),
      u("1535632787350-4e68ef0ac584"),
      u("1602173574767-37ac01994b2a"),
    ],
    description:
      "A convertible high jewelry creation: tiara, necklace, and brooch. 28.6 carats of emeralds, 14.2 carats of diamonds.",
    story:
      "Eighteen months in the Lumière atelier. The emeralds, all from Muzo, were matched over twelve months. The platinum frame is articulated so the piece may be worn three ways. Numbered I/I and accompanied by its own bound monograph.",
    related: ["p2", "p5", "p7"],
    isHighJewelry: true,
  },
  {
    id: "p12",
    slug: "bridal-solitaire-ring",
    name: "Maison Solitaire",
    collection: "muhra-heritage",
    category: "bridal",
    price: 14800,
    currency: "EUR",
    materials: ["platinum"],
    stones: ["diamond"],
    images: [
      u("1503236823255-94609f598e71"),
      u("1543294001-f7cd5d7fb516"),
      u("1611591437281-460bfbe1220a"),
      u("1465056836041-7f43ac27dcb5"),
    ],
    description:
      "A 1.51-carat round brilliant D-flawless diamond, set on six claws above a slim platinum band.",
    story:
      "The Maison Solitaire is the cleanest expression of the engagement ring as the Maison conceives it: a single stone, lifted, lit, and unornamented.",
    related: ["p4", "p9", "p1"],
    sizes: ["48", "50", "52", "54", "56", "58"],
  },
  {
    id: "p13",
    slug: "nuit-pearl-strand",
    name: "Nuit Tahitian Strand",
    collection: "muhra-nuit",
    category: "necklaces",
    price: 9600,
    currency: "EUR",
    materials: ["white-gold"],
    stones: ["pearl", "diamond"],
    images: [
      u("1576566588028-4147f3842f27"),
      u("1601121141461-9d6647bca1ed"),
      u("1617038220319-276d3cfab638"),
      u("1591348278863-a8fb3887e2aa"),
    ],
    description:
      "Forty-eight Tahitian pearls graduated by tone, finished with a white-gold and pavé diamond clasp.",
    story:
      "The strand is matched over months in the Maison's pearl atelier, where each pearl is judged for orient, then placed by hand along the strand to make a single drift of dark light.",
    related: ["p1", "p2", "p6"],
  },
  {
    id: "p14",
    slug: "heritage-chronograph",
    name: "Heritage Chronograph",
    collection: "muhra-heritage",
    category: "watches",
    price: 18900,
    currency: "EUR",
    materials: ["white-gold"],
    stones: ["none"],
    images: [
      u("1543294001-f7cd5d7fb516"),
      u("1571781926291-c477ebfd024b"),
      u("1622398925373-3f91b1e275f5"),
      u("1583292650898-7d22cd27ca6f"),
    ],
    description:
      "An automatic chronograph in 18-karat white gold, opaline dial, and a hand-stitched alligator strap.",
    story:
      "Designed in the Maison's manufacture and assembled by a single watchmaker, the Heritage Chronograph is delivered numbered and accompanied by its own folio.",
    related: ["p8", "p4", "p3"],
  },
  {
    id: "p15",
    slug: "aurora-sapphire-bracelet",
    name: "Aurora Sapphire Bracelet",
    collection: "muhra-aurora",
    category: "bracelets",
    price: 21400,
    currency: "EUR",
    materials: ["white-gold"],
    stones: ["sapphire", "diamond"],
    images: [
      u("1535632787350-4e68ef0ac584"),
      u("1611652022419-a9419f74343d"),
      u("1620656798579-1984d9e87df7"),
      u("1573408301185-9146fe634ad0"),
    ],
    description:
      "Alternating Ceylon sapphires and diamond clusters in white gold — 8.4 carats sapphire, 3.1 carats diamond.",
    story:
      "Each sapphire is individually selected for tone — a slow afternoon's work for the head of stones — then set in a flexible white-gold cradle that allows the bracelet to drape across the wrist.",
    related: ["p2", "p5", "p7"],
  },
  {
    id: "p16",
    slug: "solstice-link-chain",
    name: "Solstice Link Chain",
    collection: "muhra-solstice",
    category: "necklaces",
    price: 6900,
    currency: "EUR",
    materials: ["gold"],
    stones: ["none"],
    images: [
      u("1611591437281-460bfbe1220a"),
      u("1620656798579-1984d9e87df7"),
      u("1622398925373-3f91b1e275f5"),
      u("1571781926291-c477ebfd024b"),
    ],
    description:
      "A 50-cm chain of architectural rectangular links in 18-karat brushed yellow gold.",
    story:
      "The Solstice Link is composed of slim, rounded rectangles, each one milled and brushed by hand. Worn high on the neck, it reads as a single warm line.",
    related: ["p3", "p10", "p4"],
  },
];

export const JOURNAL: JournalArticle[] = [
  {
    id: "j1",
    slug: "the-art-of-pavé",
    title: "The Art of Pavé",
    excerpt:
      "How the Maison's setters compose surfaces of light from thousands of individual stones — and why it still takes a year of training.",
    body: `In the Paris atelier, the head of pavé works at a small bench by the window, with a loupe, a steel tool no larger than a pin, and a pile of diamonds sorted by size, weight, and refraction. To pavé — literally, to pave — is to set diamonds so closely that the metal between them disappears and what remains is light.

It is the Maison's oldest technique, and the most demanding. Every stone must sit at the same depth, the same plane, the same angle to the light. The setter works freehand, judging each placement by eye, then locks the stone with four micro-prongs raised from the metal. A pavé surface of 1,200 stones may take a single setter a month.

The Heritage Pavé Necklace, reissued this season, is the latest piece in this lineage. Its 1,464 round-brilliant diamonds are set across a flexible articulated chain so that the surface remains continuous as it falls along the neck — a single uninterrupted line of light.`,
    image: u("1599643478518-a784e5dc4c8f", 2000),
    author: "MUHRA Editorial",
    date: "2026-04-12",
    category: "Craftsmanship",
  },
  {
    id: "j2",
    slug: "lumiere-eighteen-months",
    title: "Lumière: An Eighteen-Month Composition",
    excerpt:
      "Inside the slow making of a single high jewelry piece — emeralds matched over a year, then set in a tiara that becomes a necklace, then a brooch.",
    body: `High jewelry is, before anything else, an exercise in patience. The Lumière Emerald Tiara — last winter's flagship piece for the Maison — began as a search for stones. Five emeralds, four ovals and a central cushion, each from Muzo, each chosen for the same particular shade of green: a cool, slightly blue-leaning tone, more spring leaf than evergreen.

The match took twelve months. The setting took six more. The platinum frame is articulated in such a way that the piece can be worn three ways: a tiara above the brow, a necklace at the collar, and — when the central section is unclipped — a single brooch.

It is numbered I/I and accompanied by its own bound monograph. There will not be another.`,
    image: u("1620656798579-1984d9e87df7", 2000),
    author: "Camille Roussel",
    date: "2026-03-04",
    category: "High Jewelry",
  },
  {
    id: "j3",
    slug: "geneva-manufacture",
    title: "A Day at the Geneva Manufacture",
    excerpt:
      "Inside the building where the Tank watches and the Trinity rings are made — a glasshouse on the lake, two floors, eighty hands.",
    body: `The Maison's manufacture in Geneva is a low glasshouse on the south shore of the lake, designed in 1968 and quietly extended four times since. Eighty people work here. Watches are assembled on the upper floor, where the light is best; rings are made on the lower one, in three small ateliers around an internal courtyard.

The Trinity Ring, the Maison's quiet daily emblem, is made entirely on this floor. The three bands — yellow, white, and rose — are drawn separately from rod stock, joined, and finished by hand. A single ring takes eight hours.

There is no music in the workshops. Only the sound of files, then a small file, then a smaller one.`,
    image: u("1611652022419-a9419f74343d", 2000),
    author: "Étienne Mercier",
    date: "2026-02-18",
    category: "Maison",
  },
  {
    id: "j4",
    slug: "stones-and-their-stories",
    title: "Stones and Their Stories",
    excerpt:
      "Why a Burmese ruby is not a Mozambican one, and how the Maison's gemmologist learned to tell them apart.",
    body: `Provenance is the first question the Maison asks of any stone. A ruby may be technically a ruby — corundum coloured by chromium — and yet read entirely differently depending on where it was formed.

The pigeon-blood rubies of Mogok, in Upper Burma, fluoresce gently red under daylight. The Mozambican stones, even at high quality, sit a half-tone darker. To the Maison's chief gemmologist, the difference is immediate; to the rest of us, it is a matter of holding two stones side by side, in turn, against the same neutral grey card.

The Aurora Ruby Ring, set with a 2.18-carat Mogok stone, is the kind of piece that makes the lesson visible.`,
    image: u("1605100804763-247f67b3557e", 2000),
    author: "Dr. Yael Adler",
    date: "2026-01-22",
    category: "Gemmology",
  },
  {
    id: "j5",
    slug: "boutique-paris",
    title: "The Paris Boutique, Reopened",
    excerpt:
      "After eighteen months of restoration, the rue de la Paix flagship returns to its 1923 plan — with one thoughtful addition.",
    body: `The Paris boutique, at the corner of rue de la Paix and rue Daunou, was built in 1923 as a small two-storey commerce. After eighteen months of restoration this winter, it has reopened, returned as closely as possible to its original plan.

The marble floor — the same Carrara as in the Maison's archive photographs — has been re-laid. The brass vitrines, removed in 1986, have been reproduced from the period drawings.

The single addition is a small high jewelry salon at the back of the second floor, lined in oak and lit only by candles in the evening. It is reserved by appointment and seats six.`,
    image: u("1611591437281-460bfbe1220a", 2000),
    author: "MUHRA Editorial",
    date: "2025-12-03",
    category: "Boutiques",
  },
];

export const BOUTIQUES: Boutique[] = [
  {
    id: "b-wholesale-1",
    city: "فرع الجملة · بغداد",
    country: "العراق",
    address: "شارع الرشيد، بغداد",
    phone: "07775277702",
    hours: "جملة — للاستفسار على الرقم أعلاه",
    image: u("1611591437281-460bfbe1220a", 1400),
  },
  {
    id: "b-retail-babylon",
    city: "فرع المفرد · بابلون مول",
    country: "العراق",
    address: "بغداد مول بابلون، الطابق الأوّل",
    phone: "07800020876",
    hours: "مفرد — للاستفسار على الرقم أعلاه",
    image: u("1535632787350-4e68ef0ac584", 1400),
  },
  {
    id: "b-retail-dream",
    city: "فرع المفرد · كول دريم ستي",
    country: "العراق",
    address: "بغداد كول دريم ستي، الطابق الأوّل",
    phone: "07800020876",
    hours: "مفرد — للاستفسار على الرقم أعلاه",
    image: u("1503236823255-94609f598e71", 1400),
  },
];

export const SITE_CONTENT: SiteContent = {
  brandName: "MUHRA JEWELRY",
  tagline: "The Art of Adornment",
  supportEmail: "",
  heroHeadline: "The Art of Adornment",
  heroSubhead:
    "An archive of high jewelry, watches and bridal — composed by the Maison since 1919.",
  categories: {},
  customCategories: [],
  homepage: {
    featuredProductIds: [],
    featuredCollectionSlug: "",
    atelierImage: "",
  },
};
