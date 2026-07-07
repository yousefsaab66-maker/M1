export type OrderSource = "app" | "website";

export function getOrderSource(order: {
  source?: OrderSource;
  payment?: { source?: OrderSource };
}): OrderSource {
  return order.source ?? order.payment?.source ?? "website";
}
