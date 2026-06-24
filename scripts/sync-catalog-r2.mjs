/**
 * Manual R2 catalog sync — patches `site/storefront.json` `catalogProducts` from Supabase.
 *
 * Direct mode (default, no browser login):
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME — optional, defaults to muhra-media
 *
 * Remote mode (optional — POST production Worker API):
 *   STAFF_SYNC_SECRET + NEXT_PUBLIC_SITE_URL
 *
 * Optional cache purge after sync:
 *   CLOUDFLARE_ZONE_ID + CLOUDFLARE_API_TOKEN
 *
 * Usage:
 *   node --env-file=.env.local scripts/sync-catalog-r2.mjs
 *   npm run sync-catalog-r2
 */

import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const STOREFRONT_R2_KEY = "site/storefront.json";
const LIST_SELECT =
  "id,slug,name,collection_slug,category,price,stock,price_options,currency,materials,stones,images,videos,sizes,size_options,is_high_jewelry,is_new";

const MUHRA_PLACEHOLDER_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F6F1E7"/><stop offset="100%" stop-color="#E8E0D2"/></linearGradient></defs><rect fill="url(#g)" width="800" height="1000"/><ellipse cx="400" cy="410" rx="140" ry="160" fill="none" stroke="#B89A5E" stroke-width="1.5" opacity="0.4"/><text x="400" y="670" text-anchor="middle" font-family="Georgia,serif" font-size="20" letter-spacing="0.28em" fill="#B89A5E">MUHRA</text></svg>`,
  );

const SIZE_KINDS = ["necklace", "bracelet", "ring"];

function mediaOrigin() {
  const base =
    process.env.R2_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim() ||
    "https://media.muhrajewelry.com";
  return base.replace(/\/$/, "");
}

function normalizeStaffMediaUrl(raw) {
  let v = raw.replace(/[\u200e\u200f\u202a-\u202e]/g, "").trim();
  if (!v || v.startsWith("data:") || v.startsWith("blob:")) return v;
  if (!/^https?:\/\//i.test(v)) {
    const idx = v.toLowerCase().indexOf("http");
    if (idx > 0) v = v.slice(idx);
  }
  if (v.startsWith("//")) v = `https:${v}`;
  const origin = mediaOrigin();
  if (!/^https?:\/\//i.test(v)) {
    if (/^(site|products|hero|journal)(\/|$)/i.test(v)) {
      return `${origin}/${v.replace(/^\/+/, "")}`;
    }
    if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}/i.test(v)) v = `https://${v}`;
  }
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return v;
    if (
      (u.hostname === "muhrajewelry.com" || u.hostname === "www.muhrajewelry.com") &&
      /^\/(site|products|hero|journal)\//.test(u.pathname)
    ) {
      const media = new URL(origin);
      media.pathname = u.pathname.replace(/\/{2,}/g, "/");
      return media.href;
    }
    u.pathname = u.pathname.replace(/\/{2,}/g, "/");
    return u.href;
  } catch {
    return v;
  }
}

function normalizeCatalogImageUrl(src) {
  const t = src.trim();
  if (!t || t.startsWith("data:")) return t;
  if (!t.startsWith("http://") && !t.startsWith("https://")) {
    return normalizeStaffMediaUrl(t);
  }
  try {
    const u = new URL(t);
    u.pathname = u.pathname.replace(/\/{2,}/g, "/");
    return u.href;
  } catch {
    return normalizeStaffMediaUrl(t);
  }
}

function normalizeCatalogVideoUrl(src) {
  const t = src.trim();
  if (!t || t.startsWith("data:")) return t;
  if (!t.startsWith("http://") && !t.startsWith("https://")) {
    return normalizeStaffMediaUrl(t);
  }
  try {
    const u = new URL(t);
    u.pathname = u.pathname.replace(/\/{2,}/g, "/");
    return u.href;
  } catch {
    return normalizeStaffMediaUrl(t);
  }
}

function dedupeSizes(list) {
  if (!list) return undefined;
  const out = [...new Set(list.map((s) => s.trim()).filter(Boolean))];
  return out.length > 0 ? out : undefined;
}

function normalizeSizeOptions(opts) {
  if (!opts) return undefined;
  const out = {};
  for (const kind of SIZE_KINDS) {
    const list = dedupeSizes(opts[kind]);
    if (list) out[kind] = list;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function productSizeKindForCategory(category) {
  if (category === "necklaces") return "necklace";
  if (category === "bracelets") return "bracelet";
  if (category === "rings" || category === "bridal") return "ring";
  return null;
}

function legacySizesToOptions(sizes, category) {
  const list = dedupeSizes(sizes);
  if (!list) return undefined;
  const kind = productSizeKindForCategory(category);
  if (!kind) return undefined;
  return { [kind]: list };
}

function sizeOptionsFromRow(sizeOptions, legacySizes, category) {
  const fromCol = normalizeSizeOptions(sizeOptions ?? undefined);
  if (fromCol) return fromCol;
  return legacySizesToOptions(legacySizes ?? undefined, category);
}

function flattenSizeOptions(opts) {
  const normalized = normalizeSizeOptions(opts);
  if (!normalized) return [];
  const merged = [];
  for (const kind of SIZE_KINDS) {
    for (const s of normalized[kind] ?? []) merged.push(s);
  }
  return [...new Set(merged)];
}

function resolveProductSizes(product) {
  const opts = normalizeSizeOptions(product.sizeOptions);
  if (opts) {
    const groups = SIZE_KINDS.filter((k) => opts[k]?.length).map((k) => ({
      kind: k,
      sizes: opts[k],
    }));
    if (groups.length === 1) return groups[0].sizes;
    if (groups.length > 1) return flattenSizeOptions(opts);
  }
  const legacy = product.sizes?.length
    ? [...new Set(product.sizes.map((s) => s.trim()).filter(Boolean))]
    : [];
  return legacy;
}

function stableProductSlug(p) {
  const trimmed = (p.slug ?? "").trim();
  if (trimmed) return trimmed;
  const idPart = p.id.replace(/^tmp-/, "").replace(/-/g, "").slice(0, 12);
  return `muhra-${idPart || "item"}`;
}

function ensureProductOrderable(p) {
  const slug = stableProductSlug(p);
  const imgs = (p.images ?? []).map((u) => u.trim()).filter(Boolean);
  const images = imgs.length > 0 ? imgs : [MUHRA_PLACEHOLDER_IMAGE];
  const vids = (p.videos ?? []).map((u) => u.trim()).filter(Boolean);
  const videos = vids.length > 0 ? vids : undefined;
  const sizeOptions = normalizeSizeOptions(p.sizeOptions);
  const resolved = resolveProductSizes({ ...p, sizeOptions });
  const sizes = resolved.length > 0 ? resolved : undefined;
  const flat = flattenSizeOptions(sizeOptions);
  return {
    ...p,
    slug,
    images,
    videos,
    sizeOptions,
    sizes: sizes ?? (flat.length > 0 ? flat : undefined),
  };
}

function sanitizeProductForCatalogApi(p) {
  const normalized = ensureProductOrderable(p);
  const images = (normalized.images ?? []).map((u) => {
    const t = u.trim();
    if (!t) return t;
    if (t.startsWith("data:")) return t === MUHRA_PLACEHOLDER_IMAGE ? t : MUHRA_PLACEHOLDER_IMAGE;
    return normalizeCatalogImageUrl(t);
  });
  const videos = (normalized.videos ?? [])
    .map((u) => u.trim())
    .filter((u) => u && !u.startsWith("data:"))
    .map(normalizeCatalogVideoUrl);
  return { ...normalized, images, videos: videos.length > 0 ? videos : undefined };
}

function rowToProductList(row) {
  const images = row.images ?? [];
  const videos = row.videos && row.videos.length > 0 ? row.videos : undefined;
  const sizeOptions = sizeOptionsFromRow(row.size_options, row.sizes, row.category);
  const resolvedSizes = resolveProductSizes({
    category: row.category,
    sizeOptions,
    sizes: row.sizes ?? undefined,
  });
  const stock = row.stock == null ? undefined : Math.max(0, Math.floor(Number(row.stock) || 0));
  const priceOptions =
    Array.isArray(row.price_options) && row.price_options.some((s) => s?.enabled && Number(s?.amount) > 0)
      ? row.price_options
      : undefined;
  return ensureProductOrderable({
    id: row.id,
    slug: row.slug,
    name: row.name,
    collection: row.collection_slug,
    category: row.category,
    price: Number(row.price),
    stock,
    priceOptions,
    currency: row.currency,
    materials: row.materials ?? [],
    stones: row.stones ?? [],
    images: images.length > 0 ? [images[0]] : [],
    videos,
    description: "",
    story: "",
    related: [],
    sizeOptions,
    sizes: resolvedSizes.length > 0 ? resolvedSizes : undefined,
    isHighJewelry: row.is_high_jewelry,
    isNew: row.is_new,
  });
}

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim() || "muhra-media";
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function createR2Client(cfg) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
}

async function fetchCatalogProducts() {
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    throw new Error("missing_supabase_config");
  }
  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb
    .from("products")
    .select(LIST_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`catalog_fetch_failed: ${error.message}`);
  return (data ?? []).map((row) => sanitizeProductForCatalogApi(rowToProductList(row)));
}

async function readStorefrontFromR2(client, bucket) {
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: STOREFRONT_R2_KEY }));
    const text = await res.Body?.transformToString("utf-8");
    if (!text) return null;
    const parsed = JSON.parse(text);
    if (parsed?.site && Array.isArray(parsed.collections)) return parsed;
    return null;
  } catch (e) {
    if (e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}

async function writeStorefrontCatalog(client, bucket, storefront, products) {
  const catalogUpdatedAt = new Date().toISOString();
  const payload = {
    ...storefront,
    catalogProducts: products,
    catalogUpdatedAt,
  };
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: STOREFRONT_R2_KEY,
      Body: JSON.stringify(payload),
      ContentType: "application/json; charset=utf-8",
      CacheControl: "public, max-age=60",
    }),
  );
  return catalogUpdatedAt;
}

function wranglerBucket() {
  return process.env.R2_BUCKET_NAME?.trim() || "muhra-media";
}

function runWrangler(args) {
  const localWrangler =
    process.platform === "win32"
      ? join(process.cwd(), "node_modules", ".bin", "wrangler.cmd")
      : join(process.cwd(), "node_modules", ".bin", "wrangler");
  const quoted = args.map((a) => (/\s/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a));
  const cmd = existsSync(localWrangler)
    ? [localWrangler, ...quoted].join(" ")
    : `npx wrangler ${quoted.join(" ")}`;
  execSync(cmd, { stdio: "pipe", shell: true });
}

function readStorefrontViaWrangler(bucket) {
  const dir = mkdtempSync(join(tmpdir(), "muhra-sync-"));
  const file = join(dir, "storefront.json");
  try {
    runWrangler(["r2", "object", "get", `${bucket}/${STOREFRONT_R2_KEY}`, "--remote", "--file", file]);
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (parsed?.site && Array.isArray(parsed.collections)) return parsed;
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeStorefrontViaWrangler(bucket, storefront, products) {
  const catalogUpdatedAt = new Date().toISOString();
  const payload = { ...storefront, catalogProducts: products, catalogUpdatedAt };
  const dir = mkdtempSync(join(tmpdir(), "muhra-sync-"));
  const file = join(dir, "storefront.json");
  try {
    writeFileSync(file, JSON.stringify(payload));
    runWrangler([
      "r2",
      "object",
      "put",
      `${bucket}/${STOREFRONT_R2_KEY}`,
      "--remote",
      "--file",
      file,
      "--content-type",
      "application/json; charset=utf-8",
      "--cache-control",
      "public, max-age=60",
    ]);
    return catalogUpdatedAt;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function syncDirect() {
  const r2Cfg = getR2Config();
  if (!r2Cfg) throw new Error("missing_r2_config");

  const [products, client] = [await fetchCatalogProducts(), createR2Client(r2Cfg)];
  const storefront = await readStorefrontFromR2(client, r2Cfg.bucket);
  if (!storefront) throw new Error("no_storefront");

  const catalogUpdatedAt = await writeStorefrontCatalog(client, r2Cfg.bucket, storefront, products);
  return { catalogUpdatedAt, productCount: products.length, mode: "direct" };
}

async function syncWrangler() {
  const bucket = wranglerBucket();
  const products = await fetchCatalogProducts();
  const storefront = readStorefrontViaWrangler(bucket);
  if (!storefront) throw new Error("no_storefront");
  const catalogUpdatedAt = writeStorefrontViaWrangler(bucket, storefront, products);
  return { catalogUpdatedAt, productCount: products.length, mode: "wrangler" };
}

async function syncRemote() {
  const secret = process.env.STAFF_SYNC_SECRET?.trim();
  const siteBase = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.muhrajewelry.com").replace(
    /\/$/,
    "",
  );
  if (!secret || secret.length < 16) throw new Error("missing_staff_sync_secret");

  const res = await fetch(`${siteBase}/api/staff/sync-catalog-r2`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new Error(`remote_sync_failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return { catalogUpdatedAt: body.catalogUpdatedAt, mode: "remote" };
}

async function purgeCatalogCache() {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!zoneId || !token) return;

  const siteBase = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.muhrajewelry.com").replace(
    /\/$/,
    "",
  );
  const r2Base = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim()?.replace(/\/$/, "");
  const files = [
    `${siteBase}/api/catalog/products`,
    `${siteBase}/api/catalog/products?full=1`,
    `${siteBase}/api/catalog/bootstrap`,
    `${siteBase}/api/catalog/storefront`,
    `${siteBase}/api/staff/bootstrap`,
  ];
  if (r2Base) files.push(`${r2Base}/site/storefront.json`);

  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ files }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    console.warn("Cloudflare purge skipped or failed:", res.status, body);
  } else {
    console.log("Cloudflare catalog cache purge requested.");
  }
}

function hasDirectConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return Boolean(supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && getR2Config());
}

function hasWranglerConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return Boolean(supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function hasRemoteConfig() {
  const secret = process.env.STAFF_SYNC_SECRET?.trim();
  return Boolean(secret && secret.length >= 16);
}

try {
  let result;
  if (hasDirectConfig()) {
    result = await syncDirect();
  } else if (hasWranglerConfig()) {
    result = await syncWrangler();
  } else if (hasRemoteConfig()) {
    result = await syncRemote();
  } else {
    console.error(
      "Configure direct sync (recommended):\n" +
        "  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY\n" +
        "  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY\n" +
        "Or wrangler CLI (logged-in `wrangler whoami` + Supabase vars above)\n" +
        "Or remote sync:\n" +
        "  STAFF_SYNC_SECRET (min 16 chars) on Worker + .env.local\n" +
        "Load via: node --env-file=.env.local scripts/sync-catalog-r2.mjs",
    );
    process.exit(1);
  }

  await purgeCatalogCache();

  const count =
    result.productCount != null ? ` — ${result.productCount} products` : "";
  console.log(
    `Catalog R2 sync OK (${result.mode})${count} — catalogUpdatedAt:`,
    result.catalogUpdatedAt ?? "(unknown)",
  );
} catch (e) {
  console.error("Catalog R2 sync failed:", e instanceof Error ? e.message : e);
  process.exit(1);
}
