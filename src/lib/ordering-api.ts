import {
  forgetOrderFlowStatus,
  type KitchenRevertTarget,
  type OrderCancelReason,
  type OrderCancelRequest,
} from "@/lib/order-flow";
import { asKitchenTickets } from "@/lib/store-kitchen";

export type TableSessionResponse = {
  sessionToken: string;
  tableId: number;
  menuId: number;
  tableName: string;
  expiresAt?: string | null;
};

export type OrderItemResponse = {
  id?: number;
  productId: number;
  productName?: string;
  unitPrice?: number | string;
  quantity: number;
  note?: string | null;
  lineTotal?: number | string;
  selectedOptions?: Array<{
    groupId?: number;
    groupName?: string;
    optionId?: number;
    optionName?: string;
    priceDelta?: number | string;
  }>;
};

export type OrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "PAID"
  | "ON_THE_WAY"
  | "DELIVERED"
  | "REJECTED"
  | "CANCELLED"
  | "KITCHEN_PREPARING"
  | "KITCHEN_PREPARED"
  | "KITCHEN_DELIVERED_TO_WAITER"
  | "KITCHEN_DELIVERED_TO_COURIER"
  | "WAITER_TAKEN"
  | "COURIER_TAKEN"
  | "WAITER_DELIVERED_TO_CUSTOMER"
  | "WAITER_DELIVERED_TO_COURIER"
  | "COURIER_DELIVERED_TO_CUSTOMER"
  | string;

/** Exact FE contract from qr-service OrderCampaignSummary.stampCardProgress */
export type StampCardProgress = {
  campaignId: number;
  campaignName: string;
  currentQuantity: number;
  requiredQuantity: number;
  earned: boolean;
};

export type OrderCampaignSummary = {
  campaignProductCount?: number;
  guestOrder?: boolean;
  rewardEligible?: boolean;
  hint?: string | null;
  stampCardProgress?: StampCardProgress[];
};

export type OrderResponse = {
  id: number;
  menuId?: number;
  branchId?: number | null;
  tableId?: number;
  tableName?: string | null;
  tableSessionId?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  customerEmail?: string | null;
  orderSource?: "QR" | "WAITER" | "UBER_EATS" | "STORE" | "ONLINE" | "YEMEKSEPETI" | string | null;
  externalOrderId?: string | null;
  orderNumber?: string | null;
  customerPhone?: string | null;
  deliveryType?: string | null;
  deliveryAddress?: string | null;
  courierStaffId?: number | null;
  courierStaffName?: string | null;
  status: OrderStatus;
  totalAmount?: number | string | null;
  currency?: string | null;
  note?: string | null;
  staffId?: number | null;
  waiterId?: number | null;
  waiterName?: string | null;
  waiterNote?: string | null;
  kitchenNote?: string | null;
  billId?: number | null;
  tipAmount?: number | string | null;
  commissionAmount?: number | string | null;
  items?: OrderItemResponse[];
  submittedAt?: string | null;
  confirmedAt?: string | null;
  preparedAt?: string | null;
  readyAt?: string | null;
  servedAt?: string | null;
  rejectedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: OrderCancelReason | string | null;
  cancelReasonNote?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  campaignSummary?: OrderCampaignSummary | null;
};

export type CartItemRequest = {
  productId: number;
  quantity: number;
  note?: string;
  selectedOptionIds?: number[];
};

export type UpdateCartRequest = {
  items: CartItemRequest[];
  note?: string;
};

export type RestaurantArea = {
  id: number;
  menuId: number | null;
  name: string;
  sortOrder?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type RestaurantTable = {
  id: number;
  menuId: number | null;
  areaId?: number | null;
  areaName?: string | null;
  name: string;
  tableNumber?: number | null;
  capacity?: number | null;
  layoutX?: number | null;
  layoutY?: number | null;
  layoutRotation?: number | null;
  layoutShape?: string | null;
  publicToken: string;
  publicUrl?: string | null;
  qrImageBase64?: string | null;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export class OrderingApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function sessionHeaders(sessionToken: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Table-Session": sessionToken,
  };
}

export async function openTableSession(
  identifier: string,
  tableToken?: string | null,
): Promise<TableSessionResponse> {
  const response = await fetch(`/api/menu/public/${encodeURIComponent(identifier)}/table-session`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(tableToken ? { tableToken } : {}),
  });
  const data = await parseJson<TableSessionResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Masa oturumu açılamadı");
  }
  return data;
}

export async function getCart(identifier: string, sessionToken: string): Promise<OrderResponse> {
  const response = await fetch(`/api/menu/public/${encodeURIComponent(identifier)}/cart`, {
    method: "GET",
    headers: sessionHeaders(sessionToken),
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Sepet alınamadı");
  }
  return data;
}

export async function putCart(
  identifier: string,
  sessionToken: string,
  payload: UpdateCartRequest,
): Promise<OrderResponse> {
  const { getOrCreateMenuSessionId, trackMenuAnalyticsEvent } = await import("@/lib/menu-analytics");
  const analyticsSessionId = getOrCreateMenuSessionId(identifier);
  for (const item of payload.items ?? []) {
    trackMenuAnalyticsEvent(identifier, "ADD_TO_CART", { productId: item.productId });
  }
  const response = await fetch(`/api/menu/public/${encodeURIComponent(identifier)}/cart`, {
    method: "PUT",
    headers: {
      ...sessionHeaders(sessionToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...payload, analyticsSessionId }),
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Sepet güncellenemedi");
  }
  return data;
}

export async function submitOrder(
  identifier: string,
  sessionToken: string,
): Promise<OrderResponse> {
  const { getOrCreateMenuSessionId, trackMenuAnalyticsEvent } = await import("@/lib/menu-analytics");
  const analyticsSessionId = getOrCreateMenuSessionId(identifier);
  trackMenuAnalyticsEvent(identifier, "CHECKOUT_START");
  const response = await fetch(
    `/api/menu/public/${encodeURIComponent(identifier)}/orders/submit`,
    {
      method: "POST",
      headers: {
        ...sessionHeaders(sessionToken),
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({ analyticsSessionId }),
    },
  );
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Sipariş gönderilemedi");
  }
  trackMenuAnalyticsEvent(identifier, "ORDER_SUBMITTED");
  return data;
}

export async function getOrder(
  identifier: string,
  sessionToken: string,
  orderId: number | string,
): Promise<OrderResponse> {
  const response = await fetch(
    `/api/menu/public/${encodeURIComponent(identifier)}/orders/${encodeURIComponent(String(orderId))}`,
    {
      method: "GET",
      headers: sessionHeaders(sessionToken),
    },
  );
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Sipariş alınamadı");
  }
  return data;
}

export async function getCustomerOrders(publicId: string): Promise<OrderResponse[]> {
  const response = await fetch(`/api/customer/orders?publicId=${encodeURIComponent(publicId)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<OrderResponse[] | { message?: string }>(response);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && !Array.isArray(data) && "message" in data
        ? String(data.message)
        : "Siparişler alınamadı";
    throw new OrderingApiError(response.status, message);
  }
  return Array.isArray(data) ? data : [];
}

export async function getCustomerOrder(orderId: number | string): Promise<OrderResponse> {
  const response = await fetch(`/api/customer/orders/${encodeURIComponent(String(orderId))}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Sipariş alınamadı");
  }
  return data;
}

export async function listMenuTables(menuId: number): Promise<RestaurantTable[]> {
  const response = await fetch(`/api/staff/panel/menu/${menuId}/tables`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<RestaurantTable[] | { message?: string }>(response);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && !Array.isArray(data) && "message" in data
        ? String(data.message)
        : "Masalar alınamadı";
    throw new OrderingApiError(response.status, message);
  }
  return Array.isArray(data) ? data : [];
}

export async function listMenuAreas(menuId: number): Promise<RestaurantArea[]> {
  const response = await fetch(`/api/staff/panel/menu/${menuId}/areas`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<RestaurantArea[] | { message?: string }>(response);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && !Array.isArray(data) && "message" in data
        ? String(data.message)
        : "Alanlar alınamadı";
    throw new OrderingApiError(response.status, message);
  }
  return Array.isArray(data) ? data : [];
}

export async function createMenuArea(menuId: number, name: string): Promise<RestaurantArea> {
  const response = await fetch(`/api/staff/panel/menu/${menuId}/areas`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ name }),
  });
  const data = await parseJson<RestaurantArea & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Alan eklenemedi");
  }
  return data;
}

export async function updateMenuArea(
  menuId: number,
  areaId: number,
  payload: { name: string },
): Promise<RestaurantArea> {
  const response = await fetch(`/api/staff/panel/menu/${menuId}/areas/${areaId}`, {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<RestaurantArea & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Alan güncellenemedi");
  }
  return data;
}

export async function deleteMenuArea(menuId: number, areaId: number): Promise<void> {
  const response = await fetch(`/api/staff/panel/menu/${menuId}/areas/${areaId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok && response.status !== 204) {
    const data = await parseJson<{ message?: string }>(response);
    throw new OrderingApiError(response.status, data.message || "Alan silinemedi");
  }
}

export type MenuTablePayload = {
  name?: string;
  tableNumber?: number | null;
  active?: boolean;
  areaId?: number | null;
  capacity?: number | null;
  layoutX?: number | null;
  layoutY?: number | null;
  layoutRotation?: number | null;
  layoutShape?: string | null;
};

export async function createMenuTable(
  menuId: number,
  payload: {
    name: string;
    tableNumber?: number | null;
    areaId?: number | null;
    capacity?: number | null;
    layoutX?: number | null;
    layoutY?: number | null;
    layoutRotation?: number | null;
    layoutShape?: string | null;
  },
): Promise<RestaurantTable> {
  const response = await fetch(`/api/staff/panel/menu/${menuId}/tables`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<RestaurantTable & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Masa eklenemedi");
  }
  return data;
}

export async function updateMenuTable(
  menuId: number,
  tableId: number,
  payload: MenuTablePayload,
): Promise<RestaurantTable> {
  const response = await fetch(`/api/staff/panel/menu/${menuId}/tables/${tableId}`, {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<RestaurantTable & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Masa güncellenemedi");
  }
  return data;
}

export async function regenerateMenuTableQr(
  menuId: number,
  tableId: number,
): Promise<RestaurantTable> {
  const response = await fetch(`/api/staff/panel/menu/${menuId}/tables/${tableId}/regenerate-qr`, {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<RestaurantTable & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "QR yenilenemedi");
  }
  return data;
}

export type CatalogLayout = {
  id: number;
  name: string;
  branchId: number | null;
  branchName: string | null;
  areaCount: number;
  tableCount: number;
  menuLinked: boolean;
};

export async function listCatalogLayouts(): Promise<CatalogLayout[]> {
  const response = await fetch("/api/staff/panel/catalog/layouts", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<CatalogLayout[] | { message?: string }>(response);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && !Array.isArray(data) && "message" in data
        ? String(data.message)
        : "Düzenler alınamadı";
    throw new OrderingApiError(response.status, message);
  }
  return Array.isArray(data) ? data : [];
}

export async function createCatalogLayout(name: string): Promise<CatalogLayout> {
  const response = await fetch("/api/staff/panel/catalog/layouts", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ name }),
  });
  const data = await parseJson<CatalogLayout & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Düzen oluşturulamadı");
  }
  return data;
}

export async function updateCatalogLayout(
  layoutId: number,
  payload: { name: string },
): Promise<CatalogLayout> {
  const response = await fetch(`/api/staff/panel/catalog/layouts/${layoutId}`, {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<CatalogLayout & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Düzen güncellenemedi");
  }
  return data;
}

export async function deleteCatalogLayout(layoutId: number): Promise<void> {
  const response = await fetch(`/api/staff/panel/catalog/layouts/${layoutId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok && response.status !== 204) {
    const data = await parseJson<{ message?: string }>(response);
    throw new OrderingApiError(response.status, data.message || "Düzen silinemedi");
  }
}

export async function assignCatalogLayout(
  layoutId: number,
  branchId: number | null,
): Promise<CatalogLayout> {
  const response = await fetch(`/api/staff/panel/catalog/layouts/${layoutId}/assign`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ branchId }),
  });
  const data = await parseJson<CatalogLayout & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Düzen bağlanamadı");
  }
  return data;
}

export async function listCatalogAreas(layoutId: number): Promise<RestaurantArea[]> {
  const response = await fetch(`/api/staff/panel/catalog/layouts/${layoutId}/areas`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<RestaurantArea[] | { message?: string }>(response);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && !Array.isArray(data) && "message" in data
        ? String(data.message)
        : "Alanlar alınamadı";
    throw new OrderingApiError(response.status, message);
  }
  return Array.isArray(data) ? data : [];
}

export async function createCatalogArea(layoutId: number, name: string): Promise<RestaurantArea> {
  const response = await fetch(`/api/staff/panel/catalog/layouts/${layoutId}/areas`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ name }),
  });
  const data = await parseJson<RestaurantArea & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Alan eklenemedi");
  }
  return data;
}

export async function updateCatalogArea(
  layoutId: number,
  areaId: number,
  payload: { name: string },
): Promise<RestaurantArea> {
  const response = await fetch(`/api/staff/panel/catalog/layouts/${layoutId}/areas/${areaId}`, {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<RestaurantArea & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Alan güncellenemedi");
  }
  return data;
}

export async function deleteCatalogArea(layoutId: number, areaId: number): Promise<void> {
  const response = await fetch(`/api/staff/panel/catalog/layouts/${layoutId}/areas/${areaId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok && response.status !== 204) {
    const data = await parseJson<{ message?: string }>(response);
    throw new OrderingApiError(response.status, data.message || "Alan silinemedi");
  }
}

export async function listCatalogTables(layoutId: number): Promise<RestaurantTable[]> {
  const response = await fetch(`/api/staff/panel/catalog/layouts/${layoutId}/tables`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<RestaurantTable[] | { message?: string }>(response);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && !Array.isArray(data) && "message" in data
        ? String(data.message)
        : "Masalar alınamadı";
    throw new OrderingApiError(response.status, message);
  }
  return Array.isArray(data) ? data : [];
}

export async function createCatalogTable(
  layoutId: number,
  payload: {
    name: string;
    tableNumber?: number | null;
    areaId?: number | null;
    capacity?: number | null;
    layoutX?: number | null;
    layoutY?: number | null;
    layoutRotation?: number | null;
    layoutShape?: string | null;
  },
): Promise<RestaurantTable> {
  const response = await fetch(`/api/staff/panel/catalog/layouts/${layoutId}/tables`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<RestaurantTable & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Masa eklenemedi");
  }
  return data;
}

export async function updateCatalogTable(
  layoutId: number,
  tableId: number,
  payload: MenuTablePayload,
): Promise<RestaurantTable> {
  const response = await fetch(`/api/staff/panel/catalog/layouts/${layoutId}/tables/${tableId}`, {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<RestaurantTable & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Masa güncellenemedi");
  }
  return data;
}

export async function regenerateCatalogTableQr(
  layoutId: number,
  tableId: number,
): Promise<RestaurantTable> {
  const response = await fetch(
    `/api/staff/panel/catalog/layouts/${layoutId}/tables/${tableId}/regenerate-qr`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    },
  );
  const data = await parseJson<RestaurantTable & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "QR yenilenemedi");
  }
  return data;
}

export async function deleteCatalogTable(layoutId: number, tableId: number): Promise<void> {
  const response = await fetch(`/api/staff/panel/catalog/layouts/${layoutId}/tables/${tableId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok && response.status !== 204) {
    const data = await parseJson<{ message?: string }>(response);
    throw new OrderingApiError(response.status, data.message || "Masa silinemedi");
  }
}

export async function deleteMenuTable(menuId: number, tableId: number): Promise<void> {
  const response = await fetch(`/api/staff/panel/menu/${menuId}/tables/${tableId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok && response.status !== 204) {
    const data = await parseJson<{ message?: string }>(response);
    throw new OrderingApiError(response.status, data.message || "Masa silinemedi");
  }
}

export async function listMerchantOrders(
  menuId: number,
  status = "ALL",
): Promise<OrderResponse[]> {
  const params = new URLSearchParams({ status });
  const response = await fetch(`/api/staff/panel/menu/${menuId}/orders?${params}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<OrderResponse[] | { message?: string }>(response);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && !Array.isArray(data) && "message" in data
        ? String(data.message)
        : "Siparişler alınamadı";
    throw new OrderingApiError(response.status, message);
  }
  return Array.isArray(data) ? data : [];
}

export async function listMerchantKitchenQueue(menuId: number): Promise<OrderResponse[]> {
  const response = await fetch(`/api/staff/panel/menu/${menuId}/kitchen/orders`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<unknown>(response);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && !Array.isArray(data) && "message" in data
        ? String((data as { message?: unknown }).message)
        : "Mutfak kuyruğu alınamadı";
    throw new OrderingApiError(response.status, message);
  }
  return asKitchenTickets(data);
}

async function merchantKitchenTransition(
  menuId: number,
  orderId: number,
  action: "preparing" | "ready" | "served",
  fallback: string,
  orderSource?: string | null,
): Promise<OrderResponse> {
  const params = kitchenSourceQuery(orderSource);
  const response = await fetch(`/api/staff/panel/menu/${menuId}/orders/${orderId}/${action}${params}`, {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || fallback);
  }
  return data;
}

function kitchenSourceQuery(orderSource?: string | null): string {
  if (!orderSource) return "";
  return `?source=${encodeURIComponent(orderSource)}`;
}

export async function markMerchantKitchenPreparing(
  menuId: number,
  orderId: number,
  orderSource?: string | null,
): Promise<OrderResponse> {
  return merchantKitchenTransition(menuId, orderId, "preparing", "Hazırlığa alınamadı", orderSource);
}

export async function markMerchantKitchenReady(
  menuId: number,
  orderId: number,
  orderSource?: string | null,
): Promise<OrderResponse> {
  return merchantKitchenTransition(menuId, orderId, "ready", "Hazır işaretlenemedi", orderSource);
}

export async function revertMerchantKitchenOrder(
  menuId: number,
  orderId: number,
  to: KitchenRevertTarget,
  orderSource?: string | null,
): Promise<OrderResponse> {
  const params = new URLSearchParams({ to });
  if (orderSource) params.set("source", orderSource);
  const response = await fetch(`/api/staff/panel/menu/${menuId}/orders/${orderId}/kitchen-revert?${params}`, {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Sipariş geri alınamadı");
  }
  forgetOrderFlowStatus(orderId);
  return data;
}

export async function markMerchantKitchenServed(
  menuId: number,
  orderId: number,
): Promise<OrderResponse> {
  return merchantKitchenTransition(menuId, orderId, "served", "Müşteriye teslim işaretlenemedi");
}

export async function updateMerchantKitchenNote(
  menuId: number,
  orderId: number,
  note: string,
): Promise<OrderResponse> {
  const response = await fetch(`/api/staff/panel/menu/${menuId}/orders/${orderId}/kitchen-note`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ note }),
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Mutfak notu kaydedilemedi");
  }
  return data;
}

export async function getMerchantOrder(
  menuId: number,
  orderId: number,
): Promise<OrderResponse> {
  const response = await fetch(`/api/staff/panel/menu/${menuId}/orders/${orderId}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Sipariş alınamadı");
  }
  return data;
}

export async function cancelMerchantOrder(
  menuId: number,
  orderId: number,
  request?: OrderCancelRequest,
): Promise<OrderResponse> {
  const response = await fetch(`/api/staff/panel/menu/${menuId}/orders/${orderId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(request ?? {}),
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new OrderingApiError(response.status, data.message || "Sipariş iptal edilemedi");
  }
  forgetOrderFlowStatus(orderId);
  return data;
}
