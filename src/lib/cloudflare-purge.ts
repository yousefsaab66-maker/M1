function purgeCredentials(): { zoneId: string; token: string } | null {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!zoneId || !token) return null;
  return { zoneId, token };
}

function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.muhrajewelry.com").replace(/\/$/, "");
}

async function purgeCloudflareCache(body: Record<string, unknown>): Promise<boolean> {
  const creds = purgeCredentials();
  if (!creds) return false;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${creds.zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    const parsed = (await res.json().catch(() => ({}))) as { success?: boolean };
    return res.ok && parsed.success !== false;
  } catch {
    return false;
  }
}

function r2StorefrontJsonUrl(): string | null {
  const r2Base = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim()?.replace(/\/$/, "");
  return r2Base ? `${r2Base}/site/storefront.json` : null;
}

/** Public catalog JSON URLs — targeted purge after staff product save/delete. */
export function catalogEdgeCacheUrls(): string[] {
  const base = siteBaseUrl();
  const urls = [
    `${base}/api/catalog/products`,
    `${base}/api/catalog/products?full=1`,
    `${base}/api/catalog/bootstrap`,
    `${base}/api/staff/bootstrap`,
  ];
  const r2Json = r2StorefrontJsonUrl();
  if (r2Json) urls.push(r2Json);
  return urls;
}

/** Storefront JSON + R2 CDN — targeted purge after staff site/collections save. */
export function storefrontEdgeCacheUrls(): string[] {
  const base = siteBaseUrl();
  const urls = [
    `${base}/api/catalog/storefront`,
    `${base}/api/catalog/bootstrap`,
    `${base}/api/staff/bootstrap`,
  ];
  const r2Json = r2StorefrontJsonUrl();
  if (r2Json) urls.push(r2Json);
  return urls;
}

/** Targeted catalog purge — used after product save/delete (never purge_everything). */
export async function purgeCloudflareCatalogCache(): Promise<boolean> {
  return purgeCloudflareCache({ files: catalogEdgeCacheUrls() });
}

/** Targeted storefront purge — used after staff storefront PUT (never purge_everything). */
export async function purgeCloudflareStorefrontCache(): Promise<boolean> {
  return purgeCloudflareCache({ files: storefrontEdgeCacheUrls() });
}

/** @deprecated Use purgeCloudflareStorefrontCache — kept for import stability. */
export async function purgeCloudflareCacheSoft(): Promise<boolean> {
  return purgeCloudflareStorefrontCache();
}
