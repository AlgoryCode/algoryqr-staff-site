import { applyListQueryParams } from "@/hooks/use-list-query-state";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import {
  isKitchenTicketDelayed,
  kitchenOrderOrigin,
  kitchenOrderOriginLabel,
} from "@/lib/kitchen-queue";
import {
  canWaiterCollectPayment,
  isCustomerDeliveredStatus,
  isOpenFlowStatus,
  normalizeOrderStatus,
  orderFlowLane,
  orderFlowStatusLabel,
  orderIsDelivery,
  type OrderFlowContext,
} from "@/lib/order-flow";
import type { OrderResponse, OrderStatus } from "@/lib/ordering-api";
import type { StoreOrderDetail, StoreOrderSummary } from "@/lib/store-api";
import { storeOrderToKitchenTicket } from "@/lib/store-kitchen";

export type OrderChannel = "QR" | "WAITER" | "ONLINE" | "PHONE" | "UBER_EATS" | "YEMEKSEPETI";

export const ORDER_CHANNELS: OrderChannel[] = [
  "QR",
  "WAITER",
  "ONLINE",
  "PHONE",
  "UBER_EATS",
  "YEMEKSEPETI",
];

export const ORDER_CHANNEL_LABEL: Record<OrderChannel, string> = {
  QR: "QR Masa",
  WAITER: "Garson",
  ONLINE: "Online Sipariş",
  PHONE: "Telefon",
  UBER_EATS: "Uber Eats",
  YEMEKSEPETI: "Yemeksepeti",
};

export type OrderFlowStage = "RECEIVED" | "PREPARING" | "READY" | "DELIVERED" | "CLOSED";

export const ORDER_FLOW_STAGES: OrderFlowStage[] = [
  "RECEIVED",
  "PREPARING",
  "READY",
  "DELIVERED",
  "CLOSED",
];

export const ORDER_FLOW_STAGE_LABEL: Record<OrderFlowStage, string> = {
  RECEIVED: "Alındı",
  PREPARING: "Mutfakta",
  READY: "Hazır",
  DELIVERED: "Teslim",
  CLOSED: "Kapandı",
};

export type OrderStatusFilter =
  | "all"
  | "open"
  | "pending"
  | "preparing"
  | "ready"
  | "served"
  | "cancelled";

export const ORDER_STATUS_FILTER_OPTIONS: { value: OrderStatusFilter; label: string }[] = [
  { value: "all", label: "Tüm durumlar" },
  { value: "open", label: "Açık siparişler" },
  { value: "pending", label: "Alındı" },
  { value: "preparing", label: "Hazırlanıyor" },
  { value: "ready", label: "Hazır" },
  { value: "served", label: "Teslim edildi" },
  { value: "cancelled", label: "İptal / Red" },
];

export type OrderManagementFilters = {
  from?: string;
  to?: string;
  query?: string;
  status?: OrderStatusFilter;
  channel?: "all" | OrderChannel;
  branchId?: number | "all";
};

export const ORDER_MANAGEMENT_PANELS = [
  "orders",
  "kitchen",
  "online",
  "uber-eats",
  "integrations",
  "ops-kitchen",
  "ops-waiter",
  "ops-courier",
] as const;
export type OrderManagementPanel = (typeof ORDER_MANAGEMENT_PANELS)[number];

export function parseOrderManagementPanel(value: string | null): OrderManagementPanel | null {
  return ORDER_MANAGEMENT_PANELS.some((panel) => panel === value)
    ? (value as OrderManagementPanel)
    : null;
}

export function orderManagementPanelHref(
  searchParams: URLSearchParams,
  panel: OrderManagementPanel,
): string {
  const next = applyListQueryParams(searchParams, { panel });
  return `${DASHBOARD_ROUTES.waiter}?${next.toString()}`;
}

export function orderManagementHomeHref(searchParams: URLSearchParams): string {
  const next = applyListQueryParams(searchParams, { panel: null });
  const query = next.toString();
  return query ? `${DASHBOARD_ROUTES.waiter}?${query}` : DASHBOARD_ROUTES.waiter;
}

export function restaurantLayoutFromOrderManagementHref(returnHref: string): string {
  const params = new URLSearchParams();
  params.set("return", returnHref);
  return `${DASHBOARD_ROUTES.restaurantLayout}?${params.toString()}`;
}

export type OrderTimelineEvent = {
  key: string;
  label: string;
  at: string;
};

export function orderStatusLabel(status: OrderStatus): string {
  return orderFlowStatusLabel(status);
}

export function orderAmount(value?: number | string | null): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function orderTimestamp(order: OrderResponse): number | null {
  const raw = order.submittedAt || order.createdAt;
  if (!raw) return null;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? null : time;
}

export function orderCustomerName(order: OrderResponse): string {
  const name = order.customerName?.trim();
  if (name) return name;
  const waiter = order.waiterName?.trim();
  if (waiter) return waiter;
  return "Misafir";
}

export function orderHistoryTitle(order: OrderResponse): string {
  const name = orderCustomerName(order).trim();
  if (name.length >= 2 && name.toLocaleLowerCase("tr-TR") !== "misafir") return name;
  return orderLocationLabel(order);
}

export function orderChannel(order: OrderResponse): OrderChannel {
  const source = (order.orderSource ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (source === "PHONE") return "PHONE";
  if (source === "WAITER") return "WAITER";
  if (source === "QR") return "QR";
  if (source === "UBER_EATS" || source === "UBEREATS" || source === "UBER") return "UBER_EATS";
  if (source === "YEMEKSEPETI" || source === "YEMEK_SEPETI" || source === "YS") return "YEMEKSEPETI";
  if (
    source === "STORE" ||
    source === "ONLINE" ||
    source === "ONLINE_ORDER" ||
    source === "WEB" ||
    source === "ALGORY" ||
    source === "ALGORYQR"
  ) {
    return "ONLINE";
  }

  const origin = kitchenOrderOrigin(order);
  if (origin === "UBER_EATS") return "UBER_EATS";
  if (origin === "YEMEKSEPETI") return "YEMEKSEPETI";
  if (origin === "PHONE") return "PHONE";
  if (origin === "ONLINE") return "ONLINE";
  return "QR";
}

export function orderLocationLabel(order: OrderResponse): string {
  const channel = orderChannel(order);
  if (channel === "QR" || channel === "WAITER") {
    const name = order.tableName?.trim();
    if (name) return name;
    if (order.tableId != null) return `Masa ${order.tableId}`;
    return channel === "WAITER" ? "Garson" : "Masa";
  }
  const delivery = (order.deliveryType ?? "").trim().toUpperCase();
  if (delivery === "PICKUP" || delivery === "STORE") return "Gel al";
  if (delivery === "DELIVERY") return "Teslimat";
  return ORDER_CHANNEL_LABEL[channel];
}

export function orderFlowStage(status: OrderStatus): OrderFlowStage {
  const s = normalizeOrderStatus(status);
  if (s === "PREPARING") return "PREPARING";
  if (s === "READY") return "READY";
  if (s === "AWAITING_COURIER" || s === "ON_THE_WAY" || s === "DELIVERED") return "DELIVERED";
  if (s === "CANCELLED" || s === "REJECTED") return "CLOSED";
  return "RECEIVED";
}

export function isOpenOrderStatus(status: OrderStatus): boolean {
  return isOpenFlowStatus(status);
}

export function countsTowardRevenue(status: OrderStatus): boolean {
  return status !== "CANCELLED" && status !== "REJECTED" && status !== "DRAFT";
}

export function parseYmd(value: string, end = false): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function matchesOrderSearch(order: OrderResponse, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase("tr-TR");
  if (!needle) return true;
  const channel = orderChannel(order);
  const haystack = [
    order.orderNumber,
    order.externalOrderId,
    String(order.id),
    order.customerName,
    order.customerEmail,
    order.customerPhone,
    order.waiterName,
    order.tableName,
    order.deliveryAddress,
    order.note,
    order.waiterNote,
    order.kitchenNote,
    orderLocationLabel(order),
    orderCustomerName(order),
    ORDER_CHANNEL_LABEL[channel],
    kitchenOrderOriginLabel(kitchenOrderOrigin(order)),
    orderStatusLabel(order.status),
    ...(order.items ?? []).flatMap((item) => [
      item.productName,
      item.note,
      ...(item.selectedOptions ?? []).map((option) => option.optionName),
    ]),
  ]
    .filter((part): part is string => Boolean(part && String(part).trim()))
    .join(" ")
    .toLocaleLowerCase("tr-TR");
  return haystack.includes(needle);
}

function matchesStatusFilter(status: OrderStatus, filter: OrderStatusFilter): boolean {
  const s = normalizeOrderStatus(status);
  switch (filter) {
    case "open":
      return isOpenOrderStatus(status);
    case "pending":
      return s === "PENDING" || s === "SUBMITTED";
    case "preparing":
      return s === "PREPARING";
    case "ready":
      return s === "READY";
    case "served":
      return isCustomerDeliveredStatus(s);
    case "cancelled":
      return s === "CANCELLED" || s === "REJECTED";
    default:
      return true;
  }
}

export function filterManagedOrders(
  orders: OrderResponse[],
  filters: OrderManagementFilters,
): OrderResponse[] {
  const from = parseYmd(filters.from ?? "", false);
  const to = parseYmd(filters.to ?? "", true);
  const query = filters.query ?? "";
  const status = filters.status ?? "all";
  const channel = filters.channel ?? "all";
  const branchId = filters.branchId ?? "all";

  return orders.filter((order) => {
    if (branchId !== "all" && order.branchId !== branchId) return false;
    const timestamp = orderTimestamp(order);
    if (from && (timestamp == null || timestamp < from.getTime())) return false;
    if (to && (timestamp == null || timestamp > to.getTime())) return false;
    if (!matchesStatusFilter(order.status, status)) return false;
    if (channel !== "all" && orderChannel(order) !== channel) return false;
    return matchesOrderSearch(order, query);
  });
}

export function sortOrdersNewestFirst(orders: OrderResponse[]): OrderResponse[] {
  return [...orders].sort((a, b) => (orderTimestamp(b) ?? 0) - (orderTimestamp(a) ?? 0));
}

export function tipAmountByOrderId(orders: OrderResponse[]): Map<number, number> {
  const seenBillIds = new Set<number>();
  const tips = new Map<number, number>();

  for (const order of orders) {
    const tip = orderAmount(order.tipAmount);
    if (tip <= 0) continue;
    if (order.billId != null) {
      if (seenBillIds.has(order.billId)) continue;
      seenBillIds.add(order.billId);
    }
    tips.set(order.id, tip);
  }
  return tips;
}

export function sumOrderRevenue(orders: OrderResponse[], includeTips: boolean): number {
  let total = 0;
  const revenueOrders: OrderResponse[] = [];
  for (const order of orders) {
    if (!countsTowardRevenue(order.status)) continue;
    total += orderAmount(order.totalAmount);
    revenueOrders.push(order);
  }
  if (!includeTips) return total;
  for (const tip of tipAmountByOrderId(revenueOrders).values()) {
    total += tip;
  }
  return total;
}

export function sumTipRevenue(orders: OrderResponse[]): number {
  const revenueOrders = orders.filter((order) => countsTowardRevenue(order.status));
  let total = 0;
  for (const tip of tipAmountByOrderId(revenueOrders).values()) {
    total += tip;
  }
  return total;
}

export function itemSummary(order: OrderResponse): string {
  const items = order.items ?? [];
  if (items.length === 0) return "—";
  const first = items[0];
  if (items.length === 1 && !first.productName?.trim()) {
    return first.quantity > 0 ? `${first.quantity} ürün` : "—";
  }
  const label = `${first.quantity}× ${first.productName || `#${first.productId}`}`;
  if (items.length === 1) return label;
  return `${label} +${items.length - 1}`;
}

export function storeOrderToManagedOrder(
  order: StoreOrderSummary | StoreOrderDetail,
): OrderResponse {
  const ticket = storeOrderToKitchenTicket(order);
  if ((ticket.items?.length ?? 0) > 0) return ticket;
  if (order.itemCount > 0) {
    return {
      ...ticket,
      items: [{ productId: 0, productName: "", quantity: order.itemCount }],
    };
  }
  return ticket;
}

/** Replace list summaries with kitchen-queue tickets that include items and address. */
export function overlayStoreKitchenDetails(
  summaries: OrderResponse[],
  detailed: OrderResponse[],
): OrderResponse[] {
  const detailById = new Map(detailed.map((order) => [order.id, order]));
  const used = new Set<number>();
  const merged = summaries.map((order) => {
    const detail = detailById.get(order.id);
    if (!detail) return order;
    used.add(order.id);
    return detail;
  });
  for (const order of detailed) {
    if (!used.has(order.id)) merged.push(order);
  }
  return merged;
}

export function mergeManagedOrders(
  menuOrders: OrderResponse[],
  storeOrders: OrderResponse[],
): OrderResponse[] {
  const storeById = new Map(storeOrders.map((order) => [order.id, order]));
  const consumedStoreIds = new Set<number>();
  const merged: OrderResponse[] = [];

  for (const order of menuOrders) {
    const storeMatch = storeById.get(order.id);
    if (storeMatch && orderChannel(order) === "ONLINE") {
      merged.push(storeMatch);
      consumedStoreIds.add(order.id);
      continue;
    }
    merged.push(order);
  }

  for (const order of storeOrders) {
    if (!consumedStoreIds.has(order.id)) merged.push(order);
  }
  return merged;
}

export function managedOrderKey(order: OrderResponse): string {
  return `${order.orderSource ?? orderChannel(order)}-${order.id}`;
}

export function isFreshOrder(order: OrderResponse, now = Date.now(), windowMs = 15 * 60 * 1000): boolean {
  const timestamp = orderTimestamp(order);
  if (timestamp == null) return false;
  return now - timestamp <= windowMs;
}

export type OrderKpiSnapshot = {
  totalOrders: number;
  openOrders: number;
  pendingOrders: number;
  revenue: number;
  averageBasket: number;
  tipTotal: number;
};

export function buildOrderKpis(orders: OrderResponse[], includeTips: boolean): OrderKpiSnapshot {
  const revenueOrders = orders.filter((order) => countsTowardRevenue(order.status));
  const revenue = sumOrderRevenue(orders, includeTips);
  return {
    totalOrders: orders.length,
    openOrders: orders.filter((order) => isOpenOrderStatus(order.status)).length,
    pendingOrders: orders.filter((order) => {
      const s = normalizeOrderStatus(order.status);
      return s === "PENDING" || s === "SUBMITTED";
    }).length,
    revenue,
    averageBasket: revenueOrders.length > 0 ? revenue / revenueOrders.length : 0,
    tipTotal: sumTipRevenue(orders),
  };
}

export type FlowStageCount = {
  stage: OrderFlowStage;
  label: string;
  count: number;
};

export function flowStageCounts(orders: OrderResponse[]): FlowStageCount[] {
  const counts: Record<OrderFlowStage, number> = {
    RECEIVED: 0,
    PREPARING: 0,
    READY: 0,
    DELIVERED: 0,
    CLOSED: 0,
  };
  for (const order of orders) {
    counts[orderFlowStage(order.status)] += 1;
  }
  return ORDER_FLOW_STAGES.map((stage) => ({
    stage,
    label: ORDER_FLOW_STAGE_LABEL[stage],
    count: counts[stage],
  }));
}

export type ChannelFlowRow = {
  channel: OrderChannel;
  label: string;
  total: number;
  stages: Record<OrderFlowStage, number>;
  revenue: number;
};

export function channelFlowRows(orders: OrderResponse[]): ChannelFlowRow[] {
  return ORDER_CHANNELS.map((channel) => {
    const items = orders.filter((order) => orderChannel(order) === channel);
    const stages: Record<OrderFlowStage, number> = {
      RECEIVED: 0,
      PREPARING: 0,
      READY: 0,
      DELIVERED: 0,
      CLOSED: 0,
    };
    for (const order of items) {
      stages[orderFlowStage(order.status)] += 1;
    }
    return {
      channel,
      label: ORDER_CHANNEL_LABEL[channel],
      total: items.length,
      stages,
      revenue: sumOrderRevenue(items, false),
    };
  });
}

export type DailyOrderPoint = {
  date: string;
  label: string;
  orders: number;
  revenue: number;
};

export function dailyOrderSeries(orders: OrderResponse[]): DailyOrderPoint[] {
  const buckets = new Map<string, DailyOrderPoint>();
  for (const order of orders) {
    const timestamp = orderTimestamp(order);
    if (timestamp == null) continue;
    const date = new Date(timestamp);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const current = buckets.get(key) ?? {
      date: key,
      label: date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
      orders: 0,
      revenue: 0,
    };
    current.orders += 1;
    if (countsTowardRevenue(order.status)) {
      current.revenue += orderAmount(order.totalAmount);
    }
    buckets.set(key, current);
  }
  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type HourlyOrderPoint = {
  hour: string;
  orders: number;
  revenue: number;
};

export function hourlyOrderSeries(orders: OrderResponse[]): HourlyOrderPoint[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    orders: 0,
    revenue: 0,
  }));
  for (const order of orders) {
    const timestamp = orderTimestamp(order);
    if (timestamp == null) continue;
    const hour = new Date(timestamp).getHours();
    buckets[hour].orders += 1;
    if (countsTowardRevenue(order.status)) {
      buckets[hour].revenue += orderAmount(order.totalAmount);
    }
  }
  return buckets;
}

export type TopProductPoint = {
  name: string;
  quantity: number;
  revenue: number;
};

export function topProducts(orders: OrderResponse[], limit = 6): TopProductPoint[] {
  const map = new Map<string, TopProductPoint>();
  for (const order of orders) {
    if (!countsTowardRevenue(order.status)) continue;
    for (const item of order.items ?? []) {
      const name = item.productName?.trim();
      if (!name && (item.productId == null || item.productId === 0)) continue;
      const label = name || `#${item.productId}`;
      const current = map.get(label) ?? { name: label, quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += orderAmount(item.lineTotal ?? Number(item.unitPrice ?? 0) * item.quantity);
      map.set(label, current);
    }
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, limit);
}

export const TABLE_CHANNELS: OrderChannel[] = ["QR", "WAITER"];
export const INTEGRATION_CHANNELS: OrderChannel[] = ["ONLINE", "UBER_EATS", "YEMEKSEPETI"];

export function isTableChannel(channel: OrderChannel): boolean {
  return channel === "QR" || channel === "WAITER";
}

export function isIntegrationChannel(channel: OrderChannel): boolean {
  return channel === "ONLINE" || channel === "UBER_EATS" || channel === "YEMEKSEPETI";
}

export type RevenueShareRow = {
  key: string;
  label: string;
  orders: number;
  openOrders: number;
  revenue: number;
  share: number;
};

function withRevenueShare(
  rows: Array<Omit<RevenueShareRow, "share">>,
): RevenueShareRow[] {
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);
  return rows.map((row) => ({
    ...row,
    share: total > 0 ? (row.revenue / total) * 100 : 0,
  }));
}

export function ordersForChannels(
  orders: OrderResponse[],
  channels: readonly OrderChannel[],
): OrderResponse[] {
  const allowed = new Set<OrderChannel>(channels);
  return orders.filter((order) => allowed.has(orderChannel(order)));
}

export function integrationEarnings(
  orders: OrderResponse[],
  includeTips: boolean,
): { total: number; orders: number; rows: RevenueShareRow[] } {
  const items = ordersForChannels(orders, INTEGRATION_CHANNELS);
  const rows = withRevenueShare(
    INTEGRATION_CHANNELS.map((channel) => {
      const channelOrders = items.filter((order) => orderChannel(order) === channel);
      return {
        key: channel,
        label: ORDER_CHANNEL_LABEL[channel],
        orders: channelOrders.length,
        openOrders: channelOrders.filter((order) => isOpenOrderStatus(order.status)).length,
        revenue: sumOrderRevenue(channelOrders, includeTips),
      };
    }),
  );
  return {
    total: sumOrderRevenue(items, includeTips),
    orders: items.length,
    rows,
  };
}

export const SOURCE_EARNING_KEYS = ["INTERNAL", "ONLINE", "UBER_EATS", "YEMEKSEPETI"] as const;
export type SourceEarningKey = (typeof SOURCE_EARNING_KEYS)[number];

export const SOURCE_EARNING_LABEL: Record<SourceEarningKey, string> = {
  INTERNAL: "İç sipariş",
  ONLINE: "Online Sipariş",
  UBER_EATS: "Uber Eats",
  YEMEKSEPETI: "Yemeksepeti",
};

export function sourceEarnings(
  orders: OrderResponse[],
  includeTips: boolean,
): { total: number; orders: number; rows: RevenueShareRow[] } {
  const internal = ordersForChannels(orders, TABLE_CHANNELS);
  const rows = withRevenueShare(
    SOURCE_EARNING_KEYS.map((key) => {
      const channelOrders =
        key === "INTERNAL"
          ? internal
          : key === "ONLINE"
            ? ordersForChannels(orders, ["ONLINE", "PHONE"])
            : ordersForChannels(orders, [key]);
      return {
        key,
        label: SOURCE_EARNING_LABEL[key],
        orders: channelOrders.length,
        openOrders: channelOrders.filter((order) => isOpenOrderStatus(order.status)).length,
        revenue: sumOrderRevenue(channelOrders, includeTips),
      };
    }),
  );
  return {
    total: sumOrderRevenue(orders, includeTips),
    orders: orders.length,
    rows,
  };
}

export function tableChannelEarnings(
  orders: OrderResponse[],
  includeTips: boolean,
): { total: number; orders: number; rows: RevenueShareRow[] } {
  const items = ordersForChannels(orders, TABLE_CHANNELS);
  const rows = withRevenueShare(
    TABLE_CHANNELS.map((channel) => {
      const channelOrders = items.filter((order) => orderChannel(order) === channel);
      return {
        key: channel,
        label: ORDER_CHANNEL_LABEL[channel],
        orders: channelOrders.length,
        openOrders: channelOrders.filter((order) => isOpenOrderStatus(order.status)).length,
        revenue: sumOrderRevenue(channelOrders, includeTips),
      };
    }),
  );
  return {
    total: sumOrderRevenue(items, includeTips),
    orders: items.length,
    rows,
  };
}

export function tableSpotEarnings(
  orders: OrderResponse[],
  includeTips: boolean,
): RevenueShareRow[] {
  const items = ordersForChannels(orders, TABLE_CHANNELS);
  const grouped = new Map<string, OrderResponse[]>();
  for (const order of items) {
    const label = orderLocationLabel(order);
    const list = grouped.get(label) ?? [];
    list.push(order);
    grouped.set(label, list);
  }
  return withRevenueShare(
    [...grouped.entries()].map(([label, tableOrders]) => ({
      key: label,
      label,
      orders: tableOrders.length,
      openOrders: tableOrders.filter((order) => isOpenOrderStatus(order.status)).length,
      revenue: sumOrderRevenue(tableOrders, includeTips),
    })),
  ).sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);
}

export type DailyRevenueSplit = {
  date: string;
  label: string;
  tables: number;
  integrations: number;
  total: number;
};

export function dailyRevenueSplit(
  orders: OrderResponse[],
  includeTips: boolean,
): DailyRevenueSplit[] {
  const buckets = new Map<string, DailyRevenueSplit>();
  const tableSet = new Set<OrderChannel>(TABLE_CHANNELS);
  for (const order of orders) {
    if (!countsTowardRevenue(order.status)) continue;
    const timestamp = orderTimestamp(order);
    if (timestamp == null) continue;
    const date = new Date(timestamp);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const current = buckets.get(key) ?? {
      date: key,
      label: date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
      tables: 0,
      integrations: 0,
      total: 0,
    };
    const amount = orderAmount(order.totalAmount);
    if (tableSet.has(orderChannel(order))) current.tables += amount;
    else current.integrations += amount;
    current.total = current.tables + current.integrations;
    buckets.set(key, current);
  }
  if (includeTips) {
    for (const [orderId, tip] of tipAmountByOrderId(orders.filter((order) => countsTowardRevenue(order.status)))) {
      const order = orders.find((item) => item.id === orderId);
      if (!order) continue;
      const timestamp = orderTimestamp(order);
      if (timestamp == null) continue;
      const date = new Date(timestamp);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const current = buckets.get(key);
      if (!current) continue;
      if (tableSet.has(orderChannel(order))) current.tables += tip;
      else current.integrations += tip;
      current.total = current.tables + current.integrations;
    }
  }
  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type HourlyRevenueSplit = {
  hour: string;
  tables: number;
  integrations: number;
  total: number;
};

export function hourlyRevenueSplit(
  orders: OrderResponse[],
  includeTips: boolean,
): HourlyRevenueSplit[] {
  const buckets: HourlyRevenueSplit[] = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    tables: 0,
    integrations: 0,
    total: 0,
  }));
  const tableSet = new Set<OrderChannel>(TABLE_CHANNELS);
  const add = (order: OrderResponse, amount: number) => {
    const timestamp = orderTimestamp(order);
    if (timestamp == null) return;
    const bucket = buckets[new Date(timestamp).getHours()];
    if (tableSet.has(orderChannel(order))) bucket.tables += amount;
    else bucket.integrations += amount;
    bucket.total = bucket.tables + bucket.integrations;
  };
  for (const order of orders) {
    if (!countsTowardRevenue(order.status)) continue;
    add(order, orderAmount(order.totalAmount));
  }
  if (includeTips) {
    for (const [orderId, tip] of tipAmountByOrderId(orders.filter((order) => countsTowardRevenue(order.status)))) {
      const order = orders.find((item) => item.id === orderId);
      if (order) add(order, tip);
    }
  }
  return buckets;
}

export type OrderChartComparePeriod = "yesterday" | "today" | "7d";
export type OrderChartCompareKey = "today" | "yesterday" | "sevenDay" | "total";

export type OrderChartComparePoint = {
  label: string;
  today?: number;
  yesterday?: number;
  sevenDay?: number;
  total?: number;
};

export type OrderChartCompareSeries = {
  mode: "hour" | "day";
  points: OrderChartComparePoint[];
};

const ORDER_CHART_COMPARE_KEY: Record<OrderChartComparePeriod, Exclude<OrderChartCompareKey, "total">> = {
  today: "today",
  yesterday: "yesterday",
  "7d": "sevenDay",
};

function formatChartDayLabel(ymd: string): string {
  const date = parseYmd(ymd, false);
  if (!date) return ymd;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function eachYmd(from: string, to: string): string[] {
  const start = parseYmd(from, false);
  const end = parseYmd(to, false);
  if (!start || !end) return [];
  const days: string[] = [];
  for (const cursor = new Date(start); cursor.getTime() <= end.getTime(); cursor.setDate(cursor.getDate() + 1)) {
    days.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`,
    );
  }
  return days;
}

function trimChartComparePoints(points: OrderChartComparePoint[]): OrderChartComparePoint[] {
  const keys: OrderChartCompareKey[] = ["today", "yesterday", "sevenDay", "total"];
  const active = (point: OrderChartComparePoint) => keys.some((key) => Number(point[key] ?? 0) > 0);
  const first = points.findIndex(active);
  const last = points.reduce((index, point, i) => (active(point) ? i : index), -1);
  if (first === -1) return points;
  return points.slice(Math.max(0, first - 1), Math.min(points.length, last + 2));
}

export function buildOrderChartCompare(
  orders: OrderResponse[],
  includeTips: boolean,
  periods: readonly OrderChartComparePeriod[],
  ranges: Record<OrderChartComparePeriod, { from: string; to: string }>,
  fallbackRange: { from: string; to: string },
): OrderChartCompareSeries {
  if (periods.length === 0) {
    const scoped = filterManagedOrders(orders, fallbackRange);
    const daily = dailyRevenueSplit(scoped, includeTips);
    const mode = daily.length <= 1 ? "hour" : "day";
    if (mode === "hour") {
      return {
        mode,
        points: trimChartComparePoints(
          hourlyRevenueSplit(scoped, includeTips).map((point) => ({ label: point.hour, total: point.total })),
        ),
      };
    }
    return {
      mode,
      points: daily.map((point) => ({ label: point.label, total: point.total })),
    };
  }

  const hourlyCompare = periods.length > 1 || periods[0] !== "7d";
  if (hourlyCompare) {
    const hourly = periods.map((id) => {
      const scoped = filterManagedOrders(orders, ranges[id]);
      const divisor = id === "7d" ? 7 : 1;
      return {
        key: ORDER_CHART_COMPARE_KEY[id],
        totals: hourlyRevenueSplit(scoped, includeTips).map((point) => point.total / divisor),
      };
    });
    const points = Array.from({ length: 24 }, (_, hour) => {
      const point: OrderChartComparePoint = { label: `${String(hour).padStart(2, "0")}:00` };
      for (const item of hourly) point[item.key] = item.totals[hour] ?? 0;
      return point;
    });
    return { mode: "hour", points: trimChartComparePoints(points) };
  }

  const week = ranges["7d"];
  const byDate = new Map(
    dailyRevenueSplit(filterManagedOrders(orders, week), includeTips).map((row) => [row.date, row.total]),
  );
  return {
    mode: "day",
    points: eachYmd(week.from, week.to).map((date) => ({
      label: formatChartDayLabel(date),
      sevenDay: byDate.get(date) ?? 0,
    })),
  };
}

export type TopProductShare = TopProductPoint & { share: number };

export function topProductShares(orders: OrderResponse[], limit = 8): TopProductShare[] {
  const products = topProducts(orders, limit);
  const totalQty = products.reduce((sum, product) => sum + product.quantity, 0);
  return products.map((product) => ({
    ...product,
    share: totalQty > 0 ? (product.quantity / totalQty) * 100 : 0,
  }));
}

export const OPS_LANES = ["kitchen", "waiter", "courier"] as const;
export type OpsLane = (typeof OPS_LANES)[number];

export const OPS_LANE_LABEL: Record<OpsLane, string> = {
  kitchen: "Mutfak takibi",
  waiter: "Garson takibi",
  courier: "Kurye takibi",
};

export function isDeliveryOrder(order: OrderResponse): boolean {
  const channel = orderChannel(order);
  if (isTableChannel(channel)) return false;
  const delivery = (order.deliveryType ?? "").trim().toUpperCase();
  if (delivery === "PICKUP" || delivery === "STORE") return false;
  if (delivery === "DELIVERY") return true;
  return isIntegrationChannel(channel);
}

/** Garson teslim aldıysa müşteriye teslim edebilir. Paket kurye akışında kalır. */
export function canMarkServedToCustomer(order: OrderResponse): boolean {
  const type = (order.deliveryType ?? "").trim().toUpperCase();
  return (type === "PICKUP" || type === "STORE") && normalizeOrderStatus(order.status) === "READY";
}

/**
 * Live-ops lane routing.
 * - Mutfak açık: erken durumlar (PENDING…KITCHEN_PREPARING) mutfağa gider.
 * - Mutfak kapalı: aynı siparişler doğrudan garsona atanır; mutfak kolonu boş kalır.
 */
export function opsLaneForOrder(
  order: OrderResponse,
  kitchenEnabled = true,
  courierEnabled = true,
): OpsLane | null {
  const delivery = orderIsDelivery(order);
  return orderFlowLane(order.status, { kitchenEnabled, courierEnabled, delivery });
}

export function groupOpsLaneOrders(
  orders: OrderResponse[],
  kitchenEnabled = true,
): Record<OpsLane, OrderResponse[]> {
  const groups: Record<OpsLane, OrderResponse[]> = {
    kitchen: [],
    waiter: [],
    courier: [],
  };
  for (const order of sortOrdersNewestFirst(orders)) {
    const lane = opsLaneForOrder(order, kitchenEnabled);
    if (lane) groups[lane].push(order);
  }
  return groups;
}

export type OpsCountGroup = {
  key: string;
  label: string;
  title: string;
  count: number;
  orders: OrderResponse[];
};

export type OpsLaneSnapshot = {
  lane: OpsLane;
  primary: OpsCountGroup;
  secondary: OpsCountGroup;
  extra: OpsCountGroup | null;
};

export function orderItemQuantity(order: OrderResponse): number {
  const items = order.items ?? [];
  if (items.length === 0) return 1;
  const total = items.reduce((sum, item) => {
    const qty = Number(item.quantity);
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
  }, 0);
  return total > 0 ? total : 1;
}

function opsCountGroup(
  key: string,
  label: string,
  title: string,
  orders: OrderResponse[],
): OpsCountGroup {
  return {
    key,
    label,
    title,
    orders,
    count: orders.reduce((sum, order) => sum + orderItemQuantity(order), 0),
  };
}

export function opsLanePanel(lane: OpsLane): OrderManagementPanel {
  if (lane === "kitchen") return "ops-kitchen";
  if (lane === "waiter") return "ops-waiter";
  return "ops-courier";
}

export function opsLaneFromPanel(panel: string | null): OpsLane | null {
  if (panel === "ops-kitchen") return "kitchen";
  if (panel === "ops-waiter") return "waiter";
  if (panel === "ops-courier") return "courier";
  return null;
}

export function buildOpsLaneSnapshots(
  orders: OrderResponse[],
  kitchenEnabled = true,
): Record<OpsLane, OpsLaneSnapshot> {
  const kitchenWaiting: OrderResponse[] = [];
  const kitchenReady: OrderResponse[] = [];
  const waiterPending: OrderResponse[] = [];
  const waiterActive: OrderResponse[] = [];
  const waiterDone: OrderResponse[] = [];
  const courierTransit: OrderResponse[] = [];
  const courierDone: OrderResponse[] = [];
  const courierPickup: OrderResponse[] = [];

  for (const order of sortOrdersNewestFirst(orders)) {
    const delivery = isDeliveryOrder(order);
    const s = normalizeOrderStatus(order.status, delivery);
    if (s === "CANCELLED" || s === "REJECTED" || s === "DRAFT") continue;

    if (s === "PENDING" || s === "CONFIRMED" || s === "PREPARING") {
      if (kitchenEnabled && s !== "PENDING") {
        kitchenWaiting.push(order);
      } else if (kitchenEnabled && s === "PENDING") {
        waiterActive.push(order);
      } else if (s === "PREPARING") {
        kitchenWaiting.push(order);
      } else {
        waiterActive.push(order);
      }
      continue;
    }
    if (s === "READY") {
      if (kitchenEnabled) kitchenReady.push(order);
      if (!delivery) waiterPending.push(order);
      continue;
    }
    if (s === "AWAITING_COURIER") {
      courierPickup.push(order);
      continue;
    }
    if (s === "ON_THE_WAY") {
      courierTransit.push(order);
      continue;
    }
    if (s === "DELIVERED") {
      if (delivery) courierDone.push(order);
      else waiterDone.push(order);
    }
  }

  const waiterPrimary = kitchenEnabled
    ? opsCountGroup("pending", "teslim edilecek", "Teslim edilecek", waiterPending)
    : opsCountGroup(
        "active",
        "aktif",
        "Garsona atanan",
        [...waiterActive, ...waiterPending],
      );

  return {
    kitchen: {
      lane: "kitchen",
      primary: opsCountGroup("waiting", "bekleyen", "Mutfakta bekleyen", kitchenWaiting),
      secondary: opsCountGroup("ready", "hazır", "Hazır", kitchenReady),
      extra: null,
    },
    waiter: {
      lane: "waiter",
      primary: waiterPrimary,
      secondary: opsCountGroup("done", "teslim edilen", "Teslim edilen", waiterDone),
      extra: kitchenEnabled
        ? null
        : opsCountGroup("pending", "teslim edilecek", "Teslim edilecek", waiterPending),
    },
    courier: {
      lane: "courier",
      primary: opsCountGroup("transit", "dağıtımda", "Dağıtımda", courierTransit),
      secondary: opsCountGroup("done", "teslim edilen", "Teslim edilen", courierDone),
      extra: opsCountGroup("pickup", "teslim alınacak", "Teslim alınacak", courierPickup),
    },
  };
}

export type SalonWaiterGroup = {
  key: string;
  waiterName: string;
  initials: string;
  tableLabels: string[];
  activeTableCount: number;
  orders: OrderResponse[];
};

export type LiveOpsChannelCount = {
  key: string;
  label: string;
  count: number;
};

export type LiveOpsKpiSnapshot = {
  revenue: number;
  openOrders: number;
  tableOrders: number;
  deliveryOrders: number;
  pickupOrders: number;
  kitchenAvgMinutes: number | null;
  kitchenOnTarget: boolean;
  kitchenTargetMinutes: number;
  courierOnRoad: number;
  courierWaiting: number;
  courierAvgMinutes: number | null;
  tableOccupancyPercent: number | null;
  occupiedTables: number;
  emptyTables: number;
  totalTables: number;
};

function waiterInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase("tr-TR");
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toLocaleUpperCase("tr-TR");
}

function salonTableKey(order: OrderResponse): string {
  if (order.tableId != null) return `id:${order.tableId}`;
  const name = order.tableName?.trim();
  if (name) return `name:${name.toLocaleLowerCase("tr-TR")}`;
  return `order:${order.id}`;
}

function orderWaiterNameField(order: OrderResponse): string | null {
  const direct = order.waiterName?.trim();
  if (direct) return direct;
  const extra = order as OrderResponse & {
    assignedWaiterName?: string | null;
    billWaiterName?: string | null;
    openedByWaiterName?: string | null;
    staffName?: string | null;
  };
  for (const value of [
    extra.assignedWaiterName,
    extra.billWaiterName,
    extra.openedByWaiterName,
    extra.staffName,
  ]) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

type SalonWaiterRef = { waiterId: number | null; waiterName: string };

function orderStaffId(order: OrderResponse): number | null {
  const id = order.staffId ?? order.waiterId;
  return typeof id === "number" ? id : null;
}

function indexSalonWaitersByTable(orders: OrderResponse[]): Map<string, SalonWaiterRef> {
  const map = new Map<string, SalonWaiterRef>();
  for (const order of orders) {
    const name = orderWaiterNameField(order);
    if (!name) continue;
    const tableKey = salonTableKey(order);
    const next: SalonWaiterRef = { waiterId: orderStaffId(order), waiterName: name };
    const current = map.get(tableKey);
    if (!current || (next.waiterId != null && current.waiterId == null)) {
      map.set(tableKey, next);
    }
  }
  return map;
}

function salonWaiterGroupKey(ref: SalonWaiterRef, tableKey: string): string {
  if (ref.waiterId != null) return `id:${ref.waiterId}`;
  if (ref.waiterName) return `name:${ref.waiterName.toLocaleLowerCase("tr-TR")}`;
  return `table:${tableKey}`;
}

function resolveSalonWaiterForOrder(
  order: OrderResponse,
  waitersByTable: Map<string, SalonWaiterRef>,
): SalonWaiterRef & { groupKey: string } {
  const tableKey = salonTableKey(order);
  const directName = orderWaiterNameField(order);
  const staffId = orderStaffId(order);
  if (staffId != null) {
    const waiterName = directName ?? waitersByTable.get(tableKey)?.waiterName ?? orderLocationLabel(order);
    const ref = { waiterId: staffId, waiterName };
    return { ...ref, groupKey: salonWaiterGroupKey(ref, tableKey) };
  }
  if (directName) {
    const ref = { waiterId: null, waiterName: directName };
    return { ...ref, groupKey: salonWaiterGroupKey(ref, tableKey) };
  }
  const fromTable = waitersByTable.get(tableKey);
  if (fromTable) {
    return { ...fromTable, groupKey: salonWaiterGroupKey(fromTable, tableKey) };
  }
  const tableLabel = orderLocationLabel(order);
  const ref = { waiterId: null, waiterName: tableLabel };
  return { ...ref, groupKey: `table:${tableKey}` };
}

export function resolveOrderWaiterName(order: OrderResponse, contextOrders: OrderResponse[]): string {
  const tableOrders = contextOrders.filter(
    (item) => isTableChannel(orderChannel(item)) || item.tableName || item.tableId != null,
  );
  const waitersByTable = indexSalonWaitersByTable(tableOrders);
  return resolveSalonWaiterForOrder(order, waitersByTable).waiterName;
}

/** Garson / salon satırında durum metni (mutfak teslimi vs müşteri teslimi). */
export function salonTableOrderStatusLabel(order: OrderResponse, _contextOrders: OrderResponse[]): string {
  const s = normalizeOrderStatus(order.status);
  if (s === "READY") return "Hazır";
  if (s === "DELIVERED") return "Tamamlandı";
  return orderStatusLabel(order.status);
}

function finalizeSalonWaiterGroup(group: Omit<SalonWaiterGroup, "activeTableCount">): SalonWaiterGroup {
  const tableKeys = new Set(group.orders.map((order) => salonTableKey(order)));
  const hideTableLabels =
    tableKeys.size === 1 &&
    group.tableLabels.length === 1 &&
    group.tableLabels[0] === group.waiterName;
  return {
    ...group,
    tableLabels: hideTableLabels ? [] : group.tableLabels,
    activeTableCount: tableKeys.size,
  };
}

/** Salon kolonunda gösterilecek siparişler: masa kanalı + açık / yeni teslim edilmiş. */
export function salonBoardOrders(
  orders: OrderResponse[],
  kitchenEnabled = true,
): OrderResponse[] {
  const lanes = groupOpsLaneOrders(orders, kitchenEnabled);
  const servedToday = orders.filter(
    (order) =>
      !isDeliveryOrder(order) &&
      isTableChannel(orderChannel(order)) &&
      isCustomerDeliveredStatus(order.status) || canWaiterCollectPayment(order.status),
  );
  return sortOrdersNewestFirst([...lanes.waiter, ...servedToday.slice(0, 8)]);
}

export function groupSalonByWaiter(
  orders: OrderResponse[],
  options?: { waiterIndexOrders?: OrderResponse[] },
): SalonWaiterGroup[] {
  const salonOrders = orders.filter(
    (order) => isTableChannel(orderChannel(order)) || order.tableName || order.tableId != null,
  );
  const indexSource = options?.waiterIndexOrders ?? orders;
  const tableOrdersForIndex = indexSource.filter(
    (order) => isTableChannel(orderChannel(order)) || order.tableName || order.tableId != null,
  );
  const waitersByTable = indexSalonWaitersByTable(tableOrdersForIndex);
  const map = new Map<string, Omit<SalonWaiterGroup, "activeTableCount">>();
  for (const order of salonOrders) {
    const resolved = resolveSalonWaiterForOrder(order, waitersByTable);
    const key = resolved.groupKey;
    const current = map.get(key) ?? {
      key,
      waiterName: resolved.waiterName,
      initials: waiterInitials(resolved.waiterName),
      tableLabels: [],
      orders: [],
    };
    current.orders.push(order);
    const table = orderLocationLabel(order);
    if (table && table !== resolved.waiterName && !current.tableLabels.includes(table)) {
      current.tableLabels.push(table);
    }
    map.set(key, current);
  }
  return [...map.values()]
    .map(finalizeSalonWaiterGroup)
    .sort(
      (a, b) =>
        b.activeTableCount - a.activeTableCount ||
        b.orders.length - a.orders.length ||
        a.waiterName.localeCompare(b.waiterName, "tr"),
    );
}

export function courierChannelCounts(orders: OrderResponse[]): LiveOpsChannelCount[] {
  const open = orders.filter(
    (order) =>
      isDeliveryOrder(order) &&
      isOpenOrderStatus(order.status),
  );
  const keys: Array<{ key: OrderChannel; label: string; match: (o: OrderResponse) => boolean }> = [
    { key: "YEMEKSEPETI", label: "Yemeksepeti", match: (o) => orderChannel(o) === "YEMEKSEPETI" },
    { key: "ONLINE", label: "Getir", match: (o) => orderChannel(o) === "ONLINE" },
    { key: "UBER_EATS", label: "Trendyol", match: (o) => orderChannel(o) === "UBER_EATS" },
    { key: "PHONE", label: "Telefon", match: (o) => orderChannel(o) === "PHONE" },
  ];
  return keys.map((row) => ({
    key: row.key,
    label: row.label,
    count: open.filter(row.match).length,
  }));
}

export function averageKitchenPrepMinutes(orders: OrderResponse[], now = Date.now()): number | null {
  const samples: number[] = [];
  for (const order of orders) {
    if (order.status === "CANCELLED" || order.status === "REJECTED" || order.status === "DRAFT") continue;
    const startRaw = order.confirmedAt || order.submittedAt || order.createdAt;
    if (!startRaw) continue;
    const start = new Date(startRaw).getTime();
    if (Number.isNaN(start)) continue;
    const endRaw = order.readyAt || order.preparedAt || order.servedAt;
    const end = endRaw ? new Date(endRaw).getTime() : now;
    if (Number.isNaN(end) || end < start) continue;
    const minutes = (end - start) / 60_000;
    if (minutes > 0 && minutes < 180) samples.push(minutes);
  }
  if (samples.length === 0) return null;
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

export function averageCourierMinutes(orders: OrderResponse[], now = Date.now()): number | null {
  const samples: number[] = [];
  for (const order of orders) {
    if (!isDeliveryOrder(order)) continue;
    const cs = normalizeOrderStatus(order.status);
    if (cs !== "ON_THE_WAY" && cs !== "DELIVERED") continue;
    const startRaw = order.readyAt || order.preparedAt || order.confirmedAt || order.submittedAt;
    if (!startRaw) continue;
    const start = new Date(startRaw).getTime();
    if (Number.isNaN(start)) continue;
    const end = cs === "DELIVERED" && order.servedAt
      ? new Date(order.servedAt).getTime()
      : now;
    if (Number.isNaN(end) || end < start) continue;
    const minutes = (end - start) / 60_000;
    if (minutes > 0 && minutes < 240) samples.push(minutes);
  }
  if (samples.length === 0) return null;
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

const KITCHEN_TARGET_MINUTES = 16;

export function buildLiveOpsKpis(
  orders: OrderResponse[],
  includeTips = false,
  kitchenEnabled = true,
): LiveOpsKpiSnapshot {
  const open = orders.filter((order) => isOpenOrderStatus(order.status));
  let tableOrders = 0;
  let deliveryOrders = 0;
  let pickupOrders = 0;
  const tableNames = new Set<string>();
  const occupied = new Set<string>();

  for (const order of open) {
    const channel = orderChannel(order);
    const delivery = (order.deliveryType ?? "").trim().toUpperCase();
    if (isTableChannel(channel)) {
      tableOrders += 1;
      const table = orderLocationLabel(order);
      tableNames.add(table);
      occupied.add(table);
    } else if (delivery === "PICKUP" || delivery === "STORE") {
      pickupOrders += 1;
    } else if (isDeliveryOrder(order)) {
      deliveryOrders += 1;
    } else {
      pickupOrders += 1;
    }
  }

  for (const order of orders) {
    if (!isTableChannel(orderChannel(order))) continue;
    const table = orderLocationLabel(order);
    if (table) tableNames.add(table);
  }

  const courierOnRoad = open.filter((o) => normalizeOrderStatus(o.status) === "ON_THE_WAY").length;
  const courierWaiting = open.filter((o) => isDeliveryOrder(o) && normalizeOrderStatus(o.status) === "AWAITING_COURIER").length;

  const kitchenAvg = kitchenEnabled ? averageKitchenPrepMinutes(orders) : null;
  const totalTables = Math.max(tableNames.size, occupied.size);
  const occupiedTables = occupied.size;
  const emptyTables = Math.max(0, totalTables - occupiedTables);

  return {
    revenue: sumOrderRevenue(orders, includeTips),
    openOrders: open.length,
    tableOrders,
    deliveryOrders,
    pickupOrders,
    kitchenAvgMinutes: kitchenAvg,
    kitchenOnTarget: kitchenAvg == null || kitchenAvg < KITCHEN_TARGET_MINUTES,
    kitchenTargetMinutes: KITCHEN_TARGET_MINUTES,
    courierOnRoad,
    courierWaiting,
    courierAvgMinutes: averageCourierMinutes(orders),
    tableOccupancyPercent: totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : null,
    occupiedTables,
    emptyTables,
    totalTables,
  };
}

export function tableStatusTone(
  order: OrderResponse,
  now = Date.now(),
): "occupied" | "serving" | "waiting" | "delayed" | "empty" {
  if (isKitchenTicketDelayed(order, now)) return "delayed";
  const s = normalizeOrderStatus(order.status);
  if (s === "READY") return "serving";
  if (s === "PENDING" || s === "CONFIRMED" || s === "PREPARING") {
    return "waiting";
  }
  if (isOpenOrderStatus(order.status)) return "occupied";
  return "empty";
}

export function orderTimeline(order: OrderResponse): OrderTimelineEvent[] {
  const events: OrderTimelineEvent[] = [];
  const push = (key: string, label: string, at?: string | null) => {
    if (!at) return;
    events.push({ key, label, at });
  };
  push("created", "Oluşturuldu", order.createdAt);
  push("submitted", "Gönderildi", order.submittedAt);
  push("confirmed", "Alındı", order.confirmedAt);
  push("preparing", "Mutfağa girdi", order.preparedAt);
  push("ready", "Hazırlandı", order.readyAt);
  push("served", "Teslim edildi", order.servedAt);
  push("rejected", "Reddedildi", order.rejectedAt);
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.at)) return event.key === "served" || event.key === "rejected";
    seen.add(event.at);
    return true;
  });
}

export function formatOrderWhen(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

export function formatOrderWhenCompact(value?: string | null, now = Date.now()): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const diff = now - d.getTime();
  if (diff >= 0) {
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "Az önce";
    if (minutes < 60) return `${minutes} dk önce`;
  }
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  if (d.getTime() >= startOfToday.getTime()) {
    return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  }
  return formatOrderWhen(value);
}

export function formatOrderHistoryDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function needsApprovalOrders(orders: OrderResponse[]): OrderResponse[] {
  return orders.filter((order) => order.status === "PENDING");
}

export function delayedOpenOrders(orders: OrderResponse[], now = Date.now()): OrderResponse[] {
  return orders.filter(
    (order) => isOpenOrderStatus(order.status) && isKitchenTicketDelayed(order, now),
  );
}
