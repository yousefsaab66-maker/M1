"use server";

import { cookies, headers } from "next/headers";
import type { Product } from "@/lib/catalog";
import type { Order, OrderStatus, PlaceOrderInput } from "@/lib/commerce-types";
import { normalizeCustomerNote } from "@/lib/customer-note";
import { isValidInternationalPhone } from "@/lib/countries";
import {
  buildDiscountLines,
  computeDiscountIqd,
  findDiscountCode,
  resolveOrderTotals,
  validateDiscountCode,
} from "@/lib/discount";
import { isIraqCountry, normalizeIraqiPhone, toIqd } from "@/lib/iraq";
import { normalizeProductStock } from "@/lib/product-prices";
import { fetchStorefront } from "@/lib/storefront-query";
import { getShippingFeeIqd, getUsdIqdRate } from "@/lib/site-display";
import { deleteProductFromSupabase } from "@/lib/muhra-product-delete";
import { upsertProductToSupabase } from "@/lib/muhra-product-upsert";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";
import { isSupabaseBackendConfigured, supabaseAdmin } from "@/lib/supabase/admin";

const ORDER_LIMIT_PER_PHONE = 5;
const ORDER_LIMIT_PER_IP = 20;
const ORDER_WINDOW_MS = 60 * 60 * 1000;

async function requireStaff(): Promise<boolean> {
  const secret = process.env.STAFF_COOKIE_SECRET;
  const jar = await cookies();
  return Boolean(verifyStaffSession(jar.get(STAFF_COOKIE_NAME)?.value, secret));
}

export async function createOrderRemote(
  input: PlaceOrderInput,
  bagLines: { productId: string; qty: number; size?: string; customerNote?: string }[],
): Promise<{ ok: true; order: Order } | { ok: false; error: string }> {
  if (!isSupabaseBackendConfigured()) return { ok: false, error: "not_configured" };
  if (input.payment.method !== "cod") return { ok: false, error: "cod_only" };
  if (bagLines.length === 0) return { ok: false, error: "empty" };

  /* مفتاحان: الهاتف (دقيق) والـ IP (يحمي من تجريب أرقام كثيرة من نفس المصدر). */
  const international = !isIraqCountry(input.customer.country);
  let phoneKey: string;
  if (international) {
    if (!isValidInternationalPhone(input.customer.phone)) {
      return { ok: false, error: "invalid_phone" };
    }
    phoneKey = input.customer.phone.replace(/[\s\-().]/g, "");
  } else {
    phoneKey = normalizeIraqiPhone(input.customer.phone) ?? "";
    if (!phoneKey) return { ok: false, error: "invalid_phone" };
    if (!input.customer.governorate) return { ok: false, error: "invalid_address" };
  }
  const phoneRl = rateLimit(`order_phone:${phoneKey}`, ORDER_LIMIT_PER_PHONE, ORDER_WINDOW_MS);
  if (!phoneRl.ok) return { ok: false, error: "rate_limited" };

  const ip = getClientIp(await headers());
  const ipRl = rateLimit(`order_ip:${ip}`, ORDER_LIMIT_PER_IP, ORDER_WINDOW_MS);
  if (!ipRl.ok) return { ok: false, error: "rate_limited" };

  const sb = supabaseAdmin();
  const ids = [...new Set(bagLines.map((b) => b.productId))];
  const qtyByProduct = new Map<string, number>();
  for (const line of bagLines) {
    qtyByProduct.set(line.productId, (qtyByProduct.get(line.productId) ?? 0) + line.qty);
  }

  const { data: rows, error: fetchErr } = await sb
    .from("products")
    .select("id, name, price, currency, stock")
    .in("id", ids);
  if (fetchErr) return { ok: false, error: fetchErr.message };
  const map = new Map((rows ?? []).map((r) => [r.id as string, r]));

  for (const [productId, requestedQty] of qtyByProduct) {
    const row = map.get(productId);
    if (!row) return { ok: false, error: "invalid_product" };
    const stock = normalizeProductStock(row.stock as number | null | undefined);
    if (stock == null) continue;
    if (stock === 0) return { ok: false, error: "stock_out" };
    if (requestedQty > stock) return { ok: false, error: "stock_insufficient" };
  }

  const items: Order["items"] = [];
  let subtotal = 0;
  let currency: Order["currency"] = "EUR";

  for (const line of bagLines) {
    const r = map.get(line.productId);
    if (!r) return { ok: false, error: "invalid_product" };
    const price = Number(r.price);
    const customerNote = normalizeCustomerNote(line.customerNote);
    items.push({
      productId: r.id as string,
      name: r.name as string,
      qty: line.qty,
      price,
      size: line.size,
      ...(customerNote ? { customerNote } : {}),
    });
    subtotal += price * line.qty;
    currency = r.currency as Order["currency"];
  }

  const storefront = await fetchStorefront();
  const site = storefront.kind === "ok" ? storefront.site : undefined;
  const usdIqdRate = site ? getUsdIqdRate(site) : undefined;
  const rateOpts = { usdIqdRate };
  const subtotalIqd = toIqd(subtotal, currency, rateOpts);

  let discountCode: string | undefined;
  let discountAmountIqd: number | undefined;
  const rawDiscount = input.discountCode?.trim();
  if (rawDiscount) {
    const found = findDiscountCode(site?.discountCodes, rawDiscount);
    const productIds = items.map((it) => it.productId);
    const check = validateDiscountCode(found, productIds);
    if (!check.ok) return { ok: false, error: `discount_${check.error}` };
    const lines = buildDiscountLines(
      items.map((it) => ({
        productId: it.productId,
        price: it.price,
        qty: it.qty,
        currency,
      })),
      rateOpts,
    );
    discountAmountIqd = computeDiscountIqd(check.discount, lines);
    if (discountAmountIqd <= 0) return { ok: false, error: "discount_no_eligible" };
    discountCode = check.discount.code;
  }

  const shippingFeeIqd = international ? undefined : getShippingFeeIqd(site);
  const totalIqd = resolveOrderTotals({ subtotalIqd, shippingFeeIqd, discountAmountIqd });

  const customer = {
    ...input.customer,
    international: international || undefined,
  };

  const { data: inserted, error: insErr } = await sb
    .from("orders")
    .insert({
      customer_name: input.customer.name,
      customer,
      items,
      subtotal,
      subtotal_iqd: subtotalIqd,
      shipping_fee_iqd: shippingFeeIqd,
      total_iqd: totalIqd,
      currency,
      status: "pending",
      payment: {
        method: "cod" as const,
        ...(discountCode ? { discountCode, discountAmountIqd } : {}),
      },
    })
    .select("id, created_at")
    .single();

  if (insErr || !inserted) return { ok: false, error: insErr?.message ?? "insert_failed" };

  const order: Order = {
    id: inserted.id as string,
    createdAt: inserted.created_at as string,
    customerName: input.customer.name,
    customer,
    items,
    subtotal,
    subtotalIqd,
    shippingFeeIqd,
    discountCode,
    discountAmountIqd,
    totalIqd,
    currency,
    status: "pending",
    payment: {
      method: "cod",
      ...(discountCode ? { discountCode, discountAmountIqd } : {}),
    },
  };

  return { ok: true, order };
}

export async function listOrdersRemote(): Promise<{ ok: true; orders: Order[] } | { ok: false }> {
  if (!(await requireStaff())) return { ok: false };
  if (!isSupabaseBackendConfigured()) return { ok: false };
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error || !data) return { ok: false };
  const orders: Order[] = data.map((row: Record<string, unknown>) => {
    const payment = row.payment as Order["payment"] & {
      discountCode?: string;
      discountAmountIqd?: number;
    };
    return {
      id: row.id as string,
      createdAt: row.created_at as string,
      customerName: row.customer_name as string,
      customer: row.customer as Order["customer"],
      items: row.items as Order["items"],
      subtotal: Number(row.subtotal),
      subtotalIqd: row.subtotal_iqd != null ? Number(row.subtotal_iqd) : undefined,
      shippingFeeIqd: row.shipping_fee_iqd != null ? Number(row.shipping_fee_iqd) : undefined,
      discountCode: payment?.discountCode,
      discountAmountIqd:
        payment?.discountAmountIqd != null ? Number(payment.discountAmountIqd) : undefined,
      totalIqd: row.total_iqd != null ? Number(row.total_iqd) : undefined,
      currency: row.currency as Order["currency"],
      status: row.status as OrderStatus,
      payment,
    };
  });
  return { ok: true, orders };
}

export async function updateOrderStatusRemote(id: string, status: OrderStatus): Promise<boolean> {
  if (!(await requireStaff())) return false;
  if (!isSupabaseBackendConfigured()) return false;
  const sb = supabaseAdmin();
  const { error } = await sb.from("orders").update({ status }).eq("id", id);
  return !error;
}

export async function deleteOrderRemote(id: string): Promise<boolean> {
  if (!(await requireStaff())) return false;
  if (!isSupabaseBackendConfigured()) return false;
  const sb = supabaseAdmin();
  const { error } = await sb.from("orders").delete().eq("id", id);
  return !error;
}

/** Prefer `POST /api/staff/products` from the browser on Cloudflare — lighter than this action. */
export async function upsertProductRemote(p: Product): Promise<{ ok: true; product: Product } | { ok: false; error: string }> {
  if (!(await requireStaff())) return { ok: false, error: "unauthorized" };
  return upsertProductToSupabase(p);
}

/** Prefer `DELETE /api/staff/products` from the browser on Cloudflare — lighter than this action. */
export async function deleteProductRemote(id: string): Promise<boolean> {
  if (!(await requireStaff())) return false;
  const result = await deleteProductFromSupabase(id);
  return result.ok;
}
