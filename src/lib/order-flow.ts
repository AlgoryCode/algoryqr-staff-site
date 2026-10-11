/**
 * Sipariş akışı.
 * Güncel statüler: PENDING, CONFIRMED, PREPARING, READY, AWAITING_COURIER, ON_THE_WAY, DELIVERED.
 * Eski aktör statüleri bu listeye normalize edilir.
 * Dashboard'un yazdığı statü, sunucu aynı adıma gelene kadar oturumda korunur.
 * Ödeme geri alınca zorlanan statü, sunucu DELIVERED dönse de kuyruğa geri koyar.
 */

export const ORDER_FLOW_STATUSES = [
  "CONFIRMED",
  "PREPARING",
  "READY",
  "AWAITING_COURIER",
  "ON_THE_WAY",
  "DELIVERED",
  "KITCHEN_PREPARING",
  "KITCHEN_PREPARED",
  "KITCHEN_DELIVERED_TO_WAITER",
  "KITCHEN_DELIVERED_TO_COURIER",
  "WAITER_TAKEN",
  "COURIER_TAKEN",
  "WAITER_DELIVERED_TO_CUSTOMER",
  "WAITER_DELIVERED_TO_COURIER",
  "COURIER_DELIVERED_TO_CUSTOMER",
  "PAID",
] as const;

export type OrderFlowStatus = (typeof ORDER_FLOW_STATUSES)[number];

export type OrderFlowAction =
  | "markKitchenPreparing"
  | "markKitchenPrepared"
  | "markReady"
  | "markKitchenDeliveredToWaiter"
  | "markKitchenDeliveredToCourier"
  | "markWaiterTaken"
  | "markWaiterDeliveredToCustomer"
  | "markWaiterDeliveredToCourier"
  | "markCourierTaken"
  | "markCourierRelease"
  | "markCourierDeliveredToCustomer";

export type OrderFlowContext = {
  kitchenEnabled: boolean;
  courierEnabled: boolean;
  delivery: boolean;
  pickup?: boolean;
  marketplace?: boolean;
  /** false iken paket kurye kuyruğuna inemez. */
  addressPresent?: boolean;
};

export type OrderFlowStep = {
  action: OrderFlowAction;
  status: OrderFlowStatus;
  label: string;
};

const FLOW_STATUS_SET = new Set<string>(ORDER_FLOW_STATUSES);

export const ORDER_FLOW_STATUS_LABEL: Record<OrderFlowStatus, string> = {
  CONFIRMED: "Onaylandı",
  PREPARING: "Hazırlanıyor",
  READY: "Hazır",
  AWAITING_COURIER: "Kurye bekliyor",
  ON_THE_WAY: "Yolda",
  DELIVERED: "Teslim edildi",
  KITCHEN_PREPARING: "Hazırlanıyor",
  KITCHEN_PREPARED: "Hazır",
  KITCHEN_DELIVERED_TO_WAITER: "Hazır",
  KITCHEN_DELIVERED_TO_COURIER: "Kurye bekliyor",
  WAITER_TAKEN: "Hazır",
  COURIER_TAKEN: "Yolda",
  WAITER_DELIVERED_TO_CUSTOMER: "Tamamlandı",
  WAITER_DELIVERED_TO_COURIER: "Kurye bekliyor",
  COURIER_DELIVERED_TO_CUSTOMER: "Teslim edildi",
  PAID: "Ödeme alındı",
};

export const ORDER_FLOW_ACTION_LABEL: Record<OrderFlowAction, string> = {
  markKitchenPreparing: "Hazırlamaya başla",
  markKitchenPrepared: "Bitti",
  markReady: "Hazır",
  markKitchenDeliveredToWaiter: "Hazır",
  markKitchenDeliveredToCourier: "Kuryeye bırak",
  markWaiterTaken: "Teslim aldım",
  markWaiterDeliveredToCustomer: "Müşteriye ver",
  markWaiterDeliveredToCourier: "Kuryeye bırak",
  markCourierTaken: "Teslim aldım",
  markCourierRelease: "Kuryeden geri al",
  markCourierDeliveredToCustomer: "Teslim ettim",
};

export const ORDER_FLOW_ACTION_STATUS: Record<OrderFlowAction, OrderFlowStatus> = {
  markKitchenPreparing: "PREPARING",
  markKitchenPrepared: "READY",
  markReady: "READY",
  markKitchenDeliveredToWaiter: "READY",
  markKitchenDeliveredToCourier: "AWAITING_COURIER",
  markWaiterTaken: "READY",
  markWaiterDeliveredToCustomer: "DELIVERED",
  markWaiterDeliveredToCourier: "AWAITING_COURIER",
  markCourierTaken: "ON_THE_WAY",
  markCourierRelease: "AWAITING_COURIER",
  markCourierDeliveredToCustomer: "DELIVERED",
};

const KITCHEN_ACTIONS = new Set<OrderFlowAction>([
  "markKitchenPreparing",
  "markKitchenPrepared",
  "markReady",
  "markKitchenDeliveredToCourier",
]);

const WAITER_ACTIONS = new Set<OrderFlowAction>([
  "markReady",
  "markWaiterDeliveredToCustomer",
]);

const COURIER_ACTIONS = new Set<OrderFlowAction>([
  "markCourierTaken",
  "markCourierRelease",
  "markCourierDeliveredToCustomer",
]);

const CANONICAL_RANK: Record<string, number> = {
  PENDING: 0,
  SUBMITTED: 0,
  CONFIRMED: 1,
  PREPARING: 2,
  READY: 3,
  AWAITING_COURIER: 4,
  ON_THE_WAY: 5,
  DELIVERED: 6,
  PAID: 7,
};

const writtenStatus = new Map<number, OrderFlowStatus>();
const forcedStatus = new Map<number, OrderFlowStatus>();

export function clearOrderFlowMemory(): void {
  writtenStatus.clear();
  forcedStatus.clear();
}

export type KitchenRevertTarget = "CONFIRMED" | "PREPARING";

export function forgetOrderFlowStatus(orderId: number): void {
  writtenStatus.delete(orderId);
  forcedStatus.delete(orderId);
}

export function writeOrderFlowStatus(orderId: number, status: OrderFlowStatus): void {
  if (!Number.isFinite(orderId)) return;
  forcedStatus.delete(orderId);
  writtenStatus.set(orderId, status);
}

/** Ödeme geri alınca sunucu hâlâ DELIVERED dönse bile kuyruk statüsü korunur. */
export function forceOrderFlowStatus(orderId: number, status: OrderFlowStatus): void {
  if (!Number.isFinite(orderId)) return;
  writtenStatus.delete(orderId);
  forcedStatus.set(orderId, status);
}

export function isOrderFlowStatus(status: string | null | undefined): status is OrderFlowStatus {
  return FLOW_STATUS_SET.has((status ?? "").trim().toUpperCase());
}

export function orderIsDelivery(order: { deliveryType?: string | null }): boolean {
  return (order.deliveryType ?? "").trim().toUpperCase() === "DELIVERY";
}

export function orderIsPickup(order: { deliveryType?: string | null }): boolean {
  const delivery = (order.deliveryType ?? "").trim().toUpperCase();
  return delivery === "PICKUP" || delivery === "STORE";
}

export function orderIsMarketplace(order: { orderSource?: string | null }): boolean {
  const source = (order.orderSource ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return source === "UBER_EATS" || source === "UBEREATS" || source === "UBER" || source === "YEMEKSEPETI" || source === "YEMEK_SEPETI" || source === "YS";
}

export function normalizeOrderStatus(status: string | null | undefined, _delivery = false): string {
  const raw = (status ?? "").trim().toUpperCase();
  if (!raw) return raw;
  switch (raw) {
    case "SUBMITTED":
      return "PENDING";
    case "KITCHEN_PREPARING":
    case "PREPARING":
      return "PREPARING";
    case "KITCHEN_PREPARED":
    case "KITCHEN_DELIVERED_TO_WAITER":
    case "WAITER_TAKEN":
    case "READY":
      return "READY";
    case "KITCHEN_DELIVERED_TO_COURIER":
    case "WAITER_DELIVERED_TO_COURIER":
    case "AWAITING_COURIER":
      return "AWAITING_COURIER";
    case "COURIER_TAKEN":
    case "ON_THE_WAY":
      return "ON_THE_WAY";
    case "PAID":
      return "PAID";
    case "SERVED":
    case "WAITER_DELIVERED_TO_CUSTOMER":
    case "COURIER_DELIVERED_TO_CUSTOMER":
    case "DELIVERED":
      return "DELIVERED";
    default:
      return raw;
  }
}

export function resolveOrderStatus(order: {
  id?: number;
  status: string | null | undefined;
  deliveryType?: string | null;
}): string {
  const normalized = normalizeOrderStatus(order.status, orderIsDelivery(order));
  const orderId = order.id;
  if (orderId == null || !Number.isFinite(orderId)) return normalized;
  if (normalized === "CANCELLED" || normalized === "REJECTED") {
    writtenStatus.delete(orderId);
    forcedStatus.delete(orderId);
    return normalized;
  }
  const forced = forcedStatus.get(orderId);
  if (forced) {
    const forcedNorm = normalizeOrderStatus(forced);
    if (normalized === forcedNorm) forcedStatus.delete(orderId);
    return forcedNorm;
  }
  const remembered = writtenStatus.get(orderId);
  if (!remembered) return normalized;
  const rememberedRank = CANONICAL_RANK[normalizeOrderStatus(remembered)] ?? 0;
  const serverRank = CANONICAL_RANK[normalized] ?? 0;
  if (normalized === normalizeOrderStatus(remembered) || serverRank >= rememberedRank) {
    writtenStatus.delete(orderId);
    return normalized;
  }
  return normalizeOrderStatus(remembered);
}

export function applyOrderFlow<T extends { id?: number; status: string; deliveryType?: string | null }>(order: T): T {
  const status = resolveOrderStatus(order);
  if (status === order.status) return order;
  return { ...order, status };
}

/** Mutfak yalnız onaylanmış bileti görür. Onay bekleyen sipariş mutfağa düşmez. */
export function isKitchenQueuedStatus(status: string | null | undefined): boolean {
  return normalizeOrderStatus(status) === "CONFIRMED";
}

export function applyKitchenOrderFlow<T extends { id?: number; status: string; deliveryType?: string | null }>(order: T): T {
  return applyOrderFlow(order);
}

export function serverReachedStatus(serverStatus: string | null | undefined, target: OrderFlowStatus): boolean {
  const serverRank = CANONICAL_RANK[normalizeOrderStatus(serverStatus)] ?? 0;
  const targetRank = CANONICAL_RANK[normalizeOrderStatus(target)] ?? 0;
  return serverRank >= targetRank;
}

export function stampOrderFlow<T extends { id: number; status: string; deliveryType?: string | null }>(
  order: T,
  status: OrderFlowStatus,
): T {
  writeOrderFlowStatus(order.id, status);
  return { ...order, status: normalizeOrderStatus(status) };
}

export function orderFlowStatusLabel(status: string | null | undefined, delivery = false): string {
  const raw = (status ?? "").trim().toUpperCase();
  if (raw === "SERVED") return "Servis edildi";
  if (raw === "PAID") return "Ödeme alındı";
  const normalized = normalizeOrderStatus(status, delivery);
  switch (normalized) {
    case "PENDING":
      return "Onay bekliyor";
    case "CONFIRMED":
      return "Onaylandı";
    case "PREPARING":
      return "Hazırlanıyor";
    case "READY":
      return "Hazır";
    case "AWAITING_COURIER":
      return "Kurye bekliyor";
    case "ON_THE_WAY":
      return "Yolda";
    case "DELIVERED":
      return delivery ? "Teslim edildi" : "Tamamlandı";
    case "PAID":
      return "Ödeme alındı";
    case "CANCELLED":
      return "İptal edildi";
    case "REJECTED":
      return "Reddedildi";
    case "DRAFT":
      return "Taslak";
    default:
      return normalized || "—";
  }
}

export type OrderCancelReason =
  | "CUSTOMER_REQUEST"
  | "OUT_OF_STOCK"
  | "WRONG_ORDER"
  | "LONG_WAIT"
  | "PAYMENT_ISSUE"
  | "OTHER";

export type OrderCancelRequest = {
  reason: OrderCancelReason;
  reasonNote?: string;
};

export const ORDER_CANCEL_REASON_LABEL: Record<OrderCancelReason, string> = {
  CUSTOMER_REQUEST: "Müşteri isteği",
  OUT_OF_STOCK: "Ürün kalmadı",
  WRONG_ORDER: "Yanlış sipariş",
  LONG_WAIT: "Uzun bekleme",
  PAYMENT_ISSUE: "Ödeme sorunu",
  OTHER: "Diğer",
};

export function orderCancelReasonText(request: OrderCancelRequest): string {
  const note = request.reasonNote?.trim();
  const label = ORDER_CANCEL_REASON_LABEL[request.reason];
  return note ? `${label}: ${note}` : label;
}

export function orderCancelReasonLabel(order: {
  cancelReason?: string | null;
  cancelReasonNote?: string | null;
}): string | null {
  const reason = (order.cancelReason ?? "").trim().toUpperCase() as OrderCancelReason;
  const label = ORDER_CANCEL_REASON_LABEL[reason] ?? null;
  const note = order.cancelReasonNote?.trim() || null;
  if (label && note) return `${label}: ${note}`;
  return label ?? note;
}

export function isCancelledOrderStatus(status: string | null | undefined): boolean {
  const raw = (status ?? "").trim().toUpperCase();
  return raw === "CANCELLED" || raw === "REJECTED";
}

/** Yola çıkmış ve teslim edilmiş sipariş iptal edilmez. Kurye beklerken iptal açıktır. */
export function isOrderCancellable(status: string | null | undefined, delivery = false): boolean {
  const normalized = normalizeOrderStatus(status, delivery);
  return (
    normalized === "PENDING" ||
    normalized === "CONFIRMED" ||
    normalized === "PREPARING" ||
    normalized === "READY" ||
    normalized === "AWAITING_COURIER"
  );
}

export function orderFlowStep(action: OrderFlowAction): OrderFlowStep {
  return {
    action,
    status: ORDER_FLOW_ACTION_STATUS[action],
    label: ORDER_FLOW_ACTION_LABEL[action],
  };
}

function step(action: OrderFlowAction): OrderFlowStep {
  return orderFlowStep(action);
}

function courierRelease(context: OrderFlowContext): OrderFlowStep[] {
  if (!context.delivery || !context.courierEnabled || context.marketplace) return [];
  return [step("markKitchenDeliveredToCourier")];
}

function inFlightCourierActions(current: string, context: OrderFlowContext): OrderFlowStep[] | null {
  if (current === "AWAITING_COURIER") return [step("markCourierTaken")];
  if (current === "ON_THE_WAY") {
    return context.courierEnabled
      ? [step("markCourierDeliveredToCustomer"), step("markCourierRelease")]
      : [step("markCourierDeliveredToCustomer")];
  }
  return null;
}

function deliverWithoutCourier(context: OrderFlowContext): OrderFlowStep[] {
  if (!context.delivery || context.courierEnabled || context.marketplace) return [];
  return [step("markWaiterDeliveredToCustomer")];
}

export function nextOrderActions(status: string | null | undefined, context: OrderFlowContext): OrderFlowStep[] {
  const current = normalizeOrderStatus(status, context.delivery);
  if (
    current === "CANCELLED" ||
    current === "REJECTED" ||
    current === "DRAFT" ||
    current === "DELIVERED" ||
    current === "PAID" ||
    current === "PENDING"
  ) {
    return [];
  }

  if (context.marketplace) {
    if (!context.kitchenEnabled) return [];
    if (current === "CONFIRMED") return [step("markKitchenPreparing"), step("markKitchenPrepared")];
    if (current === "PREPARING") return [step("markKitchenPrepared")];
    return [];
  }

  if (!context.kitchenEnabled) {
    if (current === "PREPARING") return [step("markKitchenPrepared")];
    if (current === "CONFIRMED" && !context.delivery && !context.pickup) {
      return [{ action: "markWaiterDeliveredToCustomer", status: "DELIVERED", label: "Servis et" }];
    }
    if (current === "CONFIRMED" && context.pickup) return [step("markWaiterDeliveredToCustomer")];
    if (current === "CONFIRMED" && context.delivery && !context.courierEnabled) return deliverWithoutCourier(context);
    if (current === "CONFIRMED" && context.delivery && context.courierEnabled) return [step("markReady")];
    if (current === "READY" && context.delivery && !context.courierEnabled) return deliverWithoutCourier(context);
    if (current === "READY" && context.delivery) return courierRelease(context);
    if (current === "READY" && context.pickup) return [step("markWaiterDeliveredToCustomer")];
    const inFlight = inFlightCourierActions(current, context);
    if (inFlight) return inFlight;
    return [];
  }

  if (current === "CONFIRMED") return [step("markKitchenPreparing")];
  if (current === "PREPARING") return [step("markKitchenPrepared")];
  if (current === "READY" && context.delivery && !context.courierEnabled) return deliverWithoutCourier(context);
  if (current === "READY" && context.delivery) return courierRelease(context);
  if (current === "READY" && context.pickup) return [step("markWaiterDeliveredToCustomer")];
  const inFlight = inFlightCourierActions(current, context);
  if (inFlight) return inFlight;
  return [];
}

export function kitchenOrderActions(status: string | null | undefined, context: OrderFlowContext): OrderFlowStep[] {
  const steps = nextOrderActions(status, context);
  if (!context.kitchenEnabled && !context.marketplace) {
    return steps.filter((item) => {
      if (item.action === "markWaiterDeliveredToCustomer" && !context.delivery && !context.pickup) return false;
      return (
        item.action === "markReady" ||
        item.action === "markKitchenPrepared" ||
        item.action === "markWaiterDeliveredToCustomer"
      );
    });
  }
  return steps.filter(
    (item) => KITCHEN_ACTIONS.has(item.action) || (!context.courierEnabled && item.action === "markWaiterDeliveredToCustomer"),
  );
}

const WAITER_OFF_KITCHEN_ACTIONS = new Set<OrderFlowAction>([
  "markReady",
  "markKitchenPrepared",
  "markWaiterDeliveredToCustomer",
  "markKitchenDeliveredToCourier",
]);

export function waiterOrderActions(status: string | null | undefined, context: OrderFlowContext): OrderFlowStep[] {
  return nextOrderActions(status, context).filter((item) => WAITER_ACTIONS.has(item.action));
}

export function waiterModeActions(status: string | null | undefined, context: OrderFlowContext): OrderFlowStep[] {
  const allowed = context.kitchenEnabled ? WAITER_ACTIONS : WAITER_OFF_KITCHEN_ACTIONS;
  return nextOrderActions(status, context).filter((item) => allowed.has(item.action));
}

export function orderFlowContextFor(
  order: { deliveryType?: string | null; orderSource?: string | null; deliveryAddress?: string | null },
  flags: { kitchenEnabled: boolean; courierEnabled: boolean },
): OrderFlowContext {
  const delivery = orderIsDelivery(order);
  return {
    kitchenEnabled: flags.kitchenEnabled,
    courierEnabled: flags.courierEnabled,
    delivery,
    pickup: orderIsPickup(order),
    marketplace: orderIsMarketplace(order),
  };
}

export function courierOrderActions(status: string | null | undefined, context: OrderFlowContext): OrderFlowStep[] {
  if (context.marketplace) return [];
  return nextOrderActions(status, context).filter((item) => COURIER_ACTIONS.has(item.action));
}

export function canWaiterCollectPayment(
  status: string | null | undefined,
  delivery = false,
  kitchenEnabled = true,
): boolean {
  if (delivery) return false;
  const normalized = normalizeOrderStatus(status, delivery);
  if (normalized === "READY") return true;
  if (!kitchenEnabled && (normalized === "CONFIRMED" || normalized === "PREPARING")) return true;
  return false;
}

export function isWaiterPlacedOrder(order: { orderSource?: string | null }): boolean {
  return (order.orderSource ?? "").trim().toUpperCase() === "WAITER";
}

export function orderBlocksWaiterPayment(
  status: string | null | undefined,
  delivery = false,
  kitchenEnabled = true,
  orderSource?: string | null,
): boolean {
  const normalized = normalizeOrderStatus(status, delivery);
  if (
    normalized === "CANCELLED" ||
    normalized === "REJECTED" ||
    normalized === "DRAFT" ||
    normalized === "DELIVERED" ||
    normalized === "PAID" ||
    delivery
  ) {
    return false;
  }
  if (isWaiterPlacedOrder({ orderSource }) && normalized !== "PENDING") return false;
  return !canWaiterCollectPayment(normalized, false, kitchenEnabled);
}

/**
 * Mutfak açıksa tam kapanış, hazırlanmakta olan müşteri siparişi varken açılmaz.
 * Garsonun kendi aldığı siparişte teslim unutulabilir; hesap kapanabilir.
 * Parça ödeme bu kapıdan geçmez ve statü yazmaz.
 */
export function waiterCanCollectOnOrders(
  orders: ReadonlyArray<{ status: string | null | undefined; deliveryType?: string | null; orderSource?: string | null }>,
  kitchenEnabled = true,
): boolean {
  return orders.every(
    (order) => !orderBlocksWaiterPayment(order.status, orderIsDelivery(order), kitchenEnabled, order.orderSource),
  );
}

export type WaiterServiceAction = "markServicePreparing" | "markServiceDelivered";

export const WAITER_SERVICE_ACTION_LABEL: Record<WaiterServiceAction, string> = {
  markServicePreparing: "Hazırlanıyor",
  markServiceDelivered: "Teslim edildi",
};

export type WaiterServiceColumn = "approve" | "service" | "delivered";

export function waiterServiceColumn(status: string | null | undefined): WaiterServiceColumn | null {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "PENDING") return "approve";
  if (
    normalized === "CONFIRMED" ||
    normalized === "PREPARING" ||
    normalized === "READY" ||
    normalized === "AWAITING_COURIER" ||
    normalized === "ON_THE_WAY"
  ) {
    return "service";
  }
  if (normalized === "DELIVERED" || normalized === "PAID") return "delivered";
  return null;
}

/** Mutfak kapalı masada hazırlık butonu yok. Servis adımı nextOrderActions ile gelir. */
export function waiterServiceActions(status: string | null | undefined): WaiterServiceAction[] {
  void status;
  return [];
}

export function waiterServiceStatusLabel(status: string | null | undefined): string {
  return orderFlowStatusLabel(status, false);
}

export function isCustomerDeliveredStatus(status: string | null | undefined, delivery = false): boolean {
  const normalized = normalizeOrderStatus(status, delivery);
  return normalized === "DELIVERED" || normalized === "PAID";
}

export function isOpenFlowStatus(status: string | null | undefined, delivery = false): boolean {
  const normalized = normalizeOrderStatus(status, delivery);
  if (!normalized || normalized === "DRAFT" || normalized === "CANCELLED" || normalized === "REJECTED") return false;
  if (normalized === "DELIVERED" || normalized === "PAID") return false;
  return (
    normalized === "PENDING" ||
    normalized === "CONFIRMED" ||
    normalized === "PREPARING" ||
    normalized === "READY" ||
    normalized === "AWAITING_COURIER" ||
    normalized === "ON_THE_WAY"
  );
}

export type KitchenFlowColumn = "KITCHEN_PREPARING" | "KITCHEN_PREPARED" | "KITCHEN_HANDED";

export function kitchenFlowColumn(status: string | null | undefined, delivery = false): KitchenFlowColumn | null {
  const normalized = normalizeOrderStatus(status, delivery);
  if (normalized === "PREPARING") return "KITCHEN_PREPARING";
  if (normalized === "READY") return "KITCHEN_PREPARED";
  if (normalized === "AWAITING_COURIER" || normalized === "ON_THE_WAY" || normalized === "DELIVERED") {
    return "KITCHEN_HANDED";
  }
  return null;
}

export type WaiterFlowColumn = "approve" | "cooking" | "deliver" | "delivered";

export function waiterFlowColumn(status: string | null | undefined, delivery = false): WaiterFlowColumn | null {
  const normalized = normalizeOrderStatus(status, delivery);
  if (normalized === "PENDING") return "approve";
  if (normalized === "CONFIRMED" || normalized === "PREPARING") return "cooking";
  if (normalized === "READY") return "deliver";
  if (normalized === "DELIVERED" || normalized === "PAID") return "delivered";
  return null;
}

export type CourierFlowColumn = "HANDOFF" | "TAKEN" | "DELIVERED";

export function courierFlowColumn(status: string | null | undefined, delivery = true): CourierFlowColumn | null {
  const normalized = normalizeOrderStatus(status, delivery);
  if (normalized === "AWAITING_COURIER") return "HANDOFF";
  if (normalized === "ON_THE_WAY") return "TAKEN";
  if (normalized === "DELIVERED") return "DELIVERED";
  return null;
}

export type OrderFlowLane = "kitchen" | "waiter" | "courier";

export function orderFlowLane(status: string | null | undefined, context: OrderFlowContext): OrderFlowLane | null {
  if (!isOpenFlowStatus(status, context.delivery)) return null;
  const normalized = normalizeOrderStatus(status, context.delivery);
  if (context.marketplace && (normalized === "AWAITING_COURIER" || normalized === "ON_THE_WAY")) return null;
  if (normalized === "AWAITING_COURIER" || normalized === "ON_THE_WAY") {
    return context.courierEnabled ? "courier" : "waiter";
  }
  if (normalized === "CONFIRMED" || normalized === "PREPARING" || normalized === "READY") {
    if (!context.kitchenEnabled) return "waiter";
    return "kitchen";
  }
  if (normalized === "PENDING") return "waiter";
  return null;
}

export function orderFlowSteps(context: Pick<OrderFlowContext, "kitchenEnabled" | "courierEnabled" | "delivery" | "pickup" | "marketplace">): Array<{
  status: string;
  label: string;
}> {
  if (context.marketplace) {
    return [
      { status: "CONFIRMED", label: "Onaylandı" },
      { status: "PREPARING", label: "Hazırlanıyor" },
      { status: "READY", label: "Hazır" },
    ];
  }
  if (!context.kitchenEnabled && context.delivery && context.courierEnabled) {
    return [
      { status: "CONFIRMED", label: "Onaylandı" },
      { status: "READY", label: "Hazır" },
      { status: "AWAITING_COURIER", label: "Kurye bekliyor" },
      { status: "ON_THE_WAY", label: "Yolda" },
      { status: "DELIVERED", label: "Teslim edildi" },
    ];
  }
  if (!context.kitchenEnabled && !context.delivery && !context.pickup) {
    return [
      { status: "CONFIRMED", label: "Onaylandı" },
      { status: "DELIVERED", label: "Servis edildi" },
      { status: "PAID", label: "Ödeme alındı" },
    ];
  }
  if (!context.kitchenEnabled) {
    return [
      { status: "CONFIRMED", label: "Onaylandı" },
      { status: "DELIVERED", label: context.pickup ? "Teslim edildi" : "Tamamlandı" },
    ];
  }
  const steps: Array<{ status: string; label: string }> = [
    { status: "CONFIRMED", label: "Onaylandı" },
    { status: "PREPARING", label: "Hazırlanıyor" },
    { status: "READY", label: "Hazır" },
  ];
  if (context.delivery && context.courierEnabled) {
    steps.push(
      { status: "AWAITING_COURIER", label: "Kurye bekliyor" },
      { status: "ON_THE_WAY", label: "Yolda" },
      { status: "DELIVERED", label: "Teslim edildi" },
    );
    return steps;
  }
  steps.push({ status: "DELIVERED", label: context.delivery || context.pickup ? "Teslim edildi" : "Tamamlandı" });
  return steps;
}

export function orderFlowStepIndex(status: string | null | undefined, context: OrderFlowContext): number {
  const normalized = normalizeOrderStatus(status, context.delivery);
  if (normalized === "PENDING" || normalized === "DRAFT" || normalized === "REJECTED" || normalized === "CANCELLED") {
    return -1;
  }
  return orderFlowSteps(context).findIndex((stepItem) => stepItem.status === normalized);
}

export function storeHttpStepsFor(
  action: OrderFlowAction,
  currentStatus: string | null | undefined,
  delivery: boolean,
): string[] {
  const status = normalizeOrderStatus(currentStatus, delivery);
  switch (action) {
    case "markKitchenPreparing":
      return ["preparing"];
    case "markKitchenPrepared":
    case "markReady":
      return status === "READY" ? [] : ["ready"];
    case "markCourierTaken":
      return ["dispatch"];
    case "markCourierDeliveredToCustomer":
    case "markWaiterDeliveredToCustomer":
      return ["deliver"];
    default:
      return [];
  }
}

export function waiterHttpStep(
  action: OrderFlowAction,
  asWaiter = false,
): { scope: "kitchen" | "waiter" | "courier"; path: string } | null {
  switch (action) {
    case "markKitchenPreparing":
      return { scope: "kitchen", path: "preparing" };
    case "markKitchenPrepared":
    case "markReady":
      return asWaiter ? { scope: "waiter", path: "ready" } : { scope: "kitchen", path: "ready" };
    case "markCourierRelease":
      return { scope: "courier", path: "release" };
    case "markWaiterDeliveredToCustomer":
      return { scope: "waiter", path: "served" };
    case "markCourierTaken":
      return { scope: "courier", path: "dispatch" };
    case "markCourierDeliveredToCustomer":
      return { scope: "courier", path: "deliver" };
    default:
      return null;
  }
}
