import type { Currency } from "@/lib/catalog";
import type { ProductSizeSelections } from "@/lib/product-sizes";
import type { CountryCode } from "@/lib/countries";
import type { GovernorateCode } from "@/lib/iraq";

export type BagItem = {
  productId: string;
  qty: number;
  /** Legacy single-size products. */
  size?: string;
  /** Multi-group size selections (necklace / bracelet / ring). */
  sizeSelections?: ProductSizeSelections;
  /** Index into product.priceOptions when multiple active prices. */
  priceSlotIndex?: number;
  /** Index into product.productOptions when multiple active options. */
  productOptionSlotIndex?: number;
  /** Optional shopper note to identify an item in a multi-product photo. */
  customerNote?: string;
};

export type OrderLineItem = {
  productId: string;
  name: string;
  qty: number;
  price: number;
  size?: string;
  /** Index into product.priceOptions when multiple active prices. */
  priceSlotIndex?: number;
  /** Index into product.productOptions when multiple active options. */
  productOptionSlotIndex?: number;
  /** Denormalized label from product.productOptions at checkout. */
  productOptionLabel?: string;
  customerNote?: string;
};

export type OrderStatus =
  | "pending"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled";

/** حالياً: عند الاستلام فقط على الخادم. */
export type PaymentMethod = "cod";

export type OrderSource = "app" | "website";

export interface OrderCustomer {
  name: string;
  phone: string;
  /** ISO 3166-1 alpha-2; defaults to Iraq when omitted on legacy rows. */
  country: CountryCode;
  governorate?: GovernorateCode;
  city: string;
  address: string;
  notes?: string;
  /** True when country is outside Iraq — staff confirms shipping fees. */
  international?: boolean;
}

export interface OrderPayment {
  method: PaymentMethod;
  source?: OrderSource;
  /** Legacy rows from older demo checkout versions. */
  cardLast4?: string;
  zaincashPhone?: string;
  discountCode?: string;
  discountAmountIqd?: number;
}

export interface Order {
  id: string;
  createdAt: string;
  customerName: string;
  customer?: OrderCustomer;
  items: OrderLineItem[];
  subtotal: number;
  subtotalIqd?: number;
  shippingFeeIqd?: number;
  discountCode?: string;
  discountAmountIqd?: number;
  totalIqd?: number;
  currency: Currency;
  status: OrderStatus;
  payment?: OrderPayment;
  /** Denormalized from payment.source for convenience. */
  source?: OrderSource;
}

export interface PlaceOrderInput {
  customer: OrderCustomer;
  payment: OrderPayment;
  discountCode?: string;
}
