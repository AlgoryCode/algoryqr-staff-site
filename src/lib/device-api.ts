/**
 * Oyun & Cihaz Takip staff API. Goes through the same `/api/staff/*` proxy as the waiter screens
 * (`/api/staff/devices/...` → qr-service `/api/v1/staff/devices/...`), with the staff JWT cookies.
 */
import type { QueryClient } from "@tanstack/react-query";

import { getJsonErrorText } from "@/lib/api-error-text";
import type {
  Device,
  DeviceCustomer,
  DevicePage,
  DevicePaymentMethod,
  DeviceProductOption,
  DeviceReservation,
  DeviceSession,
  DeviceSessionQuote,
} from "@/lib/device-rental";
import { parseJson, waiterFetch, WaiterApiError } from "@/lib/waiter-api";

const BASE = "/api/staff/devices";

/** Error codes qr-service returns when the merchant's plan does not include the add-on. */
const NOT_ENABLED_CODES = new Set([
  "FEATURE_NOT_IN_PLAN",
  "NO_ACTIVE_PLAN",
  "PRODUCT_NOT_ENABLED",
  "PRODUCT_NOT_IN_PACKAGE",
  "FEATURE_NOT_ENABLED",
]);

export class DeviceApiError extends WaiterApiError {
  code: string | null;
  constructor(status: number, message: string, code: string | null) {
    super(status, message);
    this.code = code;
  }
}

/** True when the add-on is not active for this business (or the endpoint is not there at all). */
export function isDeviceRentalNotEnabledError(error: unknown): boolean {
  if (!(error instanceof DeviceApiError)) return false;
  if (error.status === 404 && error.code == null) return true;
  if (error.status !== 403) return false;
  if (error.code && NOT_ENABLED_CODES.has(error.code)) return true;
  return Boolean(error.code && /NOT_(ENABLED|IN_PLAN|IN_PACKAGE)/.test(error.code));
}

function codeOf(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const code = (data as { code?: unknown }).code;
  return typeof code === "string" && code.trim() ? code.trim() : null;
}

async function request<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  fallback: string,
  body?: unknown,
): Promise<T> {
  const writes = method === "POST";
  const response = await waiterFetch(`${BASE}${path}`, {
    method,
    headers: writes
      ? { Accept: "application/json", "Content-Type": "application/json" }
      : { Accept: "application/json" },
    body: writes ? JSON.stringify(body ?? {}) : undefined,
    credentials: "same-origin",
  });
  const data = await parseJson<unknown>(response);
  if (!response.ok) {
    throw new DeviceApiError(response.status, getJsonErrorText(data) || fallback, codeOf(data));
  }
  return data as T;
}

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

function list<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

function page<T>(data: unknown): DevicePage<T> {
  const raw = (data && typeof data === "object" ? data : {}) as Partial<DevicePage<T>>;
  return {
    content: Array.isArray(raw.content) ? raw.content : [],
    page: raw.page ?? 0,
    size: raw.size ?? 0,
    totalElements: raw.totalElements ?? 0,
    totalPages: raw.totalPages ?? 0,
    hasNext: raw.hasNext === true,
  };
}

/* ── Devices and sessions ── */

export async function listDevices(): Promise<Device[]> {
  return list<Device>(await request("GET", "", "Cihazlar alınamadı"));
}

export async function listActiveDeviceSessions(): Promise<DeviceSession[]> {
  return list<DeviceSession>(await request("GET", "/sessions/active", "Açık oturumlar alınamadı"));
}

export async function listDeviceSessionHistory(pageIndex = 0, size = 20): Promise<DevicePage<DeviceSession>> {
  return page<DeviceSession>(
    await request("GET", `/sessions${query({ page: pageIndex, size })}`, "Oturum geçmişi alınamadı"),
  );
}

export async function listDeviceProducts(): Promise<DeviceProductOption[]> {
  return list<DeviceProductOption>(await request("GET", "/products", "Ürünler alınamadı"));
}

export type StartDeviceSessionPayload = {
  customerName?: string;
  note?: string;
  customerId?: number;
  plannedMinutes?: number;
  controllerCount?: number;
};

export function startDeviceSession(consoleId: number, payload: StartDeviceSessionPayload): Promise<DeviceSession> {
  return request("POST", `/${consoleId}/sessions`, "Oturum başlatılamadı", payload);
}

export function pauseDeviceSession(sessionId: number): Promise<DeviceSession> {
  return request("POST", `/sessions/${sessionId}/pause`, "Oturum duraklatılamadı");
}

export function resumeDeviceSession(sessionId: number): Promise<DeviceSession> {
  return request("POST", `/sessions/${sessionId}/resume`, "Oturum devam ettirilemedi");
}

export function transferDeviceSession(
  sessionId: number,
  payload: { consoleId?: number; controllerCount?: number },
): Promise<DeviceSession> {
  return request("POST", `/sessions/${sessionId}/transfer`, "Cihaz değiştirilemedi", payload);
}

export function extendDeviceSession(sessionId: number, minutes: number): Promise<DeviceSession> {
  return request("POST", `/sessions/${sessionId}/extend`, "Süre eklenemedi", { minutes });
}

export type AddDeviceItemPayload =
  | { menuProductId: number; quantity: number }
  | { name: string; unitPrice: number; quantity: number };

export function addDeviceSessionItem(sessionId: number, payload: AddDeviceItemPayload): Promise<DeviceSession> {
  return request("POST", `/sessions/${sessionId}/items`, "Ürün eklenemedi", payload);
}

export function removeDeviceSessionItem(sessionId: number, itemId: number): Promise<DeviceSession> {
  return request("DELETE", `/sessions/${sessionId}/items/${itemId}`, "Ürün silinemedi");
}

export function quoteDeviceSession(sessionId: number): Promise<DeviceSessionQuote> {
  return request("GET", `/sessions/${sessionId}/quote`, "Hesap alınamadı");
}

export type FinishDeviceSessionPayload = {
  paymentMethod: DevicePaymentMethod;
  discountAmount?: number;
  discountPercent?: number;
  useLoyaltyMinutes?: boolean;
};

export function finishDeviceSession(sessionId: number, payload: FinishDeviceSessionPayload): Promise<DeviceSession> {
  return request("POST", `/sessions/${sessionId}/finish`, "Oturum bitirilemedi", payload);
}

/* ── Customers ── */

export async function searchDeviceCustomers(q: string, pageIndex = 0, size = 20): Promise<DevicePage<DeviceCustomer>> {
  return page<DeviceCustomer>(
    await request("GET", `/customers${query({ q: q.trim(), page: pageIndex, size })}`, "Müşteriler alınamadı"),
  );
}

export function createDeviceCustomer(payload: { name: string; phone?: string; note?: string }): Promise<DeviceCustomer> {
  return request("POST", "/customers", "Müşteri oluşturulamadı", payload);
}

export function getDeviceCustomer(customerId: number): Promise<DeviceCustomer> {
  return request("GET", `/customers/${customerId}`, "Müşteri alınamadı");
}

export function topUpDeviceCustomer(
  customerId: number,
  payload: { amount: number; paymentMethod: Exclude<DevicePaymentMethod, "BALANCE">; note?: string },
): Promise<DeviceCustomer> {
  return request("POST", `/customers/${customerId}/top-up`, "Bakiye yüklenemedi", payload);
}

/* ── Reservations ── */

export async function listDeviceReservations(from?: string, to?: string): Promise<DeviceReservation[]> {
  return list<DeviceReservation>(
    await request("GET", `/reservations${query({ from, to })}`, "Rezervasyonlar alınamadı"),
  );
}

export type CreateDeviceReservationPayload = {
  consoleId: number;
  customerId?: number;
  customerName?: string;
  phone?: string;
  note?: string;
  /** yyyy-MM-ddTHH:mm:ss, Istanbul time */
  startsAt: string;
  durationMinutes: number;
};

export function createDeviceReservation(payload: CreateDeviceReservationPayload): Promise<DeviceReservation> {
  return request("POST", "/reservations", "Rezervasyon oluşturulamadı", payload);
}

export function cancelDeviceReservation(reservationId: number): Promise<DeviceReservation> {
  return request("POST", `/reservations/${reservationId}/cancel`, "Rezervasyon iptal edilemedi");
}

export function noShowDeviceReservation(reservationId: number): Promise<DeviceReservation> {
  return request("POST", `/reservations/${reservationId}/no-show`, "Rezervasyon güncellenemedi");
}

export function startDeviceReservation(reservationId: number, controllerCount?: number): Promise<DeviceSession> {
  return request(
    "POST",
    `/reservations/${reservationId}/start`,
    "Rezervasyon başlatılamadı",
    controllerCount ? { controllerCount } : {},
  );
}

/** Refetches devices, sessions, history, reservations and customers; leaves product lists and open quotes alone. */
export function invalidateDeviceData(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: ["staff-devices"],
    predicate: (q) => q.queryKey[1] !== "quote" && q.queryKey[1] !== "products",
  });
}

/* ── Query keys ── */

export const deviceQueryKeys = {
  devices: ["staff-devices"] as const,
  active: ["staff-devices", "active"] as const,
  history: (pageIndex: number) => ["staff-devices", "history", pageIndex] as const,
  products: ["staff-devices", "products"] as const,
  customers: (q: string) => ["staff-devices", "customers", q] as const,
  customer: (id: number) => ["staff-devices", "customer", id] as const,
  reservations: (from: string, to: string) => ["staff-devices", "reservations", from, to] as const,
  quote: (sessionId: number) => ["staff-devices", "quote", sessionId] as const,
};
