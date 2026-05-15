import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Providers } from "@/components/providers/Providers";

const serif = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

/** Netlify sets `URL` / `DEPLOY_PRIME_URL` at build time; Vercel sets `VERCEL_URL`. */
function metadataBaseUrl(): URL {
  const raw =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (raw) {
    try {
      const base = raw.endsWith("/") ? raw : `${raw}/`;
      return new URL(base);
    } catch {
      /* fall through */
    }
  }
  return new URL("http://localhost:3000/");
}

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl(),
  title: "MUHRA JEWELRY — The Art of Adornment",
  description:
    "MUHRA JEWELRY: a Maison of high jewelry, watches and bridal — composed since 1919.",
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

/** Fresh HTML/RSC payloads — pairs with middleware `CDN-Cache-Control` on Workers. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Catalog is loaded in the browser via `/api/catalog/products` (StoreProvider), not here.
 * Fetching the full product list inside the root layout was blowing Cloudflare Worker CPU/memory
 * limits (Error 1102) when serializing large RSC payloads.
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
        <Providers>
          <Header />
          <main className="site-main flex w-full min-w-0 min-h-0 flex-1 flex-col">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
