import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { ConditionalStorefrontChrome } from "@/components/layout/ConditionalStorefrontChrome";
import { Providers } from "@/components/providers/Providers";
import { MaisonJsonLd } from "@/components/seo/JsonLd";
import { DEFAULT_OG_IMAGE, getMetadataBase } from "@/lib/site-url";
export { staticPageDynamic as dynamic } from "@/lib/static-page";

const serif = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: "MUHRA JEWELRY — The Art of Adornment",
  description:
    "MUHRA JEWELRY: a Maison of high jewelry, watches and bridal — composed since 1919.",
  alternates: {
    canonical: "/",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "MUHRA JEWELRY — The Art of Adornment",
    description:
      "MUHRA JEWELRY: a Maison of high jewelry, watches and bridal — composed since 1919.",
    type: "website",
    locale: "en_US",
    siteName: "MUHRA JEWELRY",
    url: "/",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "MUHRA JEWELRY — The Art of Adornment",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MUHRA JEWELRY — The Art of Adornment",
    description:
      "MUHRA JEWELRY: a Maison of high jewelry, watches and bridal — composed since 1919.",
    images: [DEFAULT_OG_IMAGE],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

/**
 * Catalog is loaded in the browser via `/api/catalog/products` (StoreProvider), not here.
 * Do not set `force-dynamic` on the root layout — it forces every page through a heavy Worker
 * render and triggers Error 1102 on Cloudflare. Cache busting is handled by `middleware.ts`.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${serif.variable} ${sans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="site-body flex min-h-full min-h-dvh flex-col">
        <MaisonJsonLd />
        <Providers>
          <ConditionalStorefrontChrome>{children}</ConditionalStorefrontChrome>
        </Providers>
      </body>
    </html>
  );
}
