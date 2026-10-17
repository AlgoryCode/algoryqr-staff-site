import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import {
  ORDER_FLOW_ACTION_STATUS,
  stampOrderFlow,
  storeHttpStepsFor,
  type OrderFlowAction,
  type OrderFlowStatus,
} from "@/lib/order-flow";

export type MerchantStatus = "DRAFT" | "ACTIVE" | "SUSPENDED" | "CLOSED";
export type StoreDeliveryType = "DELIVERY" | "PICKUP";
export type StorePaymentMethod = "CASH_ON_DELIVERY" | "CARD_ON_DELIVERY";
export type StorePaymentStatus = "PENDING" | "PAID";
export type StoreCourierVehicleType = "MOTORCYCLE" | "BICYCLE" | "CAR" | "ON_FOOT";
export type StoreOrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "ON_THE_WAY"
  | "DELIVERED"
  | "REJECTED"
  | "CANCELLED"
  | OrderFlowStatus;

export type StoreWeekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type StoreWorkingHour = {
  day: StoreWeekday;
  opensAt: string | null;
  closesAt: string | null;
  closed: boolean;
};

export type StoreBusinessInfo = {
  businessName: string;
  legalName?: string | null;
  taxOffice?: string | null;
  taxNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type StoreDeliverySettings = {
  minOrderAmount: number;
  deliveryFee: number;
  freeDeliveryThreshold?: number | null;
  avgPrepMinutes: number;
  deliveryRadiusKm?: number | null;
  deliveryTypes: StoreDeliveryType[];
  paymentMethods: StorePaymentMethod[];
  workingHours: StoreWorkingHour[];
};

export type Merchant = {
  id: number;
  storeNo: number;
  slug: string;
  handle: string;
  storeUrl: string;
  status: MerchantStatus;
  open: boolean;
  branchId?: number | null;
  catalogMenuId: number;
  business: StoreBusinessInfo;
  delivery: StoreDeliverySettings;
  manuallyClosed: boolean;
  currency: string;
  createdAt: string;
};

export type StoreSetupPrefill = {
  alreadySetUp: boolean;
  suggested?: StoreBusinessInfo | null;
  branches: { id: number; name: string; address?: string | null; phone?: string | null; email?: string | null; photoUrl?: string | null }[];
  menus: { menuId: number; businessName: string; productCount: number; branchName?: string | null }[];
};

export type StoreSetupPayload = {
  business: StoreBusinessInfo;
  delivery: StoreDeliverySettings;
  branchId?: number | null;
  sourceMenuId?: number | null;
};

export type StoreUpdatePayload = {
  business?: StoreBusinessInfo;
  delivery?: StoreDeliverySettings;
  manuallyClosed?: boolean;
  status?: MerchantStatus;
};

export type StoreCourier = {
  id: number;
  fullName: string;
  phone: string;
  vehicleType: StoreCourierVehicleType;
  active: boolean;
};

export type StoreCourierPayload = {
  fullName: string;
  phone: string;
  vehicleType: StoreCourierVehicleType;
  active?: boolean;
};

export type StoreOrderItem = {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  note?: string | null;
  options: { groupId: number; groupName: string; optionId: number; optionName: string; priceDelta: number }[];
  lineTotal: number;
};

export type StoreOrderSummary = {
  id: number;
  orderNo: string;
  /** Mağazanın sipariş anındaki şubesi; boşsa tüm şubelerde görünür. */
  branchId?: number | null;
  status: StoreOrderStatus;
  deliveryType: StoreDeliveryType;
  paymentMethod: StorePaymentMethod;
  paymentStatus: StorePaymentStatus;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  currency: string;
  itemCount: number;
  courier?: { id: number; fullName: string; phone: string } | null;
  createdAt: string;
};

export type StoreOrderDetail = StoreOrderSummary & {
  publicToken: string;
  customerId?: number | null;
  address: {
    addressText?: string | null;
    city?: string | null;
    district?: string | null;
    buildingNo?: string | null;
    floorNo?: string | null;
    doorNo?: string | null;
    directions?: string | null;
  };
  note?: string | null;
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  courierStaff?: { staffId?: number; id?: number; displayName?: string | null } | null;
  items: StoreOrderItem[];
  history: {
    fromStatus?: StoreOrderStatus | null;
    toStatus: StoreOrderStatus;
    changedByType: "CUSTOMER" | "MERCHANT" | "SYSTEM";
    note?: string | null;
    createdAt: string;
  }[];
  rejectReason?: string | null;
  cancelReason?: string | null;
  confirmedAt?: string | null;
  readyAt?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
};

export type StoreOrderPage = {
  content: StoreOrderSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  openCounts: Partial<Record<StoreOrderStatus, number>>;
};

export type StoreOrderAction =
  | OrderFlowAction
  | "confirm"
  | "preparing"
  | "ready"
  | "dispatch"
  | "deliver"
  | "reject"
  | "cancel";

export async function getStoreSetupPrefill() {
  const { data } = await api.get<StoreSetupPrefill>("/store/setup/prefill");
  return data;
}

export async function setupStore(payload: StoreSetupPayload) {
  const { data } = await api.post<Merchant>("/store/setup", payload, { timeout: 60_000 });
  return data;
}

/** The dashboard renders a setup CTA when no merchant exists, so 204 and 404 both mean "not set up". */
export async function getMyStore(): Promise<Merchant | null> {
  try {
    const { data, status } = await api.get<Merchant | "">("/store/me");
    if (status === 204 || !data) return null;
    return data as Merchant;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function updateMyStore(payload: StoreUpdatePayload) {
  const { data } = await api.patch<Merchant>("/store/me", payload);
  return data;
}

export async function listStoreCouriers() {
  const { data } = await api.get<StoreCourier[]>("/store/couriers");
  return data;
}

export async function createStoreCourier(payload: StoreCourierPayload) {
  const { data } = await api.post<StoreCourier>("/store/couriers", payload);
  return data;
}

export async function updateStoreCourier(courierId: number, payload: StoreCourierPayload) {
  const { data } = await api.put<StoreCourier>(`/store/couriers/${courierId}`, payload);
  return data;
}

export async function deleteStoreCourier(courierId: number) {
  await api.delete(`/store/couriers/${courierId}`);
}

export async function listStoreOrders(params: {
  status?: StoreOrderStatus[];
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}) {
  const { data } = await api.get<StoreOrderPage>("/store/orders", {
    params: {
      status: params.status?.length ? params.status : undefined,
      from: params.from || undefined,
      to: params.to || undefined,
      page: params.page ?? 0,
      size: params.size ?? 20,
    },
  });
  return data;
}

export async function getStoreOrder(orderId: number) {
  const { data } = await api.get<StoreOrderDetail>(`/store/orders/${orderId}`);
  return data;
}

const FLOW_ACTIONS = new Set<StoreOrderAction>([
  "markKitchenPreparing",
  "markKitchenPrepared",
  "markKitchenDeliveredToWaiter",
  "markKitchenDeliveredToCourier",
  "markWaiterTaken",
  "markWaiterDeliveredToCustomer",
  "markWaiterDeliveredToCourier",
  "markCourierTaken",
  "markCourierDeliveredToCustomer",
]);

export async function advanceStoreOrder(orderId: number, action: StoreOrderAction, reason?: string) {
  const current = FLOW_ACTIONS.has(action) ? await getStoreOrder(orderId) : null;
  const steps =
    current && FLOW_ACTIONS.has(action)
      ? storeHttpStepsFor(action as OrderFlowAction, current.status, current.deliveryType === "DELIVERY")
      : [action];

  let latest = current;
  for (const step of steps) {
    const needsReason = step === "reject" || step === "cancel";
    const { data } = await api.post<StoreOrderDetail>(
      `/store/orders/${orderId}/${step}`,
      needsReason ? { reason: reason ?? null } : {},
    );
    latest = data;
  }

  if (!latest) {
    const { data } = await api.post<StoreOrderDetail>(
      `/store/orders/${orderId}/${action}`,
      {},
    );
    latest = data;
  }

  if (FLOW_ACTIONS.has(action) && steps.length > 0) {
    const stamped = stampOrderFlow(
      { id: orderId, status: latest.status, deliveryType: latest.deliveryType },
      ORDER_FLOW_ACTION_STATUS[action as OrderFlowAction],
    );
    return { ...latest, status: stamped.status as StoreOrderStatus };
  }
  return latest;
}

export async function assignStoreCourier(orderId: number, courierId: number) {
  const { data } = await api.post<StoreOrderDetail>(`/store/orders/${orderId}/courier`, { courierId });
  return data;
}

export type PhoneOrderPayload = {
  customerName: string;
  customerPhone: string;
  addressText: string;
  paymentMethod: StorePaymentMethod;
  note?: string;
  items: { productId: number; quantity: number }[];
};

export async function createPhoneOrder(payload: PhoneOrderPayload): Promise<StoreOrderDetail> {
  const { data } = await api.post<StoreOrderDetail>("/store/phone-orders", payload);
  return data;
}
