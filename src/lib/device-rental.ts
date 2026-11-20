/**
 * Oyun & Cihaz Takip (hourly device rental): types matching qr-service `ConsoleDtos` and pure helpers.
 * Backend dates are zone-less LocalDateTime strings in Istanbul time; amounts are BigDecimal (number or string).
 */
import { formatStoreAmount } from "@/lib/store-ui";

export type DeviceType =
  | "PLAYSTATION"
  | "XBOX"
  | "NINTENDO"
  | "PC"
  | "VR"
  | "SIMULATOR"
  | "BILLIARDS"
  | "OTHER";

export type DevicePaymentMethod = "CASH" | "CARD" | "TRANSFER" | "BALANCE";

export type DeviceReservationStatus = "BOOKED" | "STARTED" | "CANCELLED" | "NO_SHOW";

export type Decimal = number | string | null | undefined;

export type DeviceReservation = {
  id: number;
  branchId?: number | null;
  consoleId: number;
  consoleName?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  phone?: string | null;
  note?: string | null;
  startsAt: string;
  endsAt?: string | null;
  status: DeviceReservationStatus;
  sessionId?: number | null;
};

export type Device = {
  id: number;
  branchId?: number | null;
  name: string;
  deviceType?: DeviceType | null;
  hourlyRate?: Decimal;
  multiHourlyRate?: Decimal;
  effectiveHourlyRate?: Decimal;
  effectiveMultiHourlyRate?: Decimal;
  busy: boolean;
  nextReservation?: DeviceReservation | null;
};

export type DeviceSessionItem = {
  id: number;
  menuProductId?: number | null;
  name: string;
  unitPrice?: Decimal;
  quantity: number;
  lineTotal?: Decimal;
};

export type DeviceSessionSegment = {
  consoleId: number;
  consoleName?: string | null;
  deviceType?: DeviceType | null;
  hourlyRate?: Decimal;
  controllerCount: number;
  startedAt?: string | null;
  endedAt?: string | null;
};

export type DeviceSession = {
  id: number;
  branchId?: number | null;
  consoleId: number;
  consoleName?: string | null;
  deviceType?: DeviceType | null;
  customerId?: number | null;
  customerName?: string | null;
  note?: string | null;
  hourlyRate?: Decimal;
  controllerCount: number;
  startedAt?: string | null;
  endedAt?: string | null;
  pausedAt?: string | null;
  paused: boolean;
  plannedMinutes?: number | null;
  playedSeconds: number;
  durationMinutes: number;
  timeAmount?: Decimal;
  itemsAmount?: Decimal;
  grossAmount?: Decimal;
  discountAmount?: Decimal;
  loyaltyMinutesUsed?: number | null;
  amount?: Decimal;
  paymentMethod?: DevicePaymentMethod | null;
  active: boolean;
  reservationId?: number | null;
  items?: DeviceSessionItem[] | null;
  segments?: DeviceSessionSegment[] | null;
};

export type DeviceSessionQuote = {
  sessionId: number;
  playedSeconds: number;
  durationMinutes: number;
  timeAmount?: Decimal;
  itemsAmount?: Decimal;
  grossAmount?: Decimal;
  customerId?: number | null;
  customerName?: string | null;
  customerBalance?: Decimal;
  loyaltyMinutesAvailable: number;
  loyaltyMinutesUsable: number;
  loyaltyValue?: Decimal;
};

export type DeviceProductOption = {
  menuProductId: number;
  menuId?: number | null;
  name: string;
  price?: Decimal;
  imageUrl?: string | null;
};

export type DeviceCustomer = {
  id: number;
  name: string;
  phone?: string | null;
  note?: string | null;
  balance?: Decimal;
  freeMinutes: number;
  loyaltyProgressMinutes?: number;
  totalMinutes?: number;
  totalSpent?: Decimal;
};

export type DevicePage<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
};

/* ── Labels ── */

export const DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  PLAYSTATION: "PlayStation",
  XBOX: "Xbox",
  NINTENDO: "Nintendo",
  PC: "PC",
  VR: "VR",
  SIMULATOR: "Simülatör",
  BILLIARDS: "Bilardo",
  OTHER: "Diğer",
};

export function deviceTypeLabel(type?: DeviceType | null): string {
  return DEVICE_TYPE_LABEL[type ?? "PLAYSTATION"] ?? "Cihaz";
}

/** Controller count (2 / 4 kol) only matters for consoles. */
export function deviceUsesControllers(type?: DeviceType | null): boolean {
  const t = type ?? "PLAYSTATION";
  return t === "PLAYSTATION" || t === "XBOX" || t === "NINTENDO";
}

export const PAYMENT_METHOD_LABEL: Record<DevicePaymentMethod, string> = {
  CASH: "Nakit",
  CARD: "Kart",
  TRANSFER: "Havale",
  BALANCE: "Bakiye",
};

export const RESERVATION_STATUS_LABEL: Record<DeviceReservationStatus, string> = {
  BOOKED: "Bekliyor",
  STARTED: "Başladı",
  CANCELLED: "İptal",
  NO_SHOW: "Gelmedi",
};

/* ── Money ── */

export function toAmount(value: Decimal): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** "1.234,50 ₺" style, via the shared store money formatter. */
export function formatDeviceMoney(value: Decimal): string {
  return formatStoreAmount(toAmount(value));
}

/* ── Durations ── */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Elapsed clock: "05:07" under an hour, "1:05:07" from an hour on. Negative input counts as 0. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(sec)}` : `${pad2(m)}:${pad2(sec)}`;
}

/** Countdown: "12:30" left, or "-03:10" once over time. */
export function formatCountdown(remainingSeconds: number): string {
  const rounded = remainingSeconds >= 0 ? Math.floor(remainingSeconds) : Math.ceil(remainingSeconds);
  if (rounded < 0) return `-${formatClock(-rounded)}`;
  return formatClock(rounded);
}

/** "45 dk", "1 sa", "2 sa 15 dk". */
export function formatMinutes(minutes: number | null | undefined): string {
  const total = Math.max(0, Math.round(minutes ?? 0));
  if (total < 60) return `${total} dk`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

/**
 * Live played seconds: the server's `playedSeconds` (already excluding paused time) plus what has passed since
 * the data was fetched, unless the session is paused.
 */
export function liveElapsedSeconds(
  session: Pick<DeviceSession, "playedSeconds" | "paused">,
  fetchedAtMs: number,
  nowMs: number,
): number {
  const base = Math.max(0, session.playedSeconds ?? 0);
  if (session.paused || !fetchedAtMs) return base;
  return base + Math.max(0, (nowMs - fetchedAtMs) / 1000);
}

/** Seconds left of the planned time (negative when over), or null without a plan. */
export function remainingSeconds(plannedMinutes: number | null | undefined, elapsedSeconds: number): number | null {
  if (plannedMinutes == null || plannedMinutes <= 0) return null;
  return plannedMinutes * 60 - elapsedSeconds;
}

/* ── Istanbul dates ── */

export const DEVICE_TIME_ZONE = "Europe/Istanbul";

/** Parses a zone-less backend LocalDateTime as Istanbul time (UTC+3, no DST since 2016). */
export function parseIstanbulDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const withSeconds = /T\d{2}:\d{2}$/.test(trimmed) ? `${trimmed}:00` : trimmed;
  const date = new Date(hasZone ? trimmed : `${withSeconds}+03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatIstanbulTime(value: string | null | undefined): string {
  const date = parseIstanbulDateTime(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: DEVICE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatIstanbulDateTime(value: string | null | undefined): string {
  const date = parseIstanbulDateTime(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: DEVICE_TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** yyyy-MM-dd of the given instant in Istanbul. */
export function istanbulDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEVICE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** yyyy-MM-ddTHH:mm of the given instant in Istanbul, for a datetime-local input. */
export function istanbulLocalInputValue(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEVICE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** datetime-local value ("yyyy-MM-ddTHH:mm") to the backend LocalDateTime ("yyyy-MM-ddTHH:mm:ss"). */
export function localInputToBackend(value: string): string {
  return /T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
}

/* ── Discount ── */

export type DiscountMode = "amount" | "percent";

/** Total after loyalty and discount, as a preview; the finish response holds the real amount. */
export function previewFinalAmount(input: {
  gross: number;
  loyaltyValue: number;
  discountMode: DiscountMode;
  discount: number;
}): number {
  const afterLoyalty = Math.max(0, input.gross - Math.max(0, input.loyaltyValue));
  const discount = Number.isFinite(input.discount) ? Math.max(0, input.discount) : 0;
  const cut =
    input.discountMode === "percent" ? (afterLoyalty * Math.min(discount, 100)) / 100 : Math.min(discount, afterLoyalty);
  return Math.round((afterLoyalty - cut) * 100) / 100;
}
