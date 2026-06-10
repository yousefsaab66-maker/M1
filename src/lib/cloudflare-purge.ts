function purgeCredentials(): { zoneId: string; token: string } | null {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!zoneId || !token) return null;
  return { zoneId, token };
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

/** Public catalog JSON URLs — purge after product save/delete for immediate `/products` updates. */
export function catalogEdgeCacheUrls(): string[] {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.muhrajewelry.com").replace(/\/$/, "");
  return [
    `${base}/api/catalog/products`,
    `${base}/api/catalog/products?full=1`,
    `${base}/api/catalog/bootstrap`,
    `${base}/api/catalog/storefront`,
    `${base}/api/staff/bootstrap`,
  ];
}

/** Targeted purge — lighter than purge_everything; used after product save/delete. */
export async function purgeCloudflareCatalogCache(): Promise<boolean> {
  return purgeCloudflareCache({ files: catalogEdgeCacheUrls() });
}

/**
 * Soft Cloudflare zone cache purge (no-op without env). Used after staff storefront save.
 */
export async function purgeCloudflareCacheSoft(): Promise<boolean> {
  return purgeCloudflareCache({ purge_everything: true });
}
