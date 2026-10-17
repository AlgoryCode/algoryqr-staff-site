import { parseNumericId } from "@/lib/auth-user";
import { readKitchenOrderList } from "@/lib/kitchen-queue";
import { loadPackageAccess } from "@/lib/load-package-access";
import { applyOrderFlow, writeOrderFlowStatus } from "@/lib/order-flow";
import type { StoreOrderAction, StoreOrderDetail, StoreOrderPage, StoreOrderSummary } from "@/lib/store-api";
import { formatStoreAddress } from "@/lib/store-ui";

export const STORE_COURIER_STATUSES = [
  "PREPARING",
  "READY",
  "ON_THE_WAY",
  "DELIVERED",
  "KITCHEN_PREPARED",
  "KITCHEN_DELIVERED_TO_COURIER",
  "WAITER_DELIVERED_TO_COURIER",
  "COURIER_TAKEN",
  "COURIER_DELIVERED_TO_CUSTOMER",
] as const;
export type CourierTicketItem = {
  productId: number;
  productName: string;
  quantity: number;
  note?: string | null;
  options: string[];
};

export type CourierTicket = {
  id: number;
  branchId?: number | null;
  orderNo: string;
  status: (typeof STORE_COURIER_STATUSES)[number] | string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  note?: string | null;
  totalAmount: number;
  currency: string;
  paymentMethod?: string | null;
  courierName?: string | null;
  courierPhone?: string | null;
  courierStaffId?: number | null;
  items: CourierTicketItem[];
  createdAt: string;
  readyAt?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
};

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

function mapStoreItems(order: Partial<StoreOrderDetail>): CourierTicketItem[] {
  return (order.items ?? []).map((item) => ({
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    note: item.note,
    options: (item.options ?? []).map((option) => option.optionName).filter(Boolean),
  }));
}

export function isCourierDeliveryOrder(order: Pick<StoreOrderSummary, "deliveryType" | "status">): boolean {
  if (order.deliveryType !== "DELIVERY") return false;
  return STORE_COURIER_STATUSES.includes(order.status as (typeof STORE_COURIER_STATUSES)[number]);
}

export function storeOrderToCourierTicket(order: StoreOrderSummary | StoreOrderDetail): CourierTicket {
  const detail = order as Partial<StoreOrderDetail>;
  const address = detail.address ? formatStoreAddress(detail.address) : "";

  return applyOrderFlow({
    id: order.id,
    branchId: order.branchId ?? null,
    orderNo: order.orderNo,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: address && address !== "-" ? address : "",
    note: detail.note ?? null,
    totalAmount: order.totalAmount,
    currency: order.currency,
    paymentMethod: order.paymentMethod,
    courierName: order.courier?.fullName ?? null,
    courierPhone: order.courier?.phone ?? null,
    courierStaffId:
      parseNumericId(detail.courierStaff?.staffId) ?? parseNumericId(detail.courierStaff?.id) ?? null,
    items: mapStoreItems(detail),
    createdAt: order.createdAt,
    readyAt: detail.readyAt ?? null,
    dispatchedAt: detail.dispatchedAt ?? null,
    deliveredAt: detail.deliveredAt ?? null,
  });
}

export function asCourierTicket(raw: unknown): CourierTicket | null {
  if (!isRecord(raw)) return null;
  const id = Number(raw.id);
  if (!Number.isFinite(id)) return null;
  if (looksLikeStoreOrder(raw)) {
    const order = { ...(raw as unknown as StoreOrderDetail), id };
    if (order.deliveryType && order.deliveryType !== "DELIVERY") return null;
    if (!STORE_COURIER_STATUSES.includes(order.status as (typeof STORE_COURIER_STATUSES)[number])) {
      return null;
    }
    return storeOrderToCourierTicket(order);
  }

  const status = typeof raw.status === "string" ? raw.status : "";
  if (!STORE_COURIER_STATUSES.includes(status as (typeof STORE_COURIER_STATUSES)[number])) {
    return null;
  }

  const items = Array.isArray(raw.items)
    ? raw.items.flatMap((item): CourierTicketItem[] => {
        if (!isRecord(item)) return [];
        const productId = Number(item.productId);
        return [
          {
            productId: Number.isFinite(productId) ? productId : 0,
            productName: typeof item.productName === "string" ? item.productName : `#${productId}`,
            quantity: Number(item.quantity) || 1,
            note: typeof item.note === "string" ? item.note : null,
            options: Array.isArray(item.selectedOptions)
              ? item.selectedOptions
                  .map((option) => (isRecord(option) && typeof option.optionName === "string" ? option.optionName : ""))
                  .filter(Boolean)
              : Array.isArray(item.options)
                ? item.options
                    .map((option) => (typeof option === "string" ? option : isRecord(option) ? String(option.optionName ?? "") : ""))
                    .filter(Boolean)
                : [],
          },
        ];
      })
    : [];

  const branchId =
    typeof raw.branchId === "number" && Number.isFinite(raw.branchId) ? raw.branchId : null;

  return {
    id,
    branchId,
    orderNo:
      (typeof raw.orderNo === "string" && raw.orderNo) ||
      (typeof raw.orderNumber === "string" && raw.orderNumber) ||
      `#${id}`,
    status,
    customerName: typeof raw.customerName === "string" ? raw.customerName : "",
    customerPhone: typeof raw.customerPhone === "string" ? raw.customerPhone : "",
    deliveryAddress: typeof raw.deliveryAddress === "string" ? raw.deliveryAddress : "",
    note: typeof raw.note === "string" ? raw.note : null,
    totalAmount: Number(raw.totalAmount) || 0,
    currency: typeof raw.currency === "string" ? raw.currency : "TRY",
    paymentMethod: typeof raw.paymentMethod === "string" ? raw.paymentMethod : null,
    courierName: typeof raw.courierName === "string" ? raw.courierName : null,
    courierPhone: typeof raw.courierPhone === "string" ? raw.courierPhone : null,
    items,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : typeof raw.submittedAt === "string" ? raw.submittedAt : "",
    readyAt: typeof raw.readyAt === "string" ? raw.readyAt : null,
    dispatchedAt: typeof raw.dispatchedAt === "string" ? raw.dispatchedAt : typeof raw.servedAt === "string" ? raw.servedAt : null,
    deliveredAt: typeof raw.deliveredAt === "string" ? raw.deliveredAt : null,
  };
}

export function asCourierTickets(data: unknown): CourierTicket[] {
  return readKitchenOrderList(data)
    .map(asCourierTicket)
    .filter((order): order is CourierTicket => order != null);
}

export async function listStoreCourierQueue(): Promise<CourierTicket[]> {
  const params = new URLSearchParams({ page: "0", size: "100" });
  for (const status of STORE_COURIER_STATUSES) {
    params.append("status", status);
  }

  const listResponse = await fetchStore(`/api/store/orders?${params}`, { method: "GET" });
  if (!listResponse.ok) return [];

  const listData = readJson(await listResponse.text());
  const content = Array.isArray((listData as StoreOrderPage | null)?.content)
    ? (listData as StoreOrderPage).content
    : Array.isArray(listData)
      ? (listData as StoreOrderSummary[])
      : [];

  const delivery = content.filter(isCourierDeliveryOrder);

  return Promise.all(
    delivery.map(async (summary) => {
      const detailResponse = await fetchStore(`/api/store/orders/${summary.id}`, { method: "GET" });
      if (!detailResponse.ok) return storeOrderToCourierTicket(summary);
      const detail = readJson(await detailResponse.text());
      if (!isRecord(detail)) return storeOrderToCourierTicket(summary);
      return storeOrderToCourierTicket(detail as unknown as StoreOrderDetail);
    }),
  );
}

export async function advanceStoreCourierOrder(
  orderId: number,
  action: Extract<StoreOrderAction, "dispatch" | "deliver">,
): Promise<CourierTicket> {
  const response = await fetchStore(`/api/store/orders/${orderId}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const data = readJson(await response.text());
  if (!response.ok) {
    throw new Error(messageFromUnknown(data, "Sipariş güncellenemedi"));
  }
  const ticket = asCourierTicket(data);
  if (!ticket) {
    throw new Error("Sipariş güncellenemedi");
  }
  writeOrderFlowStatus(
    ticket.id,
    action === "dispatch" ? "ON_THE_WAY" : "DELIVERED",
  );
  return ticket;
}
