import { kitchenOrderOrigin, readKitchenOrderList } from "@/lib/kitchen-queue";
import { loadPackageAccess } from "@/lib/load-package-access";
import {
  applyKitchenOrderFlow,
  applyOrderFlow,
  forgetOrderFlowStatus,
  orderCancelReasonText,
  serverReachedStatus,
  type KitchenRevertTarget,
  type OrderCancelRequest,
} from "@/lib/order-flow";
import { isPhoneCustomerName, stripPhoneCustomerName } from "@/lib/phone-order";
import type { OrderItemResponse, OrderResponse } from "@/lib/ordering-api";
import type { StoreOrderDetail, StoreOrderPage, StoreOrderSummary } from "@/lib/store-api";
import { formatStoreAddress } from "@/lib/store-ui";

const STORE_KITCHEN_STATUSES = [
  "CONFIRMED",
  "PREPARING",
  "READY",
  "ON_THE_WAY",
  "KITCHEN_PREPARING",
  "KITCHEN_PREPARED",
  "KITCHEN_DELIVERED_TO_WAITER",
  "KITCHEN_DELIVERED_TO_COURIER",
] as const;

function readJson(value: string): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function fetchStore(path: string, init?: RequestInit): Promise<Response> {
  const request = () =>
    fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });

  const first = await request();
  if (first.status !== 401) return first;

  const refreshed = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: "{}",
  });
  if (!refreshed.ok) return first;
  void loadPackageAccess(true);
  return request();
}

function messageFromUnknown(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function looksLikeStoreOrder(raw: Record<string, unknown>): boolean {
  if (typeof raw.orderNo === "string") return true;
  if (raw.address != null && typeof raw.address === "object") return true;
  if (!Array.isArray(raw.items) || raw.items.length === 0) return false;
  return raw.items.some(
    (item) => isRecord(item) && "options" in item && !("selectedOptions" in item),
  );
}

function mapStoreItems(order: Partial<StoreOrderDetail>): OrderItemResponse[] {
  return (order.items ?? []).map((item) => ({
    productId: item.productId,
    productName: item.productName,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    note: item.note,
    lineTotal: item.lineTotal,
    selectedOptions: (item.options ?? []).map((option) => ({
      groupId: option.groupId,
      groupName: option.groupName,
      optionId: option.optionId,
      optionName: option.optionName,
      priceDelta: option.priceDelta,
    })),
  }));
}

export function storeOrderToKitchenTicket(order: StoreOrderSummary | StoreOrderDetail): OrderResponse {
  return applyOrderFlow(storeOrderTicket(order));
}

function storeOrderToKitchenQueueTicket(order: StoreOrderSummary | StoreOrderDetail): OrderResponse {
  return applyKitchenOrderFlow(storeOrderTicket(order));
}

function storeOrderTicket(order: StoreOrderSummary | StoreOrderDetail): OrderResponse {
  const detail = order as Partial<StoreOrderDetail>;
  const address = detail.address ? formatStoreAddress(detail.address) : null;

  const phoneOrder = isPhoneCustomerName(order.customerName);
  return {
    id: order.id,
    customerName: stripPhoneCustomerName(order.customerName) || order.customerName,
    customerPhone: order.customerPhone,
    orderSource: phoneOrder ? "PHONE" : "STORE",
    orderNumber: order.orderNo,
    branchId: order.branchId ?? null,
    deliveryType: order.deliveryType,
    deliveryAddress: address && address !== "-" ? address : null,
    courierStaffId: detail.courierStaff?.id ?? null,
    courierStaffName: detail.courierStaff?.displayName ?? null,
    status: order.status,
    totalAmount: order.totalAmount,
    currency: order.currency,
    note: detail.note ?? null,
    items: mapStoreItems(detail),
    submittedAt: order.createdAt,
    confirmedAt: detail.confirmedAt ?? null,
    readyAt: detail.readyAt ?? null,
    servedAt: detail.dispatchedAt ?? detail.deliveredAt ?? null,
    cancelReasonNote: detail.cancelReason ?? null,
    createdAt: order.createdAt,
  };
}

export function asKitchenTicket(raw: unknown): OrderResponse | null {
  if (!isRecord(raw)) return null;
  const id = Number(raw.id);
  if (!Number.isFinite(id)) return null;
  if (looksLikeStoreOrder(raw)) {
    return storeOrderToKitchenQueueTicket({ ...(raw as unknown as StoreOrderDetail), id });
  }
  return { ...(raw as unknown as OrderResponse), id };
}

export function asKitchenTickets(data: unknown): OrderResponse[] {
  return readKitchenOrderList(data)
    .map(asKitchenTicket)
    .filter((order): order is OrderResponse => order != null);
}

export function isOnlineKitchenSource(orderSource?: string | null): boolean {
  const origin = kitchenOrderOrigin({ orderSource });
  return origin === "ONLINE" || origin === "PHONE";
}

function localIsoDate(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

async function listStoreKitchenDetails(params: URLSearchParams): Promise<OrderResponse[]> {
  const listResponse = await fetchStore(`/api/store/orders?${params}`, { method: "GET" });
  if (!listResponse.ok) return [];

  const listData = readJson(await listResponse.text());
  const content = Array.isArray((listData as StoreOrderPage | null)?.content)
    ? (listData as StoreOrderPage).content
    : Array.isArray(listData)
      ? (listData as StoreOrderSummary[])
      : [];

  return Promise.all(
    content.map(async (summary) => {
      const detailResponse = await fetchStore(`/api/store/orders/${summary.id}`, { method: "GET" });
      if (!detailResponse.ok) return storeOrderToKitchenQueueTicket(summary);
      const detail = readJson(await detailResponse.text());
      if (!isRecord(detail)) return storeOrderToKitchenQueueTicket(summary);
      return storeOrderToKitchenQueueTicket(detail as unknown as StoreOrderDetail);
    }),
  );
}

export async function listStoreKitchenQueue(): Promise<OrderResponse[]> {
  const active = new URLSearchParams({ page: "0", size: "100" });
  for (const status of STORE_KITCHEN_STATUSES) {
    active.append("status", status);
  }
  const today = localIsoDate();
  const cancelled = new URLSearchParams({ page: "0", size: "50", status: "CANCELLED", from: today, to: today });

  const [activeOrders, cancelledOrders] = await Promise.all([
    listStoreKitchenDetails(active),
    listStoreKitchenDetails(cancelled).catch(() => [] as OrderResponse[]),
  ]);
  return [...activeOrders, ...cancelledOrders.filter((order) => order.confirmedAt)];
}

export async function cancelStoreKitchenOrder(orderId: number, request: OrderCancelRequest): Promise<OrderResponse> {
  const response = await fetchStore(`/api/store/orders/${orderId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: orderCancelReasonText(request) }),
  });
  const data = readJson(await response.text());
  if (!response.ok) {
    throw new Error(messageFromUnknown(data, "Sipariş iptal edilemedi"));
  }
  if (!isRecord(data) || !Number.isFinite(Number(data.id))) {
    throw new Error("Sipariş iptal edilemedi");
  }
  forgetOrderFlowStatus(orderId);
  return storeOrderToKitchenTicket(data as unknown as StoreOrderDetail);
}

export type KitchenCourierOption = {
  id: number;
  displayName: string;
  branchId?: number | null;
  available: boolean;
  waitingCount: number;
  onTheRoadCount: number;
};

export async function listKitchenCouriers(branchId?: number | null): Promise<KitchenCourierOption[]> {
  const query = branchId != null ? `?branchId=${branchId}` : "";
  const response = await fetchStore(`/api/store/orders/couriers${query}`, { method: "GET" });
  if (!response.ok) return [];
  const data = readJson(await response.text());
  return Array.isArray(data) ? (data as KitchenCourierOption[]) : [];
}

export async function handoverStoreOrderToCourier(orderId: number, courierStaffId: number): Promise<OrderResponse> {
  const response = await fetchStore(`/api/store/orders/${orderId}/courier-handover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courierStaffId }),
  });
  const data = readJson(await response.text());
  if (!response.ok) {
    throw new Error(messageFromUnknown(data, "Sipariş kuryeye verilemedi"));
  }
  if (!isRecord(data) || !Number.isFinite(Number(data.id))) {
    throw new Error("Sipariş kuryeye verilemedi");
  }
  const rawStatus = typeof data.status === "string" ? data.status : "";
  if (!serverReachedStatus(rawStatus, "AWAITING_COURIER")) {
    throw new Error("Sipariş kuryeye verilemedi");
  }
  forgetOrderFlowStatus(orderId);
  return storeOrderToKitchenTicket(data as unknown as StoreOrderDetail);
}

export async function advanceStoreKitchenOrder(
  orderId: number,
  action: "preparing" | "ready",
): Promise<OrderResponse> {
  const response = await fetchStore(`/api/store/orders/${orderId}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const data = readJson(await response.text());
  if (!response.ok) {
    throw new Error(messageFromUnknown(data, "Sipariş güncellenemedi"));
  }
  if (!isRecord(data) || !Number.isFinite(Number(data.id))) {
    throw new Error("Sipariş güncellenemedi");
  }
  const target = action === "preparing" ? "PREPARING" : "READY";
  const rawStatus = typeof data.status === "string" ? data.status : "";
  if (!serverReachedStatus(rawStatus, target)) {
    throw new Error("Sipariş güncellenemedi");
  }
  forgetOrderFlowStatus(orderId);
  return storeOrderToKitchenTicket(data as unknown as StoreOrderDetail);
}

export async function deliverStoreKitchenOrder(orderId: number): Promise<OrderResponse> {
  const response = await fetchStore(`/api/store/orders/${orderId}/deliver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const data = readJson(await response.text());
  if (!response.ok) {
    throw new Error(messageFromUnknown(data, "Sipariş teslim edilemedi"));
  }
  if (!isRecord(data) || !Number.isFinite(Number(data.id))) {
    throw new Error("Sipariş teslim edilemedi");
  }
  const rawStatus = typeof data.status === "string" ? data.status : "";
  if (!serverReachedStatus(rawStatus, "DELIVERED")) {
    throw new Error("Sipariş teslim edilemedi");
  }
  forgetOrderFlowStatus(orderId);
  return storeOrderToKitchenTicket(data as unknown as StoreOrderDetail);
}

export async function revertStoreKitchenOrder(orderId: number, to: KitchenRevertTarget): Promise<OrderResponse> {
  const response = await fetchStore(`/api/store/orders/${orderId}/revert?to=${to}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const data = readJson(await response.text());
  if (!response.ok) {
    throw new Error(messageFromUnknown(data, "Sipariş geri alınamadı"));
  }
  if (!isRecord(data) || !Number.isFinite(Number(data.id))) {
    throw new Error("Sipariş geri alınamadı");
  }
  forgetOrderFlowStatus(orderId);
  return storeOrderToKitchenTicket(data as unknown as StoreOrderDetail);
}
