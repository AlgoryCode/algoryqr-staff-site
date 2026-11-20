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
  publicToken?: string | null;
  maintenance?: boolean | null;
  maintenanceNote?: string | null;
  maintenanceSince?: string | null;
  /** Games installed on this device. */
  games?: DeviceGameRef[] | null;
};

export type DeviceGameRef = { id: number; name: string };

export type DeviceGame = {
  id: number;
  branchId?: number | null;
  name: string;
  genre?: string | null;
  maxPlayers?: number | null;
  consoleIds?: number[] | null;
};

export type DevicePackage = {
  id: number;
  branchId?: number | null;
  name: string;
  /** null: any device type. */
  deviceType?: DeviceType | null;
  minutes: number;
  price?: Decimal;
  /** ISO weekdays 1 (Mon) … 7 (Sun); empty/null: every day. */
  days?: number[] | null;
  /** "HH:mm[:ss]" */
  startTime?: string | null;
  endTime?: string | null;
  active?: boolean;
  availableNow?: boolean;
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
  packageId?: number | null;
  packageName?: string | null;
  packageMinutes?: number | null;
  packagePrice?: Decimal;
  gameId?: number | null;
  gameName?: string | null;
  membershipMinutesUsed?: number | null;
  tierDiscountAmount?: Decimal;
  bonusUsed?: Decimal;
  /** Minutes asked for from the device's QR page; null when nothing is pending. */
  extensionRequestMinutes?: number | null;
  extensionRequestedAt?: string | null;
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
  packageName?: string | null;
  membershipMinutesAvailable?: number;
  membershipMinutesUsed?: number;
  membershipValue?: Decimal;
  tierName?: string | null;
  tierDiscountPercent?: Decimal;
  tierDiscountAmount?: Decimal;
  bonusBalance?: Decimal;
  bonusUsed?: Decimal;
  manualDiscount?: Decimal;
  loyaltyMinutesUsed?: number;
  loyaltyDiscount?: Decimal;
  totalDiscount?: Decimal;
  /** Final amount with the asked options; missing on an older backend. */
  amount?: Decimal;
};

/** Options the quote and finish calls share. */
export type DeviceQuoteOptions = {
  useLoyaltyMinutes?: boolean;
  useMembershipMinutes?: boolean;
  useBonusBalance?: boolean;
  discountAmount?: number;
  discountPercent?: number;
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
  /** Gift / referral money, spent as a discount. */
  bonusBalance?: Decimal;
  referralCode?: string | null;
  referredById?: number | null;
  visits?: number;
  lastVisitAt?: string | null;
  tierName?: string | null;
  tierDiscountPercent?: Decimal;
  /** Minutes left on usable memberships. */
  membershipMinutes?: number;
};

export type DeviceMembershipPlan = {
  id: number;
  name: string;
  price?: Decimal;
  minutes: number;
  periodDays: number;
  deviceType?: DeviceType | null;
  active?: boolean;
};

export type DeviceMembership = {
  id: number;
  customerId?: number | null;
  planId?: number | null;
  planName?: string | null;
  deviceType?: DeviceType | null;
  minutesTotal: number;
  minutesLeft: number;
  price?: Decimal;
  paymentMethod?: DevicePaymentMethod | null;
  startsAt?: string | null;
  endsAt?: string | null;
  cancelled?: boolean;
  usable?: boolean;
};

export type DevicePaymentTotal = {
  paymentMethod?: DevicePaymentMethod | null;
  count: number;
  amount?: Decimal;
};

export type DeviceShift = {
  id: number;
  branchId?: number | null;
  staffId?: number | null;
  staffName?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  openingCash?: Decimal;
  sessions?: number;
  sessionsTotal?: Decimal;
  sessionPayments?: DevicePaymentTotal[] | null;
  topUps?: DevicePaymentTotal[] | null;
  memberships?: DevicePaymentTotal[] | null;
  tournamentFees?: DevicePaymentTotal[] | null;
  cashIn?: Decimal;
  expectedCash?: Decimal;
  countedCash?: Decimal;
  difference?: Decimal;
  note?: string | null;
};

export type DeviceTournamentStatus = "REGISTRATION" | "RUNNING" | "FINISHED" | "CANCELLED";

export type DeviceTournamentPlayer = {
  id: number;
  customerId?: number | null;
  name: string;
  phone?: string | null;
  paid?: boolean;
  paymentMethod?: DevicePaymentMethod | null;
  paidAt?: string | null;
};

export type DeviceTournamentMatch = {
  id: number;
  round: number;
  position: number;
  player1Id?: number | null;
  player1Name?: string | null;
  player2Id?: number | null;
  player2Name?: string | null;
  winnerId?: number | null;
  score?: string | null;
  /** Both players known, no winner yet. */
  ready?: boolean;
};

export type DeviceTournament = {
  id: number;
  branchId?: number | null;
  name: string;
  gameName?: string | null;
  startsAt?: string | null;
  entryFee?: Decimal;
  prizeNote?: string | null;
  maxPlayers: number;
  status: DeviceTournamentStatus;
  winnerPlayerId?: number | null;
  winnerName?: string | null;
  playerCount?: number;
  paidCount?: number;
  collected?: Decimal;
  /** Number of rounds; the last is the final. */
  rounds?: number;
  players?: DeviceTournamentPlayer[] | null;
  matches?: DeviceTournamentMatch[] | null;
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

export const TOURNAMENT_STATUS_LABEL: Record<DeviceTournamentStatus, string> = {
  REGISTRATION: "Kayıt açık",
  RUNNING: "Devam ediyor",
  FINISHED: "Bitti",
  CANCELLED: "İptal",
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

/* ── Packages and games ── */

/** Packages that can run on a device of this type (same type, or no type). Available-now ones first. */
export function packagesForDevice(packages: DevicePackage[], type?: DeviceType | null): DevicePackage[] {
  const t = type ?? "PLAYSTATION";
  return packages
    .filter((p) => p.active !== false && (p.deviceType == null || p.deviceType === t))
    .sort((a, b) => Number(b.availableNow !== false) - Number(a.availableNow !== false) || a.minutes - b.minutes);
}

/** "HH:mm" from "HH:mm[:ss]". */
export function shortTime(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  return match ? `${match[1]!.padStart(2, "0")}:${match[2]}` : value;
}

const WEEKDAY_SHORT = ["", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** "Pzt, Sal · 10:00–14:00", or "" when the package is valid any time. */
export function packageWindowLabel(p: Pick<DevicePackage, "days" | "startTime" | "endTime">): string {
  const days = (p.days ?? []).filter((d) => d >= 1 && d <= 7);
  const dayText = days.length > 0 && days.length < 7 ? [...days].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]).join(", ") : "";
  const timeText = p.startTime && p.endTime ? `${shortTime(p.startTime)}–${shortTime(p.endTime)}` : "";
  return [dayText, timeText].filter(Boolean).join(" · ");
}

/** Splits the branch's games into those installed on the device and the rest, each sorted by name. */
export function splitGamesForDevice(
  games: DeviceGame[],
  device: Pick<Device, "id" | "games">,
): { installed: DeviceGame[]; others: DeviceGame[] } {
  const ids = new Set((device.games ?? []).map((g) => g.id));
  const byName = (a: DeviceGame, b: DeviceGame) => a.name.localeCompare(b.name, "tr-TR", { sensitivity: "base" });
  const installed: DeviceGame[] = [];
  const others: DeviceGame[] = [];
  for (const game of games) {
    if (ids.has(game.id) || (game.consoleIds ?? []).includes(device.id)) installed.push(game);
    else others.push(game);
  }
  return { installed: installed.sort(byName), others: others.sort(byName) };
}

/* ── Shifts ── */

export function sumPaymentTotals(rows: DevicePaymentTotal[] | null | undefined): { count: number; amount: number } {
  let count = 0;
  let amount = 0;
  for (const row of rows ?? []) {
    count += row.count ?? 0;
    amount += toAmount(row.amount);
  }
  return { count, amount: Math.round(amount * 100) / 100 };
}

/** Counted minus expected cash (positive: surplus, negative: shortfall). */
export function cashDifference(counted: number, expected: Decimal): number {
  return Math.round((counted - toAmount(expected)) * 100) / 100;
}

/* ── Tournaments ── */

/** "Final", "Yarı final", "Çeyrek final", else "N. tur". */
export function roundLabel(round: number, rounds: number): string {
  if (rounds > 0) {
    if (round === rounds) return "Final";
    if (round === rounds - 1) return "Yarı final";
    if (round === rounds - 2) return "Çeyrek final";
  }
  return `${round}. tur`;
}

/** Matches grouped by round (ascending), each round sorted by position. */
export function groupMatchesByRound(
  matches: DeviceTournamentMatch[] | null | undefined,
): { round: number; matches: DeviceTournamentMatch[] }[] {
  const map = new Map<number, DeviceTournamentMatch[]>();
  for (const match of matches ?? []) {
    const list = map.get(match.round) ?? [];
    list.push(match);
    map.set(match.round, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, list]) => ({ round, matches: list.sort((a, b) => a.position - b.position) }));
}

/** "Kasa tutuyor", "Fazla 12,50 ₺" or "Eksik 12,50 ₺". */
export function cashDifferenceLabel(difference: Decimal): { label: string; tone: "ok" | "over" | "short" } {
  const d = Math.round(toAmount(difference) * 100) / 100;
  if (d === 0) return { label: "Kasa tutuyor", tone: "ok" };
  return d > 0
    ? { label: `Fazla ${formatDeviceMoney(d)}`, tone: "over" }
    : { label: `Eksik ${formatDeviceMoney(-d)}`, tone: "short" };
}
