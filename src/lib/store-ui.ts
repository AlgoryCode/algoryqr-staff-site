import {
  nextOrderActions,
  normalizeOrderStatus,
  ORDER_FLOW_STATUS_LABEL,
  orderFlowStepIndex,
  orderFlowSteps,
} from "@/lib/order-flow";
import type {
  Merchant,
  StoreCourierVehicleType,
  StoreDeliveryType,
  StoreOrderAction,
  StoreOrderStatus,
  StorePaymentMethod,
  StoreWeekday,
  StoreWorkingHour,
} from "@/lib/store-api";

export type { StorePaymentMethod };

export const STORE_ORDER_STATUS_LABEL: Record<StoreOrderStatus, string> = {
  PENDING: "Onay bekliyor",
  REJECTED: "Reddedildi",
  CANCELLED: "İptal edildi",
  ...ORDER_FLOW_STATUS_LABEL,
};

export const STORE_ORDER_STATUS_CLASS: Record<StoreOrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  CONFIRMED: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  PREPARING: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300",
  READY: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  AWAITING_COURIER: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  ON_THE_WAY: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  DELIVERED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  CANCELLED: "bg-muted text-muted-foreground",
  KITCHEN_PREPARING: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300",
  KITCHEN_PREPARED: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  KITCHEN_DELIVERED_TO_WAITER: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  KITCHEN_DELIVERED_TO_COURIER: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  WAITER_TAKEN: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  COURIER_TAKEN: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  WAITER_DELIVERED_TO_CUSTOMER: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  WAITER_DELIVERED_TO_COURIER: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  COURIER_DELIVERED_TO_CUSTOMER: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
};

export const STORE_DELIVERY_TYPE_LABEL: Record<StoreDeliveryType, string> = {
  DELIVERY: "Adrese teslim",
  PICKUP: "Gel-al",
};

export function storeDeliveryTypesForCourier(
  types: StoreDeliveryType[],
  courierEnabled: boolean,
): StoreDeliveryType[] {
  if (courierEnabled) return types;
  const pickup = types.filter((type) => type !== "DELIVERY");
  return pickup.length > 0 ? pickup : ["PICKUP"];
}

export const STORE_PAYMENT_METHOD_LABEL: Record<StorePaymentMethod, string> = {
  CASH_ON_DELIVERY: "Kapıda nakit",
  CARD_ON_DELIVERY: "Kapıda kart",
};

export const STORE_VEHICLE_TYPE_LABEL: Record<StoreCourierVehicleType, string> = {
  MOTORCYCLE: "Motosiklet",
  BICYCLE: "Bisiklet",
  CAR: "Araba",
  ON_FOOT: "Yaya",
};

export const STORE_WEEKDAYS: StoreWeekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const STORE_WEEKDAY_LABEL: Record<StoreWeekday, string> = {
  MONDAY: "Pazartesi",
  TUESDAY: "Salı",
  WEDNESDAY: "Çarşamba",
  THURSDAY: "Perşembe",
  FRIDAY: "Cuma",
  SATURDAY: "Cumartesi",
  SUNDAY: "Pazar",
};

type StoreOrderTransition = {
  action: StoreOrderAction;
  label: string;
  tone: "primary" | "secondary" | "danger";
};

/**
 * Pickup never dispatches a courier.
 * Delivery must go through courier handover before "teslim edildi".
 */
export function availableStoreOrderTransitions(
  status: StoreOrderStatus,
  deliveryType: StoreDeliveryType,
  flags: { kitchenEnabled?: boolean; courierEnabled?: boolean } = {},
): StoreOrderTransition[] {
  const kitchenEnabled = flags.kitchenEnabled ?? true;
  const courierEnabled = flags.courierEnabled ?? deliveryType === "DELIVERY";
  if (status === "PENDING") {
    return [
      { action: "confirm", label: "Onayla", tone: "primary" },
      { action: "reject", label: "Reddet", tone: "danger" },
    ];
  }
  if (status === "REJECTED" || status === "CANCELLED") return [];
  const steps = nextOrderActions(status, {
    kitchenEnabled,
    courierEnabled: courierEnabled && deliveryType === "DELIVERY",
    delivery: deliveryType === "DELIVERY",
    pickup: deliveryType === "PICKUP",
  });
  const transitions: StoreOrderTransition[] = steps.map((step) => ({
    action: step.action,
    label: step.label,
    tone: "primary",
  }));
  if (status !== "DELIVERED" && normalizeOrderStatus(status) !== "DELIVERED" && normalizeOrderStatus(status) !== "ON_THE_WAY") {
    transitions.push({ action: "cancel", label: "İptal et", tone: "danger" });
  }
  return transitions;
}

export type StoreKitchenFlowStep = {
  status: StoreOrderStatus;
  label: string;
};

/** Kitchen-aligned merchant flow shown on the online order detail screen. */
export function storeKitchenFlowSteps(
  deliveryType: StoreDeliveryType,
  flags: { kitchenEnabled?: boolean; courierEnabled?: boolean } = {},
): StoreKitchenFlowStep[] {
  return orderFlowSteps({
    kitchenEnabled: flags.kitchenEnabled ?? true,
    courierEnabled: flags.courierEnabled ?? deliveryType === "DELIVERY",
    delivery: deliveryType === "DELIVERY",
    pickup: deliveryType === "PICKUP",
  }).map((step) => ({
    status: step.status as StoreOrderStatus,
    label: step.label,
  }));
}

export function storeKitchenFlowIndex(
  status: StoreOrderStatus,
  deliveryType: StoreDeliveryType,
  flags: { kitchenEnabled?: boolean; courierEnabled?: boolean } = {},
): number {
  return orderFlowStepIndex(status, {
    kitchenEnabled: flags.kitchenEnabled ?? true,
    courierEnabled: flags.courierEnabled ?? deliveryType === "DELIVERY",
    delivery: deliveryType === "DELIVERY",
    pickup: deliveryType === "PICKUP",
  });
}

export function formatStoreElapsed(from?: string | null, now = Date.now()): string | null {
  if (!from) return null;
  const start = new Date(from).getTime();
  if (Number.isNaN(start)) return null;
  const seconds = Math.max(0, Math.floor((now - start) / 1000));
  if (seconds < 60) return `${seconds} sn`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} sa ${rest} dk` : `${hours} sa`;
}

export function formatStoreAmount(amount: number | null | undefined, currency = "TRY"): string {
  if (amount == null) return "-";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(amount);
}

export function formatStoreDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function formatStoreClock(value: string | number | Date | null | undefined): string {
  if (value == null || value === "") return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export function defaultWorkingHours(): StoreWorkingHour[] {
  return STORE_WEEKDAYS.map((day) => ({
    day,
    opensAt: "10:00",
    closesAt: "23:59",
    closed: false,
  }));
}

const WEEKDAY_FROM_LONG: Record<string, StoreWeekday> = {
  monday: "MONDAY",
  tuesday: "TUESDAY",
  wednesday: "WEDNESDAY",
  thursday: "THURSDAY",
  friday: "FRIDAY",
  saturday: "SATURDAY",
  sunday: "SUNDAY",
};

export function isStoreWithinWorkingHours(
  hours: StoreWorkingHour[],
  now = new Date(),
  timeZone = "Europe/Istanbul",
): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = WEEKDAY_FROM_LONG[(parts.find((part) => part.type === "weekday")?.value ?? "").toLowerCase()];
  const hour = (parts.find((part) => part.type === "hour")?.value ?? "00").padStart(2, "0");
  const minute = (parts.find((part) => part.type === "minute")?.value ?? "00").padStart(2, "0");
  if (!weekday) return false;
  const today = hours.find((entry) => entry.day === weekday);
  if (!today || today.closed) return false;
  const clock = `${hour.slice(-2)}:${minute.slice(-2)}`;
  const opens = (today.opensAt ?? "00:00").slice(0, 5);
  const closes = (today.closesAt ?? "23:59").slice(0, 5);
  return clock >= opens && clock <= closes;
}

export function isMerchantListedOpen(merchant: Pick<Merchant, "status" | "manuallyClosed">): boolean {
  return merchant.status === "ACTIVE" && !merchant.manuallyClosed;
}

export function isMerchantStoreOpen(
  merchant: Pick<Merchant, "status" | "open" | "manuallyClosed"> & {
    delivery?: { workingHours?: StoreWorkingHour[] | null } | null;
  },
  now = new Date(),
): boolean {
  if (!isMerchantListedOpen(merchant)) return false;
  const hours = merchant.delivery?.workingHours ?? [];
  if (hours.length === 0) return merchant.open;
  return isStoreWithinWorkingHours(hours, now);
}

export function merchantOpenHint(
  merchant: Pick<Merchant, "status" | "open" | "manuallyClosed"> & {
    delivery?: { workingHours?: StoreWorkingHour[] | null } | null;
  },
  now = new Date(),
): string {
  if (merchant.manuallyClosed || merchant.status !== "ACTIVE") return "Mağazanız şu anda kapalı.";
  if (isMerchantStoreOpen(merchant, now)) return "Mağazanız şu anda sipariş alıyor.";
  return "Mağaza açık. Şu an çalışma saati dışında.";
}

export function formatStoreAddress(address: {
  addressText?: string | null;
  buildingNo?: string | null;
  floorNo?: string | null;
  doorNo?: string | null;
  district?: string | null;
  city?: string | null;
}): string {
  const parts = [
    address.addressText,
    address.buildingNo ? `No: ${address.buildingNo}` : null,
    address.floorNo ? `Kat: ${address.floorNo}` : null,
    address.doorNo ? `Daire: ${address.doorNo}` : null,
    address.district,
    address.city,
  ].filter((part): part is string => Boolean(part && part.trim()));
  return parts.length ? parts.join(", ") : "-";
}

/** `<input type="time">` rejects `HH:mm:ss` from Jackson LocalTime unless step includes seconds. */
export function toStoreTimeInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{2}:\d{2})/.exec(value.trim());
  return match?.[1] ?? value;
}
