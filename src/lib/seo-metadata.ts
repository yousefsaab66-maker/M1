import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE, getSiteUrl } from "@/lib/site-url";

const SITE_NAME = "MUHRA JEWELRY";

export const NOINDEX_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

type PageMetadataInput = {
  title: string;
  description: string;
  /** Storefront path, e.g. `/products/foo`. */
  path: string;
  image?: string;
};

/** Per-page metadata with canonical URL and Open Graph defaults. */
export function buildPageMetadata({
  title,
  description,
  path,
  image,
}: PageMetadataInput): Metadata {
  const canonical = path.startsWith("/") ? path : `/${path}`;
  const ogImage = image?.trim() || DEFAULT_OG_IMAGE;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: absoluteUrl(canonical),
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export const STATIC_PAGE_META: Record<
  string,
  { title: string; description: string }
> = {
  "/": {
    title: "MUHRA JEWELRY — The Art of Adornment",
    description:
      "MUHRA JEWELRY: a Maison of high jewelry, watches and bridal — composed since 1919.",
  },
  "/products": {
    title: "Jewellery & Watches — MUHRA JEWELRY",
    description:
      "Explore the MUHRA catalogue — rings, necklaces, bracelets, watches and bridal creations.",
  },
  "/collections": {
    title: "Collections — MUHRA JEWELRY",
    description:
      "Five living collections — Heritage, Aurora, Solstice, Lumière and Nuit — in dialogue with one another.",
  },
  "/journal": {
    title: "Le Journal — MUHRA JEWELRY",
    description:
      "Letters from the Maison — atelier visits, new collections, archive openings.",
  },
  "/boutiques": {
    title: "Boutiques — MUHRA JEWELRY",
    description:
      "Visit MUHRA JEWELRY in Baghdad — wholesale and retail boutiques across the city.",
  },
  "/story": {
    title: "Our Story — MUHRA JEWELRY",
    description:
      "The Maison's history — high jewelry, watches and bridal composed since 1919.",
  },
  "/watches": {
    title: "Watches — MUHRA JEWELRY",
    description: "Horology from the MUHRA manufacture — chronographs and dress watches.",
  },
  "/bridal": {
    title: "Bridal — MUHRA JEWELRY",
    description: "Bridal rings and ceremonial jewellery from the Maison.",
  },
};

export function staticPageMetadata(path: keyof typeof STATIC_PAGE_META): Metadata {
  const entry = STATIC_PAGE_META[path];
  return buildPageMetadata({ ...entry, path });
}

export { getSiteUrl, SITE_NAME };
