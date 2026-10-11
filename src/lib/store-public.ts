import type {
  StoreDeliveryType,
  StoreOrderStatus,
  StorePaymentMethod,
  StoreWorkingHour,
} from "@/lib/store-api";

export type StorePublicOptionChoice = {
  optionId: number;
  name: string;
  priceDelta: number | null;
  available: boolean;
  sortOrder: number;
};

export type StorePublicOptionGroup = {
  groupId: number;
  name: string;
  kind?: string | null;
  unit?: string | null;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  options: StorePublicOptionChoice[];
};

export type StorePublicProduct = {
  productId: number;
  name: string;
  description?: string | null;
  price: number | null;
  currency: string;
  imageUrl?: string | null;
  available: boolean;
  optionGroups: StorePublicOptionGroup[];
};

export type StorePublicCategory = {
  categoryId: number;
  slug: string;
  name: string;
  products: StorePublicProduct[];
};

export type StorePublicSummary = {
  storeNo: number;
  handle: string;
  canonicalHandle: string;
  businessName: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  open: boolean;
  minOrderAmount: number;
  deliveryFee: number;
  freeDeliveryThreshold?: number | null;
  avgPrepMinutes: number;
  deliveryTypes: StoreDeliveryType[];
  courierEnabled?: boolean | null;
  paymentMethods: StorePaymentMethod[];
  currency: string;
  workingHours: StoreWorkingHour[];
};

export type StorefrontData = {
  store: StorePublicSummary;
  categories: StorePublicCategory[];
};

export type StoreOrderTracking = {
  orderNo: string;
  publicToken: string;
  status: StoreOrderStatus;
  deliveryType: StoreDeliveryType;
  paymentMethod: StorePaymentMethod;
  businessName: string;
  customerName: string;
  addressText?: string | null;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  currency: string;
  avgPrepMinutes: number;
  courierName?: string | null;
  courierPhone?: string | null;
  items: {
    productId: number;
    productName: string;
    unitPrice: number;
    quantity: number;
    note?: string | null;
    options: { groupId: number; groupName: string; optionId: number; optionName: string; priceDelta: number }[];
    lineTotal: number;
  }[];
  createdAt: string;
  confirmedAt?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
};

export type StoreHandle = {
  storeNo: number;
  token: string;
};

export function publicStoreDeliveryTypes(
  types: StoreDeliveryType[],
  courierEnabled?: boolean | null,
): StoreDeliveryType[] {
  if (courierEnabled === undefined) return types;
  if (!courierEnabled) return types.filter((type) => type !== "DELIVERY");
  return types;
}

export function parseStoreHandle(handle: string): StoreHandle | null {
  const trimmed = handle.trim();
  const firstDash = trimmed.indexOf("-");
  const lastDash = trimmed.lastIndexOf("-");
  if (firstDash <= 0 || lastDash === trimmed.length - 1) return null;

  const storeNo = Number(trimmed.slice(0, firstDash));
  if (!Number.isSafeInteger(storeNo) || storeNo <= 0) return null;

  const token = trimmed.slice(lastDash + 1);
  if (!token) return null;

  return { storeNo, token };
}

export function storePath(handle: string, ...segments: string[]): string {
  return ["/store", handle, ...segments].join("/");
}
