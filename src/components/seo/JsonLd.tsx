import { BOUTIQUES as SEED_BOUTIQUES } from "@/lib/catalog";
import { getSiteUrl } from "@/lib/site-url";

type JsonLdGraph = Record<string, unknown>;

/** Organization + Baghdad boutique LocalBusiness entries for rich results. */
export function MaisonJsonLd() {
  const siteUrl = getSiteUrl();

  const organization: JsonLdGraph = {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "MUHRA JEWELRY",
    url: siteUrl,
    logo: `${siteUrl}/favicon.ico`,
    description:
      "MUHRA JEWELRY: a Maison of high jewelry, watches and bridal — composed since 1919.",
    sameAs: [],
  };

  const localBusinesses: JsonLdGraph[] = SEED_BOUTIQUES.map((b, i) => ({
    "@type": "JewelryStore",
    "@id": `${siteUrl}/#boutique-${b.id}`,
    name: `MUHRA JEWELRY — ${b.city}`,
    parentOrganization: { "@id": `${siteUrl}/#organization` },
    url: `${siteUrl}/boutiques`,
    telephone: b.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: b.address,
      addressLocality: "Baghdad",
      addressCountry: "IQ",
    },
    openingHours: b.hours,
    image: b.image,
    position: i + 1,
  }));

  const payload = {
    "@context": "https://schema.org",
    "@graph": [organization, ...localBusinesses],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
