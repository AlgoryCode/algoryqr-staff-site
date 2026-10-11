export type MenuAnalyticsEventType =
  | "MENU_OPEN"
  | "CATEGORY_VIEW"
  | "PRODUCT_VIEW"
  | "SERVES_FILTER"
  | "QR_SCAN"
  | "ADD_TO_CART"
  | "REMOVE_FROM_CART"
  | "CHECKOUT_START"
  | "ORDER_SUBMITTED"
  | "CHEF_CHAT_OPEN"
  | "CHEF_RECOMMENDATION_REQUEST"
  | "CHEF_RECOMMENDATION_SHOWN"
  | "CHEF_PRODUCT_CARD_CLICK"
  | "CHEF_PRODUCT_ADD"
  | "CHEF_CROSS_SELL_SHOWN"
  | "CHEF_CROSS_SELL_CLICK"
  | "CHEF_CROSS_SELL_ADD"
  | "CHEF_CART_OPEN"
  | "CHEF_RECOMMENDATION_FEEDBACK";

export type MenuAnalyticsDeviceType = "MOBILE" | "TABLET" | "DESKTOP";

/** String values only — safe for analytics ingest. */
export type MenuAnalyticsMetadata = Record<string, string | number>;

export type MenuAnalyticsEventItem = {
  type: MenuAnalyticsEventType;
  categoryId?: number;
  productId?: number;
  servesPeople?: number;
  metadata?: MenuAnalyticsMetadata;
  sequence: number;
  occurredAt: string;
};

const SESSION_KEY_PREFIX = "algory_menu_sid_";
const SEQUENCE_KEY_PREFIX = "algory_menu_seq_";

export function detectMenuDeviceType(): MenuAnalyticsDeviceType {
  if (typeof navigator === "undefined") {
    return "DESKTOP";
  }
  const ua = (navigator.userAgent || "").toLowerCase();
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (ua.includes("tablet") || ua.includes("ipad") || (ua.includes("android") && !ua.includes("mobile"))) {
    return "TABLET";
  }
  if (
    uaData?.mobile === true ||
    ua.includes("mobile") ||
    ua.includes("iphone") ||
    ua.includes("ipod") ||
    ua.includes("android")
  ) {
    return "MOBILE";
  }
  if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse) and (max-width: 1024px)").matches) {
    return "MOBILE";
  }
  return "DESKTOP";
}

function randomUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function getOrCreateMenuSessionId(publicId: string): string {
  if (typeof window === "undefined") {
    return randomUuid();
  }
  const key = `${SESSION_KEY_PREFIX}${publicId}`;
  const existing = window.localStorage.getItem(key);
  if (existing) {
    return existing;
  }
  const created = randomUuid();
  window.localStorage.setItem(key, created);
  return created;
}

export function nextMenuEventSequence(publicId: string): number {
  if (typeof window === "undefined") {
    return 1;
  }
  const key = `${SEQUENCE_KEY_PREFIX}${publicId}`;
  const current = Number.parseInt(window.localStorage.getItem(key) ?? "0", 10);
  const next = Number.isFinite(current) ? current + 1 : 1;
  window.localStorage.setItem(key, String(next));
  return next;
}

export function postMenuAnalyticsEvents(
  publicId: string,
  sessionId: string,
  events: MenuAnalyticsEventItem[],
  deviceType: MenuAnalyticsDeviceType = detectMenuDeviceType(),
): void {
  if (events.length === 0 || typeof window === "undefined" || !publicId) {
    return;
  }
  const payload = JSON.stringify({ sessionId, deviceType, events });
  const url = `/api/analytics/menu/${encodeURIComponent(publicId)}/events`;
  const clientUserAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) {
        return;
      }
    }
  } catch {
  }
  void fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(clientUserAgent ? { "X-Client-User-Agent": clientUserAgent } : {}),
    },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

export function trackMenuAnalyticsEvent(
  publicId: string,
  type: MenuAnalyticsEventType,
  extras?: {
    categoryId?: number;
    productId?: number;
    servesPeople?: number;
    metadata?: MenuAnalyticsMetadata;
  },
): void {
  if (!publicId) {
    return;
  }
  const sessionId = getOrCreateMenuSessionId(publicId);
  postMenuAnalyticsEvents(publicId, sessionId, [
    {
      type,
      categoryId: extras?.categoryId,
      productId: extras?.productId,
      servesPeople: extras?.servesPeople,
      metadata: extras?.metadata,
      sequence: nextMenuEventSequence(publicId),
      occurredAt: new Date().toISOString().slice(0, 19),
    },
  ]);
}
