/** Buyer–seller return / refund flow (SupaMarket) — display helpers */

export const RETURN_CATEGORY_LABELS: Record<string, string> = {
  delivery_issue: "Package / delivery problem",
  item_not_as_described: "Item not as described",
  damaged_item: "Item damaged",
  wrong_item: "Wrong item received",
  other: "Other issue",
};

export function returnCategoryLabel(category: string | undefined | null): string {
  const k = String(category ?? "").trim();
  return RETURN_CATEGORY_LABELS[k] || k || "Issue";
}

/** Time left until seller deadline; Shopee-style copy */
export function formatSellerResponseCountdown(deadlineIso: string): string {
  const end = new Date(deadlineIso).getTime();
  if (!Number.isFinite(end)) return "";
  const ms = end - Date.now();
  if (ms <= 0) return "Response overdue — seller should reply soon";
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  const hr = h % 24;
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${hr}h left for seller`;
  if (h > 0) return `${h}h ${m}m left for seller`;
  return `${m}m left for seller`;
}

export function formatBuyerReturnCountdown(deadlineIso: string): string {
  const end = new Date(deadlineIso).getTime();
  if (!Number.isFinite(end)) return "";
  const ms = end - Date.now();
  if (ms <= 0) return "Return shipment overdue — upload tracking now";
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  const hr = h % 24;
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${hr}h left to ship return`;
  if (h > 0) return `${h}h ${m}m left to ship return`;
  return `${m}m left to ship return`;
}

export type ReturnPhase =
  | "none"
  | "submitted"
  | "approved_waiting_buyer_ship"
  | "buyer_shipped_waiting_seller_confirm"
  | "rejected"
  | "refunded_rr"
  | "escalated";

export function getReturnPhase(order: {
  status: string;
  return_request?: { status: string } | null;
}): ReturnPhase {
  if (order.status === "refunded" && order.return_request?.status === "refunded") return "refunded_rr";
  if (order.status === "refunded") return "refunded_rr";
  const rr = order.return_request;
  if (!rr || rr.status === "buyer_cancelled") return "none";
  if (rr.status === "pending_seller") return "submitted";
  if (rr.status === "seller_approved_return") return "approved_waiting_buyer_ship";
  if (rr.status === "buyer_return_shipped") return "buyer_shipped_waiting_seller_confirm";
  if (rr.status === "seller_rejected") return "rejected";
  if (rr.status === "escalated") return "escalated";
  if (rr.status === "refunded") return "refunded_rr";
  return "none";
}

/** Open dispute (buyer escalation or seller case) → treat as platform stage */
export function getReturnPhaseWithDispute(
  order: { status: string; return_request?: { status: string } | null },
  hasOpenDispute: boolean
): ReturnPhase {
  if (order.return_request?.status === "escalated") return "escalated";
  if (hasOpenDispute && order.status === "disputed") return "escalated";
  return getReturnPhase(order);
}
