import type { Currency, DiscountCode } from "@/lib/catalog";
import { SHIPPING_FEE_IQD, toIqd, type ToIqdOptions } from "@/lib/iraq";

export type DiscountValidationError =
  | "invalid"
  | "inactive"
  | "expired"
  | "no_eligible";

export type DiscountLine = {
  productId: string;
  lineIqd: number;
};

export function normalizeDiscountCodeInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function normalizeDiscountCodes(codes: DiscountCode[] | undefined): DiscountCode[] {
  if (!Array.isArray(codes)) return [];
  const seen = new Set<string>();
  const out: DiscountCode[] = [];
  for (const raw of codes) {
    const code = normalizeDiscountCodeInput(raw.code ?? "");
    if (!code || seen.has(code)) continue;
    const percentOff = Math.min(100, Math.max(1, Math.round(Number(raw.percentOff) || 0)));
    if (percentOff < 1) continue;
    const appliesTo = raw.appliesTo === "products" ? "products" : "all";
    const productIds =
      appliesTo === "products"
        ? [...new Set((raw.productIds ?? []).map((id) => id.trim()).filter(Boolean))]
        : undefined;
    if (appliesTo === "products" && (!productIds || productIds.length === 0)) continue;
    const expiresAt = raw.expiresAt?.trim() || undefined;
    out.push({
      id: raw.id?.trim() || `dc-${code.toLowerCase()}`,
      code,
      percentOff,
      appliesTo,
      productIds,
      active: raw.active !== false,
      expiresAt,
    });
    seen.add(code);
  }
  return out;
}

export function findDiscountCode(
  codes: DiscountCode[] | undefined,
  inputCode: string,
): DiscountCode | undefined {
  const normalized = normalizeDiscountCodeInput(inputCode);
  if (!normalized) return undefined;
  return normalizeDiscountCodes(codes).find((c) => c.code === normalized);
}

export function validateDiscountCode(
  discount: DiscountCode | undefined,
  productIds: string[],
): { ok: true; discount: DiscountCode } | { ok: false; error: DiscountValidationError } {
  if (!discount) return { ok: false, error: "invalid" };
  if (!discount.active) return { ok: false, error: "inactive" };
  if (discount.expiresAt) {
    const exp = Date.parse(discount.expiresAt);
    if (Number.isFinite(exp) && Date.now() > exp) {
      return { ok: false, error: "expired" };
    }
  }
  if (discount.appliesTo === "products") {
    const eligible = productIds.some((id) => discount.productIds?.includes(id));
    if (!eligible) return { ok: false, error: "no_eligible" };
  }
  return { ok: true, discount };
}

export function buildDiscountLines(
  items: { productId: string; price: number; qty: number; currency: Currency }[],
  opts?: ToIqdOptions,
): DiscountLine[] {
  return items.map((item) => ({
    productId: item.productId,
    lineIqd: toIqd(item.price * item.qty, item.currency, opts),
  }));
}

export function computeDiscountIqd(discount: DiscountCode, lines: DiscountLine[]): number {
  const eligible =
    discount.appliesTo === "all"
      ? lines
      : lines.filter((line) => discount.productIds?.includes(line.productId));
  const eligibleTotal = eligible.reduce((sum, line) => sum + line.lineIqd, 0);
  if (eligibleTotal <= 0) return 0;
  return Math.round((eligibleTotal * discount.percentOff) / 100);
}

export function resolveOrderTotals(input: {
  subtotalIqd: number;
  shippingFeeIqd?: number;
  discountAmountIqd?: number;
}): number {
  const discount = input.discountAmountIqd ?? 0;
  const shipping = input.shippingFeeIqd ?? 0;
  return Math.max(0, input.subtotalIqd - discount + shipping);
}

/** Re-export for callers that only need the default constant. */
export { SHIPPING_FEE_IQD };
