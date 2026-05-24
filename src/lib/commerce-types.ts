import type { Currency } from "@/lib/catalog";
import type { CountryCode } from "@/lib/countries";
import type { GovernorateCode } from "@/lib/iraq";

export type BagItem = {
  productId: string;
  qty: number;
  size?: string;
};

export type OrderStatus =
  | "pending"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled";

/** حالياً: عند الاستلام فقط على الخادم. */
export type PaymentMethod = "cod";

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
  /** Legacy rows from older demo checkout versions. */
  cardLast4?: string;
  zaincashPhone?: string;
}

export interface Order {
  id: string;
  createdAt: string;
  customerName: string;
  customer?: OrderCustomer;
  items: { productId: string; name: string; qty: number; price: number; size?: string }[];
  subtotal: number;
  subtotalIqd?: number;
  shippingFeeIqd?: number;
  totalIqd?: number;
  currency: Currency;
  status: OrderStatus;
  payment?: OrderPayment;
}

export interface PlaceOrderInput {
  customer: OrderCustomer;
  payment: OrderPayment;
}
