import { isDeliveryOrder, orderLocationLabel, sortOrdersNewestFirst } from "@/lib/order-management";
import {
  isCancelledOrderStatus,
  normalizeOrderStatus,
  orderIsMarketplace,
  waiterFlowColumn,
  waiterServiceColumn,
} from "@/lib/order-flow";
import type { OrderResponse } from "@/lib/ordering-api";

export type WaiterShiftBoard = {
  approve: OrderResponse[];
  cooking: OrderResponse[];
  deliver: OrderResponse[];
  delivered: OrderResponse[];
  cancelled: OrderResponse[];
};

/** Adisyon süreci sekmesinde yalnızca seçili masanın siparişleri. */
export function filterOffTableBoard(board: WaiterShiftBoard): WaiterShiftBoard {
  const offTable = (orders: OrderResponse[]) => orders.filter((order) => order.tableId == null);
  return {
    approve: offTable(board.approve),
    cooking: offTable(board.cooking),
    deliver: offTable(board.deliver),
    delivered: [],
    cancelled: [],
  };
}

export function filterWaiterShiftBoard(
  board: WaiterShiftBoard,
  tableId: number | null | undefined,
): WaiterShiftBoard {
  if (tableId == null) return board;
  const forTable = (orders: OrderResponse[]) => orders.filter((order) => order.tableId === tableId);
  return {
    approve: forTable(board.approve),
    cooking: forTable(board.cooking),
    deliver: forTable(board.deliver),
    delivered: forTable(board.delivered),
    cancelled: forTable(board.cancelled),
  };
}

/** Cancelled and rejected are terminal, so they outrank every stale copy in the other lists. */
const RANK: Record<string, number> = {
  CANCELLED: 99,
  REJECTED: 99,
  PENDING: 1,
  CONFIRMED: 2,
  PREPARING: 3,
  READY: 4,
  AWAITING_COURIER: 5,
  ON_THE_WAY: 5,
  DELIVERED: 8,
  PAID: 9,
};

function norm(status: string | null | undefined): string {
  return normalizeOrderStatus(status);
}

function rankOf(order: OrderResponse): number {
  return RANK[norm(order.status)] ?? 0;
}

/** Masa ve gel-al garsonun işi. Paket kuryede kalır. */
export function isWaiterServiceOrder(order: OrderResponse): boolean {
  return rankOf(order) > 0 && !isDeliveryOrder(order);
}

function preferRicher(current: OrderResponse, incoming: OrderResponse): OrderResponse {
  const incomingRank = rankOf(incoming);
  const currentRank = rankOf(current);
  const status = incomingRank >= currentRank ? incoming.status : current.status;
  return {
    ...current,
    ...incoming,
    status,
    items: incoming.items?.length ? incoming.items : current.items,
    tableName: incoming.tableName ?? current.tableName,
    tableId: incoming.tableId ?? current.tableId,
    orderNumber: incoming.orderNumber || current.orderNumber,
    waiterName: incoming.waiterName?.trim() ? incoming.waiterName : current.waiterName,
    customerName: incoming.customerName?.trim() ? incoming.customerName : current.customerName,
    note: incoming.note ?? current.note,
    kitchenNote: incoming.kitchenNote ?? current.kitchenNote,
    servedAt: incoming.servedAt ?? current.servedAt,
    readyAt: incoming.readyAt ?? current.readyAt,
    billId: incoming.billId ?? current.billId,
  };
}

function indexOrders(orders: OrderResponse[], kitchenEnabled: boolean, courierEnabled: boolean): Map<number, OrderResponse> {
  const byId = new Map<number, OrderResponse>();
  for (const order of orders) {
    if (orderIsMarketplace(order)) continue;
    const deliveryForWaiter = isDeliveryOrder(order) && (!kitchenEnabled || !courierEnabled);
    if (!isWaiterServiceOrder(order) && !deliveryForWaiter) continue;
    const current = byId.get(order.id);
    byId.set(order.id, current ? preferRicher(current, order) : order);
  }
  return byId;
}

function bySubmittedAsc(orders: OrderResponse[]): OrderResponse[] {
  return sortOrdersNewestFirst(orders).reverse();
}

/**
 * Garson vardiyası:
 * onay (PENDING) -> mutfak (KITCHEN_*) -> teslim al (WAITER_TAKEN) -> teslim et (WAITER_DELIVERED_TO_CUSTOMER).
 * İptal / red edilenler ayrı listede kalır.
 */
export function groupWaiterShift(input: {
  pending?: OrderResponse[];
  ready?: OrderResponse[];
  kitchen?: OrderResponse[];
  today?: OrderResponse[];
  servedNow?: OrderResponse[];
  cancelledNow?: OrderResponse[];
  dismissedIds?: number[];
  /** Mutfak kapalıyken onaylı ve hazırlanan siparişler "cooking" listesinde, sunucu SERVED teslim edildi sayılır. */
  kitchenEnabled?: boolean;
  /** Kurye kapalıyken paket garson panelinde biter. */
  courierEnabled?: boolean;
}): WaiterShiftBoard {
  const dismissed = new Set(input.dismissedIds ?? []);
  const kitchenEnabled = input.kitchenEnabled ?? true;
  const courierEnabled = input.courierEnabled !== false;
  const merged = indexOrders(
    [
    ...(input.today ?? []),
    ...(input.kitchen ?? []),
    ...(input.pending ?? []),
    ...(input.ready ?? []),
    ...(input.cancelledNow ?? []),
    ],
    kitchenEnabled,
    courierEnabled,
  );

  for (const order of input.servedNow ?? []) {
    if (!Number.isFinite(order.id)) continue;
    const current = merged.get(order.id);
    const served = preferRicher(current ?? order, { ...order, status: order.status || "READY" });
    merged.set(order.id, served);
  }

  const approve: OrderResponse[] = [];
  const cooking: OrderResponse[] = [];
  const deliver: OrderResponse[] = [];
  const delivered: OrderResponse[] = [];
  const cancelled: OrderResponse[] = [];

  for (const order of merged.values()) {
    if (dismissed.has(order.id)) continue;
    if (orderIsMarketplace(order)) continue;
    if (isCancelledOrderStatus(order.status)) {
      cancelled.push(order);
      continue;
    }
    if (!kitchenEnabled) {
      const serviceCol = waiterServiceColumn(order.status);
      if (serviceCol === "approve") approve.push(order);
      else if (serviceCol === "service") cooking.push(order);
      else if (serviceCol === "delivered" || rankOf(order) > 0) delivered.push(order);
      continue;
    }
    const col = waiterFlowColumn(order.status);
    if (col === "approve") approve.push(order);
    else if (col === "cooking") cooking.push(order);
    else if (col === "deliver") deliver.push(order);
    else if (col === "delivered") delivered.push(order);
    else if (rankOf(order) > 0) delivered.push(order);
  }

  return {
    approve: bySubmittedAsc(approve),
    cooking: bySubmittedAsc(cooking),
    deliver: bySubmittedAsc(deliver),
    delivered: sortOrdersNewestFirst(delivered),
    cancelled: sortOrdersNewestFirst(cancelled),
  };
}

export type DeliveredTableGroup = {
  key: string;
  label: string;
  tableId: number | null;
  orders: OrderResponse[];
};

export type DeliveredTablePayment = "unpaid" | "paid";

export function deliveredTablePayment(input: {
  tableId: number | null;
  orders: ReadonlyArray<{ billId?: number | null }>;
  awaitingPaymentIds: ReadonlySet<number>;
  tablesLoaded: boolean;
}): DeliveredTablePayment {
  if (!input.tablesLoaded) return "unpaid";
  if (input.tableId != null && input.awaitingPaymentIds.has(input.tableId)) return "unpaid";
  const settled =
    input.orders.length > 0 && input.orders.every((order) => (order.billId ?? 0) > 0);
  return settled ? "paid" : "unpaid";
}

/** Açık adisyonu olan masalar. */
export function tableIdsAwaitingPayment(
  tables: ReadonlyArray<{
    tableId: number;
    billStatus?: string | null;
    openBillId?: number | null;
  }>,
): Set<number> {
  const ids = new Set<number>();
  for (const table of tables) {
    if (!Number.isFinite(table.tableId)) continue;
    const status = (table.billStatus ?? "").trim().toUpperCase();
    const openBill = table.openBillId != null && table.openBillId > 0;
    if (status === "OPEN" || openBill) ids.add(table.tableId);
  }
  return ids;
}

/** Teslim edilen siparişleri aynı masanın adisyonunda toplar. */
export function groupDeliveredTables(orders: OrderResponse[]): DeliveredTableGroup[] {
  const groups: DeliveredTableGroup[] = [];
  const index = new Map<string, DeliveredTableGroup>();
  for (const order of orders) {
    const named = order.tableName?.trim();
    const key =
      order.tableId != null
        ? `id:${order.tableId}`
        : named
          ? `name:${named.toLocaleLowerCase("tr-TR")}`
          : `order:${order.id}`;
    const existing = index.get(key);
    if (existing) {
      existing.orders.push(order);
      if (existing.tableId == null && order.tableId != null) existing.tableId = order.tableId;
      continue;
    }
    const group: DeliveredTableGroup = {
      key,
      label: orderLocationLabel(order),
      tableId: order.tableId ?? null,
      orders: [order],
    };
    index.set(key, group);
    groups.push(group);
  }
  return groups;
}

/** Teslim yanıtı ürün ve masa satırını düşürürse kart kaybolmasın. */
export function rememberWaiterDelivery(
  previous: OrderResponse | undefined,
  updated: OrderResponse | undefined,
  orderId: number,
  servedAt = new Date().toISOString(),
): OrderResponse {
  const status = updated?.status || previous?.status || "WAITER_TAKEN";
  const base: OrderResponse = previous ?? updated ?? { id: orderId, status };
  return preferRicher(
    { ...base, id: orderId, status, servedAt: base.servedAt || servedAt },
    {
      ...(updated ?? {}),
      id: orderId,
      status,
      servedAt: updated?.servedAt || base.servedAt || servedAt,
    },
  );
}
