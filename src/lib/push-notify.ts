import type { Order, OrderStatus } from "@/lib/commerce-types";
import { sendExpoPush } from "@/lib/expo-push";
import { listCustomerPushTokensForPhone, listStaffPushTokens } from "@/lib/push-tokens-db";
import { isIraqCountry, normalizeIraqiPhone } from "@/lib/iraq";

function phoneKeyFromOrder(order: Order): string {
  const phone = order.customer?.phone ?? "";
  const country = order.customer?.country;
  if (isIraqCountry(country)) {
    return normalizeIraqiPhone(phone) ?? phone.replace(/\D/g, "");
  }
  return phone.replace(/[\s\-().]/g, "");
}

const STATUS_EN: Record<OrderStatus, string> = {
  pending: "Pending",
  preparing: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_AR: Record<OrderStatus, string> = {
  pending: "قيد الانتظار",
  preparing: "قيد التحضير",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغى",
};

function formatIqdShort(n?: number): string {
  if (n == null) return "";
  return `${n.toLocaleString("en-IQ")} IQD`;
}

export async function notifyStaffNewOrder(order: Order): Promise<void> {
  const tokens = await listStaffPushTokens();
  if (tokens.length === 0) return;

  const total = formatIqdShort(order.totalIqd ?? order.subtotalIqd);
  const source = order.source === "app" ? "App" : "Website";
  const title = "MUHRA · طلب جديد";
  const body = `${order.customerName} · ${total || order.currency} · ${source}`;

  await sendExpoPush(
    tokens.map((to) => ({
      to,
      title,
      body,
      sound: "default",
      channelId: "staff-orders",
      priority: "high",
      data: {
        type: "staff_new_order",
        orderId: order.id,
      },
    })),
  );
}

export async function notifyCustomerOrderStatus(order: Order, status: OrderStatus): Promise<void> {
  const phoneKey = phoneKeyFromOrder(order);
  if (!phoneKey) return;

  const tokens = await listCustomerPushTokensForPhone(phoneKey);
  if (tokens.length === 0) return;

  const shortId = order.id.slice(0, 8);
  const title = "MUHRA · تحديث الطلب";
  const body = `#${shortId} — ${STATUS_AR[status]} / ${STATUS_EN[status]}`;

  await sendExpoPush(
    tokens.map((to) => ({
      to,
      title,
      body,
      sound: "default",
      channelId: "orders",
      data: {
        type: "order_status",
        orderId: order.id,
        status,
      },
    })),
  );
}
