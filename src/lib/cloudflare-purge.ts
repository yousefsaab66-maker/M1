/**
 * Soft Cloudflare zone cache purge (no-op without env). Used after staff storefront save.
 */
export async function purgeCloudflareCacheSoft(): Promise<boolean> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!zoneId || !token) return false;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purge_everything: true }),
      },
    );
    const body = (await res.json().catch(() => ({}))) as { success?: boolean };
    return res.ok && body.success !== false;
  } catch {
    return false;
  }
}
