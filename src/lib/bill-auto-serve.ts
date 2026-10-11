import {
  isWaiterPlacedOrder,
  normalizeOrderStatus,
  orderIsDelivery,
  orderIsMarketplace,
  orderIsPickup,
} from "@/lib/order-flow";
import type { OrderResponse } from "@/lib/ordering-api";

type ClosedBillForServe = {
  id: number;
  tableId: number;
  items?: { sourceOrderId?: number | null }[] | null;
};

type BillOrder = Pick<OrderResponse, "id" | "status" | "deliveryType" | "orderSource">;

/**
 * Parça ödeme ve kişi başı pay statü yazmaz.
 * Mutfak açıksa hesap kapanınca yalnız hazır masa siparişi teslim edilir.
 * Mutfak kapalıysa kapanış sunucuda ödendi yazar; bu liste o çağrıyı yapmaz.
 * Gel-al ve paket burada teslim edilmez.
 */
export function ordersToDeliverOnBillClose<T extends BillOrder>(orders: readonly T[], kitchenEnabled: boolean): T[] {
  return orders.filter(
    (order) =>
      isTableBillOrder(order) &&
      !isWaiterPlacedOrder(order) &&
      payableTableStatus(order.status, kitchenEnabled),
  );
}

/** Garsonun aldığı ve mutfak kapalı masa siparişi, hesap kapanınca ödeme alındı olur. */
export function ordersToMarkPaidOnBillClose<T extends BillOrder>(orders: readonly T[], kitchenEnabled: boolean): T[] {
  return orders.filter((order) => {
    if (!isTableBillOrder(order)) return false;
    const normalized = normalizeOrderStatus(order.status);
    if (normalized === "DELIVERED" || normalized === "PAID" || normalized === "PENDING") return false;
    if (normalized !== "CONFIRMED" && normalized !== "PREPARING" && normalized !== "READY") return false;
    return !kitchenEnabled || isWaiterPlacedOrder(order);
  });
}

/** Hesabı kapatan tahsilat geri alınırsa masa siparişi kuyruğa döner. */
export function ordersToRestoreOnPaymentReverse<T extends BillOrder>(
  orders: readonly T[],
  kitchenEnabled: boolean,
): Array<T & { status: "READY" | "CONFIRMED" }> {
  return orders.flatMap((order) => {
    if (!isTableBillOrder(order)) return [];
    const normalized = normalizeOrderStatus(order.status);
    if (normalized !== "DELIVERED" && normalized !== "PAID") return [];
    return [{ ...order, status: kitchenEnabled ? "READY" as const : "CONFIRMED" as const }];
  });
}

export function readyOrdersToAutoServe(
  _bill: ClosedBillForServe,
  _readyOrders: OrderResponse[],
  _currentOrderId?: number | null,
): OrderResponse[] {
  return [];
}

function isTableBillOrder(order: BillOrder): boolean {
  if (orderIsDelivery(order) || orderIsPickup(order) || orderIsMarketplace(order)) return false;
  return true;
}

function payableTableStatus(status: string, kitchenEnabled: boolean): boolean {
  const normalized = normalizeOrderStatus(status);
  if (kitchenEnabled) return normalized === "READY";
  return normalized === "CONFIRMED" || normalized === "PREPARING" || normalized === "READY";
}
