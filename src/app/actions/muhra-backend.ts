"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { Product } from "@/lib/catalog";
import type { Order, OrderStatus, PlaceOrderInput } from "@/lib/commerce-types";
import { productToInsert, rowToProduct, isDatabaseProductId, type ProductRow } from "@/lib/catalog-db";
import { SHIPPING_FEE_IQD, toIqd } from "@/lib/iraq";
import { ensureProductOrderable, validateProductPayloadForServerSave } from "@/lib/product-media";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";
import { isSupabaseBackendConfigured, supabaseAdmin } from "@/lib/supabase/admin";

async function requireStaff(): Promise<boolean> {
  const secret = process.env.STAFF_COOKIE_SECRET;
  const jar = await cookies();
  return Boolean(verifyStaffSession(jar.get(STAFF_COOKIE_NAME)?.value, secret));
}

export async function createOrderRemote(
  input: PlaceOrderInput,
  bagLines: { productId: string; qty: number; size?: string }[],
): Promise<{ ok: true; order: Order } | { ok: false; error: string }> {
  if (!isSupabaseBackendConfigured()) return { ok: false, error: "not_configured" };
  if (input.payment.method !== "cod") return { ok: false, error: "cod_only" };
  if (bagLines.length === 0) return { ok: false, error: "empty" };

  const sb = supabaseAdmin();
  const ids = [...new Set(bagLines.map((b) => b.productId))];
  const { data: rows, error: fetchErr } = await sb.from("products").select("id, name, price, currency").in("id", ids);
  if (fetchErr) return { ok: false, error: fetchErr.message };
  const map = new Map((rows ?? []).map((r) => [r.id as string, r]));

  const items: Order["items"] = [];
  let subtotal = 0;
  let currency: Order["currency"] = "EUR";

  for (const line of bagLines) {
    const r = map.get(line.productId);
    if (!r) return { ok: false, error: "invalid_product" };
    const price = Number(r.price);
    items.push({ productId: r.id as string, name: r.name as string, qty: line.qty, price, size: line.size });
    subtotal += price * line.qty;
    currency = r.currency as Order["currency"];
  }

  const subtotalIqd = toIqd(subtotal, currency);
  const shippingFeeIqd = SHIPPING_FEE_IQD;
  const totalIqd = subtotalIqd + shippingFeeIqd;

  const { data: inserted, error: insErr } = await sb
    .from("orders")
    .insert({
      customer_name: input.customer.name,
      customer: input.customer,
      items,
      subtotal,
      subtotal_iqd: subtotalIqd,
      shipping_fee_iqd: shippingFeeIqd,
      total_iqd: totalIqd,
      currency,
      status: "pending",
      payment: { method: "cod" as const },
    })
    .select("id, created_at")
    .single();

  if (insErr || !inserted) return { ok: false, error: insErr?.message ?? "insert_failed" };

  const order: Order = {
    id: inserted.id as string,
    createdAt: inserted.created_at as string,
    customerName: input.customer.name,
    customer: input.customer,
    items,
    subtotal,
    subtotalIqd,
    shippingFeeIqd,
    totalIqd,
    currency,
    status: "pending",
    payment: { method: "cod" },
  };

  revalidatePath("/staff");
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
  const orders: Order[] = data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    createdAt: row.created_at as string,
    customerName: row.customer_name as string,
    customer: row.customer as Order["customer"],
    items: row.items as Order["items"],
    subtotal: Number(row.subtotal),
    subtotalIqd: row.subtotal_iqd != null ? Number(row.subtotal_iqd) : undefined,
    shippingFeeIqd: row.shipping_fee_iqd != null ? Number(row.shipping_fee_iqd) : undefined,
    totalIqd: row.total_iqd != null ? Number(row.total_iqd) : undefined,
    currency: row.currency as Order["currency"],
    status: row.status as OrderStatus,
    payment: row.payment as Order["payment"],
  }));
  return { ok: true, orders };
}

export async function updateOrderStatusRemote(id: string, status: OrderStatus): Promise<boolean> {
  if (!(await requireStaff())) return false;
  if (!isSupabaseBackendConfigured()) return false;
  const sb = supabaseAdmin();
  const { error } = await sb.from("orders").update({ status }).eq("id", id);
  if (error) return false;
  revalidatePath("/staff");
  return true;
}

export async function deleteOrderRemote(id: string): Promise<boolean> {
  if (!(await requireStaff())) return false;
  if (!isSupabaseBackendConfigured()) return false;
  const sb = supabaseAdmin();
  const { error } = await sb.from("orders").delete().eq("id", id);
  if (error) return false;
  revalidatePath("/staff");
  return true;
}

export async function upsertProductRemote(p: Product): Promise<{ ok: true; product: Product } | { ok: false; error: string }> {
  if (!(await requireStaff())) return { ok: false, error: "unauthorized" };
  if (!isSupabaseBackendConfigured()) return { ok: false, error: "not_configured" };

  const fixed = ensureProductOrderable(p);
  const payloadErr = validateProductPayloadForServerSave(fixed);
  if (payloadErr) return { ok: false, error: payloadErr };
  const row = productToInsert(fixed);
  const sb = supabaseAdmin();

  if (isDatabaseProductId(fixed.id)) {
    const { data, error } = await sb
      .from("products")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", fixed.id)
      .select("*")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "update_failed" };
    revalidatePath("/staff");
    return { ok: true, product: rowToProduct(data as ProductRow) };
  }

  const { data, error } = await sb.from("products").insert(row).select("*").single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert_failed" };
  revalidatePath("/staff");
  return { ok: true, product: rowToProduct(data as ProductRow) };
}

export async function deleteProductRemote(id: string): Promise<boolean> {
  if (!(await requireStaff())) return false;
  if (!isSupabaseBackendConfigured()) return false;
  if (!isDatabaseProductId(id)) return false;
  const sb = supabaseAdmin();
  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) return false;
  revalidatePath("/staff");
  return true;
}
