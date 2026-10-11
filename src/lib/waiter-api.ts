import type { CartItemRequest, OrderResponse } from "@/lib/ordering-api";
import {
  applyKitchenOrderFlow,
  applyOrderFlow,
  forgetOrderFlowStatus,
  ORDER_FLOW_ACTION_STATUS,
  serverReachedStatus,
  waiterHttpStep,
  type KitchenRevertTarget,
  type OrderCancelRequest,
  type OrderFlowAction,
} from "@/lib/order-flow";
import { asCourierTickets, type CourierTicket } from "@/lib/store-courier";
import { asKitchenTickets, type KitchenCourierOption } from "@/lib/store-kitchen";

export type MenuOwnerSummary = {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

export type StaffRole = "WAITER" | "KITCHEN" | "COURIER";

export type MenuWaiterMember = {
  id: number;
  branchId?: number | null;
  username: string;
  displayName: string;
  staffRole?: StaffRole | null;
  active: boolean;
  commissionEnabled?: boolean;
  commissionType?: "PERCENT" | "FIXED" | null;
  commissionScope?: "PER_ITEM" | "BILL_TOTAL" | null;
  commissionValue?: number | string | null;
  createdAt?: string | null;
};

export type MenuUsersResponse = {
  owner?: MenuOwnerSummary | null;
  waiters: MenuWaiterMember[];
};

export type MerchantStaffListResponse = {
  staff?: MenuWaiterMember[] | null;
  waiters?: MenuWaiterMember[] | null;
};

export type MenuCustomerItem = {
  customerId: number;
  menuId?: number | null;
  businessId?: number | null;
  menuName?: string | null;
  menuDeleted?: boolean | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  joinedAt?: string | null;
  memberSince?: string | null;
};

export type WaiterAuthResult = {
  accessToken?: string;
  refreshToken?: string;
  waiterId?: number;
  branchId?: number;
  displayName?: string;
  staffRole?: StaffRole;
  message?: string;
};

export type WaiterMe = {
  waiterId: number;
  branchId: number;
  ownerUserId?: number;
  username?: string;
  displayName?: string;
  staffRole?: StaffRole;
  kitchenEnabled?: boolean;
  courierEnabled?: boolean;
  active?: boolean;
  commissionEnabled?: boolean;
  commissionType?: "PERCENT" | "FIXED" | null;
  commissionValue?: number | string | null;
};

export type WaiterTableSummary = {
  tableId: number;
  menuId?: number | null;
  menuName?: string | null;
  tableName?: string | null;
  tableNumber?: number | null;
  areaId?: number | null;
  areaName?: string | null;
  active: boolean;
  pendingOrderCount: number;
  kitchenOrderCount?: number;
  readyOrderCount?: number;
  latestPendingOrderId?: number | null;
  latestPendingStatus?: string | null;
  latestPendingTotal?: number | string | null;
  latestPendingSubmittedAt?: string | null;
  billStatus?: "EMPTY" | "OPEN" | "CLOSED" | null;
  openBillId?: number | null;
  openBillTotal?: number | string | null;
  openBillItemCount?: number | null;
};

export type WaiterBillItem = {
  id: number;
  productId: number;
  productName: string;
  unitPrice?: number | string | null;
  quantity: number;
  paidQuantity?: number;
  unpaidQuantity?: number;
  paidAmount?: number | string | null;
  unpaidAmount?: number | string | null;
  lineTotal?: number | string | null;
  note?: string | null;
  sourceOrderId?: number | null;
  addedByWaiterId?: number | null;
  createdAt?: string | null;
};

export type WaiterBillPayment = {
  id: number;
  amount?: number | string | null;
  paymentMethod?: "CASH" | "CARD" | null;
  paidAt?: string | null;
  splitShareNumber?: number | null;
  splitPersonCount?: number | null;
  tip?: boolean;
  itemSummary?: string | null;
  billItemId?: number | null;
};

export type WaiterSplitShare = {
  shareNumber: number;
  amount?: number | string | null;
  paid?: boolean;
};

export type WaiterSplitPreview = {
  personCount: number;
  remainingTotal?: number | string | null;
  shares?: WaiterSplitShare[];
};

export type WaiterBill = {
  id: number;
  menuId?: number;
  tableId: number;
  tableName?: string | null;
  status?: "OPEN" | "CLOSED";
  openedByWaiterId?: number | null;
  closedByWaiterId?: number | null;
  openedAt?: string | null;
  closedAt?: string | null;
  totalAmount?: number | string | null;
  paidTotal?: number | string | null;
  remainingTotal?: number | string | null;
  currency?: string | null;
  itemCount?: number;
  items?: WaiterBillItem[];
  payments?: WaiterBillPayment[];
  splitPersonCount?: number | null;
  fixedCommissionAmount?: number | string | null;
  paymentMethod?: "CASH" | "CARD" | null;
};

export type WaiterCommissionRecord = {
  id: number;
  billId?: number | null;
  orderId?: number | null;
  recordType?: "PERCENT_ORDER" | "FIXED_TABLE_CLOSE" | "FIXED_ITEM_ADD";
  baseAmount?: number | string | null;
  commissionValueSnapshot?: number | string | null;
  amount?: number | string | null;
  currency?: string | null;
  tableName?: string | null;
  createdAt?: string | null;
};

export type WaiterTodayCommissionSummary = {
  totalAmount?: number | string | null;
  currency?: string | null;
  percentOrderTotal?: number | string | null;
  fixedTableCloseTotal?: number | string | null;
  fixedItemAddTotal?: number | string | null;
  recordCount?: number;
  records?: WaiterCommissionRecord[];
};

export type WaiterCommissionHistory = {
  records: WaiterCommissionRecord[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type WaiterCatalogProduct = {
  productId: number;
  name: string;
  description?: string | null;
  price?: number | string | null;
  currency?: string | null;
  imageUrl?: string | null;
  available: boolean;
  subCategoryId?: number | null;
  subCategorySlug?: string | null;
  subCategoryName?: string | null;
  mainCategoryId?: number | null;
  mainCategoryName?: string | null;
  commissionEligible?: boolean;
  optionGroups?: import("@/lib/api").MenuProductOptionGroupApiItem[];
};

export type WaiterCatalogResponse = {
  products: WaiterCatalogProduct[];
  commissionEnabled?: boolean;
  commissionType?: "PERCENT" | "FIXED" | null;
  commissionValue?: number | string | null;
};

export type WaiterCreateOrderRequest = {
  tableId: number;
  items: CartItemRequest[];
  note?: string;
  waiterNote?: string;
  /** Dashboard-only. Not sent to the order API. */
  kitchenEnabled?: boolean;
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

export type StaffApp = "waiter" | "kitchen" | "courier";

export const STAFF_APP_HEADER = "x-staff-app";

const staffRefreshPromises: Partial<Record<StaffApp, Promise<boolean>>> = {};

const WAITER_PUBLIC_AUTH_PATHS = [
  "/api/staff/auth/login",
  "/api/staff/auth/logout",
  "/api/staff/auth/refresh",
] as const;

function isWaiterPublicAuthPath(url: string): boolean {
  return WAITER_PUBLIC_AUTH_PATHS.some((path) => url.includes(path));
}

const STAFF_APP_STORAGE_KEY = "algory-staff-app";

export function rememberStaffApp(app: StaffApp): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STAFF_APP_STORAGE_KEY, app);
}

export function currentStaffApp(): StaffApp {
  if (typeof window === "undefined") return "waiter";
  const stored = sessionStorage.getItem(STAFF_APP_STORAGE_KEY);
  if (stored === "kitchen" || stored === "courier" || stored === "waiter") return stored;
  if (window.location.pathname.startsWith("/mutfak")) return "kitchen";
  if (window.location.pathname.startsWith("/kurye")) return "courier";
  return "waiter";
}

const STAFF_APP_TRY_ORDER: StaffApp[] = ["waiter", "kitchen", "courier"];

export async function resolveStaffSession(): Promise<{ me: WaiterMe; app: StaffApp } | null> {
  for (const app of STAFF_APP_TRY_ORDER) {
    const response = await fetch("/api/staff/auth/me", {
      credentials: "same-origin",
      headers: { Accept: "application/json", [STAFF_APP_HEADER]: app },
    });
    if (!response.ok) continue;
    const me = await parseJson<WaiterMe>(response);
    rememberStaffApp(app);
    return {
      me: {
        ...me,
        kitchenEnabled: me.kitchenEnabled === true,
        courierEnabled: me.courierEnabled === true,
      },
      app,
    };
  }
  return null;
}

function withStaffAppHeaders(init?: RequestInit, app?: StaffApp): RequestInit {
  const headers = new Headers(init?.headers);
  if (!headers.has(STAFF_APP_HEADER)) {
    headers.set(STAFF_APP_HEADER, app ?? currentStaffApp());
  }
  return { ...init, credentials: "same-origin", headers };
}

export async function refreshWaiterSession(app: StaffApp = currentStaffApp()): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!staffRefreshPromises[app]) {
    staffRefreshPromises[app] = (async () => {
      try {
        const response = await fetch(
          "/api/staff/auth/refresh",
          withStaffAppHeaders(
            {
              method: "POST",
              headers: { Accept: "application/json" },
            },
            app,
          ),
        );
        if (response.status === 401) {
          await fetch("/api/staff/auth/logout", withStaffAppHeaders({ method: "POST" }, app)).catch(
            () => undefined,
          );
          window.location.assign(staffLoginPath(app));
          return false;
        }
        return response.ok;
      } catch {
        return false;
      }
    })().finally(() => {
      staffRefreshPromises[app] = undefined;
    });
  }
  return staffRefreshPromises[app]!;
}

async function waiterFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  const nextInit = withStaffAppHeaders(init);
  const response = await fetch(input, nextInit);
  if (
    typeof window !== "undefined" &&
    response.status === 401 &&
    !isWaiterPublicAuthPath(url)
  ) {
    const refreshed = await refreshWaiterSession();
    if (refreshed) {
      return fetch(input, withStaffAppHeaders(init));
    }
  }
  return response;
}

export class WaiterApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function messageFromUnknown(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "message" in data) {
    const msg = (data as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

/* ── Merchant: waiters & customers ── */

export const MERCHANT_STAFF_QUERY_KEY = ["merchant-staff"] as const;

function normalizeStaffMember(member: MenuWaiterMember): MenuWaiterMember {
  const branchId =
    typeof member.branchId === "number" && Number.isFinite(member.branchId) && member.branchId > 0
      ? member.branchId
      : null;
  return {
    ...member,
    branchId,
    staffRole: parseStaffRole(member.staffRole),
  };
}

function normalizeUsersResponse(data: MenuUsersResponse): MenuUsersResponse {
  return {
    owner: data.owner ?? null,
    waiters: Array.isArray(data.waiters) ? data.waiters.map(normalizeStaffMember) : [],
  };
}

export async function listMerchantStaff(): Promise<MenuWaiterMember[]> {
  const response = await waiterFetch("/api/waiter-panel/staff", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<MerchantStaffListResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Personel alınamadı");
  }
  const rows = Array.isArray(data.staff) ? data.staff : Array.isArray(data.waiters) ? data.waiters : [];
  return rows.map(normalizeStaffMember);
}

export async function createMerchantStaff(payload: {
  username: string;
  password: string;
  displayName: string;
  staffRole?: StaffRole;
}): Promise<MenuWaiterMember> {
  const response = await waiterFetch("/api/waiter-panel/staff", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<MenuWaiterMember & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Personel eklenemedi");
  }
  return normalizeStaffMember(data);
}

export async function assignMerchantStaffBranch(
  staffId: number,
  branchId: number | null,
): Promise<MenuWaiterMember> {
  const response = await waiterFetch(`/api/waiter-panel/staff/${staffId}/branch`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ branchId }),
  });
  const data = await parseJson<MenuWaiterMember & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Şube ataması yapılamadı");
  }
  return normalizeStaffMember(data);
}

export async function updateMerchantStaff(
  staffId: number,
  payload: {
    displayName?: string;
    active?: boolean;
    password?: string;
    commissionEnabled?: boolean;
    commissionType?: "PERCENT" | "FIXED";
    commissionScope?: "PER_ITEM" | "BILL_TOTAL";
    commissionValue?: number;
  },
): Promise<MenuWaiterMember> {
  const response = await waiterFetch(`/api/waiter-panel/staff/${staffId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<MenuWaiterMember & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Personel güncellenemedi");
  }
  return normalizeStaffMember(data);
}

export async function listMenuUsers(branchId: number): Promise<MenuUsersResponse> {
  const response = await waiterFetch(`/api/waiter-panel/branch/${branchId}/staff`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<MenuUsersResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Personeller alınamadı");
  }
  return normalizeUsersResponse(data);
}

export async function createMenuWaiter(
  branchId: number,
  payload: { username: string; password: string; displayName: string; staffRole?: StaffRole },
): Promise<MenuWaiterMember> {
  const response = await waiterFetch(`/api/waiter-panel/branch/${branchId}/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<MenuWaiterMember & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Kullanıcı eklenemedi");
  }
  return normalizeStaffMember(data);
}

export async function updateMenuWaiter(
  branchId: number,
  waiterId: number,
  payload: {
    displayName?: string;
    active?: boolean;
    password?: string;
    commissionEnabled?: boolean;
    commissionType?: "PERCENT" | "FIXED";
    commissionScope?: "PER_ITEM" | "BILL_TOTAL";
    commissionValue?: number;
  },
): Promise<MenuWaiterMember> {
  const response = await waiterFetch(`/api/waiter-panel/branch/${branchId}/staff/${waiterId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<MenuWaiterMember & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Kullanıcı güncellenemedi");
  }
  return data;
}

export async function deleteMenuWaiter(branchId: number, waiterId: number): Promise<void> {
  const response = await waiterFetch(`/api/waiter-panel/branch/${branchId}/staff/${waiterId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok && response.status !== 204) {
    const data = await parseJson<{ message?: string }>(response);
    throw new WaiterApiError(response.status, data.message || "Kullanıcı silinemedi");
  }
}

export async function listMenuCustomers(menuId: number): Promise<MenuCustomerItem[]> {
  const response = await waiterFetch(`/api/waiter-panel/menu/${menuId}/customers`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<MenuCustomerItem[] | { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, messageFromUnknown(data, "Müşteriler alınamadı"));
  }
  return Array.isArray(data) ? data : [];
}

export async function listBusinessCustomers(): Promise<MenuCustomerItem[]> {
  const response = await waiterFetch("/api/waiter-panel/customers/my", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<MenuCustomerItem[] | { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, messageFromUnknown(data, "Müşteriler alınamadı"));
  }
  return Array.isArray(data) ? data : [];
}

/* ── Waiter auth ── */

export async function waiterLogin(payload: {
  merchantId: number;
  username: string;
  password: string;
  app?: StaffApp;
}): Promise<WaiterAuthResult> {
  const app = payload.app ?? currentStaffApp();
  const response = await fetch(
    "/api/staff/auth/login",
    withStaffAppHeaders(
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          merchantId: payload.merchantId,
          username: payload.username,
          password: payload.password,
          app,
        }),
      },
      app,
    ),
  );
  const data = await parseJson<WaiterAuthResult & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Giriş başarısız");
  }
  return data;
}

export async function waiterLogout(app: StaffApp = currentStaffApp()): Promise<void> {
  await fetch("/api/staff/auth/logout", withStaffAppHeaders({ method: "POST" }, app)).catch(
    () => undefined,
  );
}

export async function waiterMe(): Promise<WaiterMe | null> {
  const response = await waiterFetch("/api/staff/auth/me", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  if (response.status === 401) return null;
  const data = await parseJson<WaiterMe & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Profil alınamadı");
  }
  return data;
}

/* ── Waiter orders ── */

export async function listWaiterPendingOrders(): Promise<OrderResponse[]> {
  const response = await waiterFetch("/api/waiter/orders/pending", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<OrderResponse[] | { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, messageFromUnknown(data, "Siparişler alınamadı"));
  }
  return (Array.isArray(data) ? data : []).map(applyOrderFlow);
}

export async function listWaiterTodayOrders(): Promise<OrderResponse[]> {
  const response = await waiterFetch("/api/waiter/orders/today", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<unknown>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, messageFromUnknown(data, "Siparişler alınamadı"));
  }
  return asKitchenTickets(data).map(applyKitchenOrderFlow);
}

export async function listWaiterTables(): Promise<WaiterTableSummary[]> {
  const response = await waiterFetch("/api/waiter/orders/tables", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<WaiterTableSummary[] | { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, messageFromUnknown(data, "Masalar alınamadı"));
  }
  return Array.isArray(data) ? data : [];
}

export async function listWaiterTableTodayOrders(tableId: number): Promise<OrderResponse[]> {
  const response = await waiterFetch(`/api/waiter/orders/tables/${tableId}/today`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<OrderResponse[] | { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, messageFromUnknown(data, "Masa siparişleri alınamadı"));
  }
  return (Array.isArray(data) ? data : []).map(applyKitchenOrderFlow);
}

export async function confirmWaiterOrder(orderId: number, _kitchenEnabled = true): Promise<OrderResponse> {
  const response = await waiterFetch(`/api/waiter/orders/${orderId}/confirm`, {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Sipariş onaylanamadı");
  }
  forgetOrderFlowStatus(orderId);
  return applyKitchenOrderFlow({ ...data, id: orderId });
}

export async function rejectWaiterOrder(
  orderId: number,
  request?: OrderCancelRequest,
): Promise<OrderResponse> {
  const response = await waiterFetch(`/api/waiter/orders/${orderId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(request ?? {}),
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Sipariş reddedilemedi");
  }
  forgetOrderFlowStatus(orderId);
  return data;
}

export async function cancelWaiterOrder(
  orderId: number,
  request?: OrderCancelRequest,
): Promise<OrderResponse> {
  const response = await waiterFetch(`/api/waiter/orders/${orderId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(request ?? {}),
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Sipariş iptal edilemedi");
  }
  forgetOrderFlowStatus(orderId);
  return data;
}

export async function cancelKitchenOrder(
  orderId: number,
  request: OrderCancelRequest,
  orderSource?: string | null,
): Promise<OrderResponse> {
  const source = orderSource ? `?source=${encodeURIComponent(orderSource)}` : "";
  const response = await waiterFetch(`/api/waiter/kitchen/orders/${orderId}/cancel${source}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(request),
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Sipariş iptal edilemedi");
  }
  forgetOrderFlowStatus(orderId);
  return { ...data, id: orderId };
}

export async function getWaiterOrder(orderId: number): Promise<OrderResponse> {
  const response = await waiterFetch(`/api/waiter/orders/${orderId}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Sipariş alınamadı");
  }
  return applyKitchenOrderFlow(data);
}

export async function listWaiterCatalog(tableId: number): Promise<WaiterCatalogResponse> {
  const response = await waiterFetch(`/api/waiter/orders/catalog?tableId=${encodeURIComponent(String(tableId))}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<WaiterCatalogResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Menü alınamadı");
  }
  return {
    products: Array.isArray(data.products) ? data.products : [],
    commissionEnabled: data.commissionEnabled,
    commissionType: data.commissionType,
    commissionValue: data.commissionValue,
  };
}

export async function createWaiterOrder(payload: WaiterCreateOrderRequest): Promise<OrderResponse> {
  const { kitchenEnabled, ...body } = payload;
  const response = await waiterFetch("/api/waiter/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Sipariş oluşturulamadı");
  }
  return kitchenEnabled === false ? applyKitchenOrderFlow(data) : applyOrderFlow(data);
}

export async function updateWaiterOrderNote(
  orderId: number,
  note: string,
): Promise<OrderResponse> {
  const response = await waiterFetch(`/api/waiter/orders/${orderId}/note`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ note }),
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Not kaydedilemedi");
  }
  return data;
}

export async function listWaiterReadyOrders(): Promise<OrderResponse[]> {
  const response = await waiterFetch("/api/waiter/orders/ready", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<OrderResponse[] | { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, messageFromUnknown(data, "Hazır siparişler alınamadı"));
  }
  return (Array.isArray(data) ? data : []).map(applyOrderFlow);
}

export async function runWaiterFlowAction(
  orderId: number,
  action: OrderFlowAction,
  orderSource?: string | null,
  asWaiter = false,
): Promise<OrderResponse> {
  const target = ORDER_FLOW_ACTION_STATUS[action];
  const http = waiterHttpStep(action, asWaiter);
  if (!http) {
    throw new WaiterApiError(400, action === "markKitchenDeliveredToCourier" ? "Kurye seçilmedi" : "Bu adım kaydedilemedi");
  }
  const source =
    http.scope === "kitchen" && orderSource ? `?source=${encodeURIComponent(orderSource)}` : "";
  const path =
    http.scope === "kitchen"
      ? `/api/waiter/kitchen/orders/${orderId}/${http.path}${source}`
      : http.scope === "courier"
        ? `/api/waiter/courier/orders/${orderId}/${http.path}`
        : `/api/waiter/orders/${orderId}/${http.path}`;
  const response = await waiterFetch(path, {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Sipariş güncellenemedi");
  }
  if (!serverReachedStatus(data.status, target)) {
    throw new WaiterApiError(409, data.message || "Sipariş güncellenemedi");
  }
  forgetOrderFlowStatus(orderId);
  return { ...data, id: orderId };
}

export function markKitchenPreparing(orderId: number, orderSource?: string | null): Promise<OrderResponse> {
  return runWaiterFlowAction(orderId, "markKitchenPreparing", orderSource);
}

export function markKitchenPrepared(orderId: number, orderSource?: string | null): Promise<OrderResponse> {
  return runWaiterFlowAction(orderId, "markKitchenPrepared", orderSource);
}

export async function revertKitchenOrder(
  orderId: number,
  to: KitchenRevertTarget,
  orderSource?: string | null,
): Promise<OrderResponse> {
  const params = new URLSearchParams({ to });
  if (orderSource) params.set("source", orderSource);
  const response = await waiterFetch(`/api/waiter/kitchen/orders/${orderId}/revert?${params}`, {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Sipariş geri alınamadı");
  }
  forgetOrderFlowStatus(orderId);
  return { ...data, id: orderId };
}

export function markKitchenDeliveredToWaiter(_orderId: number): Promise<OrderResponse> {
  return Promise.reject(new WaiterApiError(400, "Bu adım kaydedilemedi"));
}

export function markKitchenDeliveredToCourier(orderId: number, courierStaffId: number, orderSource?: string | null): Promise<OrderResponse> {
  return handoverKitchenOrderToCourier(orderId, courierStaffId, orderSource);
}

export async function listWaiterKitchenCouriers(branchId?: number | null): Promise<KitchenCourierOption[]> {
  const query = branchId != null ? `?branchId=${branchId}` : "";
  const response = await waiterFetch(`/api/waiter/kitchen/couriers${query}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<KitchenCourierOption[] | { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, messageFromUnknown(data, "Kurye listesi alınamadı"));
  }
  return Array.isArray(data) ? data : [];
}

export async function handoverKitchenOrderToCourier(
  orderId: number,
  courierStaffId: number,
  orderSource?: string | null,
): Promise<OrderResponse> {
  if (!Number.isFinite(courierStaffId) || courierStaffId <= 0) {
    throw new WaiterApiError(400, "Kurye seçilmedi");
  }
  const source = orderSource ? `?source=${encodeURIComponent(orderSource)}` : "";
  const response = await waiterFetch(`/api/waiter/kitchen/orders/${orderId}/courier-handover${source}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ courierStaffId }),
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Sipariş kuryeye verilemedi");
  }
  if (!serverReachedStatus(data.status, "AWAITING_COURIER")) {
    throw new WaiterApiError(409, data.message || "Sipariş kuryeye verilemedi");
  }
  forgetOrderFlowStatus(orderId);
  return { ...data, id: orderId, courierStaffId: data.courierStaffId ?? courierStaffId };
}

export function markWaiterTaken(orderId: number): Promise<OrderResponse> {
  return runWaiterFlowAction(orderId, "markWaiterTaken");
}

export function markWaiterDeliveredToCustomer(orderId: number): Promise<OrderResponse> {
  return runWaiterFlowAction(orderId, "markWaiterDeliveredToCustomer");
}

export function markWaiterDeliveredToCourier(orderId: number): Promise<OrderResponse> {
  return runWaiterFlowAction(orderId, "markWaiterDeliveredToCourier");
}

/** Mutfak kapalı şube: CONFIRMED -> PREPARING, sunucudaki statü esas alınır. */
export async function markWaiterServicePreparing(orderId: number): Promise<OrderResponse> {
  const data = await postWaiterOrderStep(orderId, "preparing");
  forgetOrderFlowStatus(orderId);
  return data;
}

/** Mutfak kapalı şube: onaylı, hazırlanan veya hazır sipariş doğrudan müşteriye teslim edildi olur. */
export async function markWaiterServiceDelivered(orderId: number): Promise<OrderResponse> {
  const data = await postWaiterOrderStep(orderId, "served");
  if (!serverReachedStatus(data.status, "DELIVERED")) {
    throw new WaiterApiError(409, "Sipariş güncellenemedi");
  }
  forgetOrderFlowStatus(orderId);
  return data;
}

async function postWaiterOrderStep(orderId: number, path: "preparing" | "served"): Promise<OrderResponse> {
  const response = await waiterFetch(`/api/waiter/orders/${orderId}/${path}`, {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Sipariş güncellenemedi");
  }
  return { ...data, id: orderId };
}

export async function listKitchenQueue(): Promise<OrderResponse[]> {
  const response = await waiterFetch("/api/waiter/kitchen/orders", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<unknown>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, messageFromUnknown(data, "Mutfak kuyruğu alınamadı"));
  }
  return asKitchenTickets(data).map(applyKitchenOrderFlow);
}

/** @deprecated Use the flow-based markKitchenPreparing / markKitchenPrepared above. */
export function markKitchenReady(orderId: number, orderSource?: string | null): Promise<OrderResponse> {
  return runWaiterFlowAction(orderId, "markKitchenPrepared", orderSource);
}

export async function updateKitchenOrderNote(orderId: number, note: string): Promise<OrderResponse> {
  const response = await waiterFetch(`/api/waiter/kitchen/orders/${orderId}/note`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ note }),
  });
  const data = await parseJson<OrderResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Mutfak notu kaydedilemedi");
  }
  return data;
}

export async function listCourierQueue(): Promise<CourierTicket[]> {
  const response = await waiterFetch("/api/waiter/courier/orders", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<unknown>(response);
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new WaiterApiError(response.status, messageFromUnknown(data, "Kurye kuyruğu alınamadı"));
  }
  return asCourierTickets(data).map(applyOrderFlow);
}

function asFlowCourierTicket(order: OrderResponse): CourierTicket {
  return {
    id: order.id,
    branchId: (order as Record<string, unknown>).branchId as number | null | undefined,
    orderNo: order.orderNumber ?? String(order.id),
    status: order.status,
    customerName: order.customerName ?? "",
    customerPhone: order.customerPhone ?? "",
    deliveryAddress: order.deliveryAddress ?? "",
    note: order.note,
    totalAmount: Number(order.totalAmount ?? 0),
    currency: order.currency ?? "TRY",
    items: (order.items ?? []).map((item) => ({
      productId: item.productId,
      productName: item.productName ?? "",
      quantity: item.quantity,
      note: item.note,
      options: (item.selectedOptions ?? []).map((opt) => opt.optionName ?? "").filter(Boolean),
    })),
    createdAt: order.createdAt ?? new Date().toISOString(),
    readyAt: order.readyAt,
    dispatchedAt: order.servedAt,
    deliveredAt: null,
  };
}

export function markCourierTaken(orderId: number): Promise<CourierTicket> {
  return runWaiterFlowAction(orderId, "markCourierTaken").then(asFlowCourierTicket);
}

export function markCourierDeliveredToCustomer(orderId: number): Promise<CourierTicket> {
  return runWaiterFlowAction(orderId, "markCourierDeliveredToCustomer").then(asFlowCourierTicket);
}

/** @deprecated Use markCourierTaken. */
export function markCourierDispatch(orderId: number): Promise<CourierTicket> {
  return markCourierTaken(orderId);
}

/** @deprecated Use markCourierDeliveredToCustomer. */
export function markCourierDelivered(orderId: number): Promise<CourierTicket> {
  return markCourierDeliveredToCustomer(orderId);
}

/** @deprecated Use markWaiterTaken. */
export function markWaiterOrderPickedFromKitchen(orderId: number): Promise<OrderResponse> {
  return markWaiterTaken(orderId);
}

/** @deprecated Use markWaiterTaken. */
export function markWaiterOrderServed(orderId: number): Promise<OrderResponse> {
  return markWaiterTaken(orderId);
}

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  WAITER: "Garson",
  KITCHEN: "Mutfak",
  COURIER: "Kurye",
};

export function parseStaffRole(value: unknown): StaffRole {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (raw === "KITCHEN") return "KITCHEN";
  if (raw === "COURIER") return "COURIER";
  return "WAITER";
}

export function isKitchenRole(staffRole?: StaffRole | null): boolean {
  return staffRole === "KITCHEN";
}

export function isCourierRole(staffRole?: StaffRole | null): boolean {
  return staffRole === "COURIER";
}

export function isWaiterRole(staffRole?: StaffRole | null): boolean {
  return !isKitchenRole(staffRole) && !isCourierRole(staffRole);
}

export function staffRoleMatchesApp(
  staffRole: StaffRole | null | undefined,
  expected: StaffRole,
): boolean {
  if (expected === "KITCHEN") return isKitchenRole(staffRole);
  if (expected === "COURIER") return isCourierRole(staffRole);
  return isWaiterRole(staffRole);
}

export function staffAppMismatchMessage(expected: StaffRole, actual?: StaffRole | null): string {
  if (actual && actual !== expected) {
    const label = STAFF_ROLE_LABEL[actual].toLocaleLowerCase("tr-TR");
    return `Bu hesap ${label} içindir. ${STAFF_ROLE_LABEL[actual]} girişini kullanın.`;
  }
  if (expected === "KITCHEN") return "Bu hesap garson içindir. Garson girişini kullanın.";
  if (expected === "COURIER") return "Bu hesap kurye için değil. Kendi uygulamanızın girişini kullanın.";
  return "Bu hesap mutfak içindir. Mutfak girişini kullanın.";
}

export function staffHomePath(_staffRole?: StaffRole | null): string {
  return STAFF_GATE_PATH;
}

export const STAFF_GATE_PATH = "/";

export function staffLoginPath(app?: StaffApp): string {
  void app;
  return STAFF_GATE_PATH;
}

export function staffAppForRole(staffRole?: StaffRole | null): StaffApp {
  if (isKitchenRole(staffRole)) return "kitchen";
  if (isCourierRole(staffRole)) return "courier";
  return "waiter";
}

/* ── Waiter bills ── */

export async function getWaiterOpenBill(tableId: number): Promise<WaiterBill> {
  const response = await waiterFetch(`/api/waiter/bills/tables/${tableId}/open`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<WaiterBill & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Adisyon alınamadı");
  }
  return data;
}

export async function getWaiterBill(billId: number): Promise<WaiterBill> {
  const response = await waiterFetch(`/api/waiter/bills/${billId}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<WaiterBill & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Adisyon alınamadı");
  }
  return data;
}

export async function addWaiterBillItems(
  billId: number,
  items: CartItemRequest[],
): Promise<WaiterBill> {
  const response = await waiterFetch(`/api/waiter/bills/${billId}/items`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ items }),
  });
  const data = await parseJson<WaiterBill & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Kalemler eklenemedi");
  }
  return data;
}

export async function updateWaiterBillItemQuantity(
  billId: number,
  itemId: number,
  quantity: number,
): Promise<WaiterBill> {
  const response = await waiterFetch(`/api/waiter/bills/${billId}/items/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ quantity }),
  });
  const data = await parseJson<WaiterBill & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Kalem güncellenemedi");
  }
  return data;
}

export async function removeWaiterBillItem(billId: number, itemId: number): Promise<WaiterBill> {
  const response = await waiterFetch(`/api/waiter/bills/${billId}/items/${itemId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<WaiterBill & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Kalem silinemedi");
  }
  return data;
}

export async function payWaiterBillItems(
  billId: number,
  payload: {
    paymentMethod: "CASH" | "CARD";
    items: { itemId: number; quantityToPay: number }[];
    tipReceived?: boolean;
    tipAmount?: number;
  },
): Promise<WaiterBill> {
  const response = await waiterFetch(`/api/waiter/bills/${billId}/pay-items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<WaiterBill & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Ödeme alınamadı");
  }
  return data;
}

export async function reverseWaiterBillPayment(
  billId: number,
  paymentId: number,
): Promise<WaiterBill> {
  const response = await waiterFetch(`/api/waiter/bills/${billId}/payments/${paymentId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<WaiterBill & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Ödeme geri alınamadı");
  }
  return data;
}

export async function getWaiterBillSplitPreview(
  billId: number,
  personCount: number,
): Promise<WaiterSplitPreview> {
  const response = await waiterFetch(
    `/api/waiter/bills/${billId}/split-preview?personCount=${personCount}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    },
  );
  const data = await parseJson<WaiterSplitPreview & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Bölme önizlemesi alınamadı");
  }
  return data;
}

export async function payWaiterBillShare(
  billId: number,
  payload: {
    personCount: number;
    shareNumber: number;
    paymentMethod: "CASH" | "CARD";
    tipReceived?: boolean;
    tipAmount?: number;
  },
): Promise<WaiterBill> {
  const response = await waiterFetch(`/api/waiter/bills/${billId}/pay-share`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<WaiterBill & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Pay ödemesi alınamadı");
  }
  return data;
}

export async function closeWaiterBill(
  billId: number,
  payload: {
    paymentMethod: "CASH" | "CARD";
    tipReceived?: boolean;
    tipAmount?: number;
  },
): Promise<WaiterBill> {
  const response = await waiterFetch(`/api/waiter/bills/${billId}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<WaiterBill & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Masa kapatılamadı");
  }
  return data;
}

/* ── Waiter commissions ── */

export async function getWaiterTodayCommission(): Promise<WaiterTodayCommissionSummary> {
  const response = await waiterFetch("/api/waiter/commissions/today", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const data = await parseJson<WaiterTodayCommissionSummary & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Komisyon özeti alınamadı");
  }
  return data;
}

export async function getWaiterCommissionHistory(params?: {
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}): Promise<WaiterCommissionHistory> {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.size != null) search.set("size", String(params.size));
  const query = search.toString();
  const response = await waiterFetch(
    `/api/waiter/commissions/history${query ? `?${query}` : ""}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    },
  );
  const data = await parseJson<WaiterCommissionHistory & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Komisyon geçmişi alınamadı");
  }
  return {
    records: Array.isArray(data.records) ? data.records : [],
    page: data.page ?? 0,
    size: data.size ?? 20,
    totalElements: data.totalElements ?? 0,
    totalPages: data.totalPages ?? 0,
  };
}

export type WaiterActiveCampaign = {
  id: number;
  menuId?: number | null;
  templateCode: string;
  name: string;
  slogan?: string | null;
  targetProductIds?: number[];
};

export type WaiterCampaignCustomer = {
  customerId: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  member: boolean;
};

export type WaiterManualGrantRequest = {
  email: string;
  campaignId: number;
  action: "ADD_STAMPS" | "GRANT_REWARD" | "LINK_ORDER";
  quantity?: number;
  orderId?: number;
  note: string;
};

export type WaiterManualGrantResponse = {
  message: string;
  currentStamps?: number;
  requiredStamps?: number;
  rewardId?: number;
};

export async function listWaiterActiveCampaigns(): Promise<WaiterActiveCampaign[]> {
  const response = await waiterFetch(
    `/api/waiter/campaigns/active`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    },
  );
  const data = await parseJson<WaiterActiveCampaign[] & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Kampanyalar alınamadı");
  }
  return Array.isArray(data) ? data : [];
}

export async function lookupWaiterCampaignCustomer(
  menuId: number,
  email: string,
): Promise<WaiterCampaignCustomer> {
  const response = await waiterFetch(
    `/api/waiter/campaigns/customers?menuId=${encodeURIComponent(String(menuId))}&email=${encodeURIComponent(email)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    },
  );
  const data = await parseJson<WaiterCampaignCustomer & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Müşteri bulunamadı");
  }
  return data;
}

export async function grantWaiterCampaign(
  menuId: number,
  payload: WaiterManualGrantRequest,
): Promise<WaiterManualGrantResponse> {
  const response = await waiterFetch(
    `/api/waiter/campaigns/grant?menuId=${encodeURIComponent(String(menuId))}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    },
  );
  const data = await parseJson<WaiterManualGrantResponse & { message?: string }>(response);
  if (!response.ok) {
    throw new WaiterApiError(response.status, data.message || "Hak tanımlanamadı");
  }
  return data;
}
