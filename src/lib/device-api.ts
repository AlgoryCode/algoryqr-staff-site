/**
 * Oyun & Cihaz Takip staff API. Goes through the same `/api/staff/*` proxy as the waiter screens
 * (`/api/staff/devices/...` → qr-service `/api/v1/staff/devices/...`), with the staff JWT cookies.
 */
import type { QueryClient } from "@tanstack/react-query";

import { getJsonErrorText } from "@/lib/api-error-text";
import type {
  Device,
  DeviceCustomer,
  DeviceGame,
  DeviceMembership,
  DeviceMembershipPlan,
  DevicePackage,
  DevicePage,
  DevicePaymentMethod,
  DeviceProductOption,
  DeviceReservation,
  DeviceSession,
  DeviceQuoteOptions,
  DeviceSessionQuote,
  DeviceShift,
  DeviceTournament,
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
  packageId?: number;
  gameId?: number;
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

export function quoteDeviceSession(sessionId: number, options: DeviceQuoteOptions = {}): Promise<DeviceSessionQuote> {
  const params = query({
    useLoyaltyMinutes: options.useLoyaltyMinutes ? "true" : undefined,
    useMembershipMinutes: options.useMembershipMinutes ? "true" : undefined,
    useBonusBalance: options.useBonusBalance ? "true" : undefined,
    discountAmount: options.discountAmount,
    discountPercent: options.discountPercent,
  });
  return request("GET", `/sessions/${sessionId}/quote${params}`, "Hesap alınamadı");
}

export type FinishDeviceSessionPayload = DeviceQuoteOptions & {
  paymentMethod: DevicePaymentMethod;
};

/** Approves the minutes asked for from the device's QR page (adds them to the plan). */
export function approveDeviceExtension(sessionId: number): Promise<DeviceSession> {
  return request("POST", `/sessions/${sessionId}/extension-request/approve`, "Süre isteği onaylanamadı");
}

export function dismissDeviceExtension(sessionId: number): Promise<DeviceSession> {
  return request("POST", `/sessions/${sessionId}/extension-request/dismiss`, "Süre isteği reddedilemedi");
}

/* ── Catalog: games, packages, maintenance ── */

export async function listDeviceGames(): Promise<DeviceGame[]> {
  return list<DeviceGame>(await request("GET", "/games", "Oyunlar alınamadı"));
}

/** Active packages of the branch, with `availableNow`. */
export async function listDevicePackages(): Promise<DevicePackage[]> {
  return list<DevicePackage>(await request("GET", "/packages", "Paketler alınamadı"));
}

export function startDeviceMaintenance(consoleId: number, payload: { note?: string } = {}): Promise<Device> {
  return request("POST", `/${consoleId}/maintenance`, "Cihaz bakıma alınamadı", payload);
}

export function endDeviceMaintenance(consoleId: number, payload: { cost?: number; note?: string } = {}): Promise<Device> {
  return request("POST", `/${consoleId}/maintenance/end`, "Bakım bitirilemedi", payload);
}

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

/* ── Memberships ── */

export async function listDeviceMembershipPlans(): Promise<DeviceMembershipPlan[]> {
  return list<DeviceMembershipPlan>(await request("GET", "/membership-plans", "Üyelik planları alınamadı"));
}

export async function listDeviceCustomerMemberships(customerId: number): Promise<DeviceMembership[]> {
  return list<DeviceMembership>(await request("GET", `/customers/${customerId}/memberships`, "Üyelikler alınamadı"));
}

export function sellDeviceMembership(
  customerId: number,
  payload: { planId: number; paymentMethod: DevicePaymentMethod },
): Promise<DeviceMembership> {
  return request("POST", `/customers/${customerId}/memberships`, "Üyelik satılamadı", payload);
}

/* ── Shifts ── */

/** The caller's open shift, or null (204). */
export async function getCurrentDeviceShift(): Promise<DeviceShift | null> {
  const data = await request<DeviceShift | Record<string, never>>("GET", "/shifts/current", "Vardiya alınamadı");
  return data && typeof data === "object" && "id" in data && data.id != null ? (data as DeviceShift) : null;
}

export function openDeviceShift(payload: { openingCash?: number }): Promise<DeviceShift> {
  return request("POST", "/shifts", "Vardiya açılamadı", payload);
}

export function closeDeviceShift(shiftId: number, payload: { countedCash: number; note?: string }): Promise<DeviceShift> {
  return request("POST", `/shifts/${shiftId}/close`, "Vardiya kapatılamadı", payload);
}

/** Staff see only their own shifts. */
export async function listDeviceShifts(pageIndex = 0, size = 20): Promise<DevicePage<DeviceShift>> {
  return page<DeviceShift>(await request("GET", `/shifts${query({ page: pageIndex, size })}`, "Vardiyalar alınamadı"));
}

/* ── Tournaments (staff run them; the owner creates them) ── */

export async function listDeviceTournaments(): Promise<DeviceTournament[]> {
  return list<DeviceTournament>(await request("GET", "/tournaments", "Turnuvalar alınamadı"));
}

export function getDeviceTournament(tournamentId: number): Promise<DeviceTournament> {
  return request("GET", `/tournaments/${tournamentId}`, "Turnuva alınamadı");
}

export type AddTournamentPlayerPayload = {
  customerId?: number;
  name?: string;
  phone?: string;
  /** Set when the entry fee is taken at sign-up. */
  paymentMethod?: DevicePaymentMethod;
};

export function addDeviceTournamentPlayer(
  tournamentId: number,
  payload: AddTournamentPlayerPayload,
): Promise<DeviceTournament> {
  return request("POST", `/tournaments/${tournamentId}/players`, "Oyuncu eklenemedi", payload);
}

export function removeDeviceTournamentPlayer(tournamentId: number, playerId: number): Promise<DeviceTournament> {
  return request("DELETE", `/tournaments/${tournamentId}/players/${playerId}`, "Oyuncu çıkarılamadı");
}

export function payDeviceTournamentPlayer(
  tournamentId: number,
  playerId: number,
  paymentMethod: DevicePaymentMethod,
): Promise<DeviceTournament> {
  return request("POST", `/tournaments/${tournamentId}/players/${playerId}/pay`, "Ücret alınamadı", { paymentMethod });
}

export function startDeviceTournament(tournamentId: number): Promise<DeviceTournament> {
  return request("POST", `/tournaments/${tournamentId}/start`, "Turnuva başlatılamadı");
}

export function reportDeviceTournamentMatch(
  tournamentId: number,
  matchId: number,
  payload: { winnerPlayerId: number; score?: string },
): Promise<DeviceTournament> {
  return request("POST", `/tournaments/${tournamentId}/matches/${matchId}/result`, "Sonuç kaydedilemedi", payload);
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

/** Catalog lists that do not change with day-to-day operations. */
const STATIC_KEYS = new Set<unknown>(["quote", "products", "games", "packages", "plans"]);

/** Refetches devices, sessions, history, reservations, customers and shifts; leaves catalogs and open quotes alone. */
export function invalidateDeviceData(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: ["staff-devices"],
    predicate: (q) => !STATIC_KEYS.has(q.queryKey[1]),
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
  quote: (sessionId: number, optionsKey = "") => ["staff-devices", "quote", sessionId, optionsKey] as const,
  games: ["staff-devices", "games"] as const,
  packages: ["staff-devices", "packages"] as const,
  plans: ["staff-devices", "plans"] as const,
  memberships: (customerId: number) => ["staff-devices", "memberships", customerId] as const,
  currentShift: ["staff-devices", "shift", "current"] as const,
  shifts: (pageIndex: number) => ["staff-devices", "shifts", pageIndex] as const,
  tournaments: ["staff-devices", "tournaments"] as const,
  tournament: (id: number) => ["staff-devices", "tournament", id] as const,
};
