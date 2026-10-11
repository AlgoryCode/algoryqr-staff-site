"use client";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { MENU_APP_ORIGIN } from "@/lib/config";
import { isDateUsablePurchase, pickActivePurchase } from "@/lib/product-access";
import { resolvePublicMenuHref } from "@/lib/public-menu-href";

export { ApiError, getApiErrorCode } from "@/lib/api/errors";
export {
  hasActiveProductAccess,
  hasExpiredProductAccess,
  isDateUsableEntitlement,
  isDateUsablePurchase,
  pickActivePurchase,
} from "@/lib/product-access";

const USER_KEY = "algory_user";
const hasWindow = typeof window !== "undefined";

export interface StoredUser {
  id?: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export function setStoredUser(user: StoredUser) {
  if (!hasWindow) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): StoredUser | null {
  if (!hasWindow) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function clearStoredUser() {
  if (!hasWindow) return;
  localStorage.removeItem(USER_KEY);
}

export type QrRequestDetails =
  | {
      url: string;
    }
  | {
      ssid: string;
      password: string;
      security: "WPA" | "WEP" | "NONE";
    }
  | {
      mail: string;
      subject: string;
      body: string;
    }
  | {
      fullName: string;
      phone: string;
      mail: string;
      company: string;
      title: string;
    }
  | {
      text: string;
    }
  | {
      latitude: string;
      longitude: string;
      label: string;
    }
  | {
      businessName: string;
      slogan?: string;
      phone?: string;
      email?: string;
      address?: string;
      themeId: string;
      chefName?: string;
      chefAvatarKey?: string;
      publicOrigin?: string;
      products?: Array<{
        name: string;
        description?: string;
        price?: number;
        currency?: string;
        category?: string;
        imageUrl?: string;
        available?: boolean;
        sortOrder?: number;
      }>;
    };

export interface CreateQrRequestBody {
  userId?: number | string;
  qrName: string;
  type: string;
  details: QrRequestDetails;
}

export interface QrResponse {
  id: string;
  qrName: string;
  type: string;
  details: QrRequestDetails;
  imgSrc: string;
  status: "active" | "inactive" | "draft";
  createdAt: string;
  updatedAt: string;
  scans: number;
}

export interface CreateQrResponse {
  qrResponse: QrResponse;
  qrId?: number;
  publicUrl?: string;
  menuId?: number;
}

export interface UpdateQrRequestBody {
  userId?: number | string;
  qrName: string;
  type: string;
  details: QrRequestDetails;
}

type UpdateQrGatewayResponse = {
  imgSrc: string;
};

export interface UpdateQrNameRequestBody {
  qrName: string;
}

type UpdateQrNameGatewayResponse = {
  qrName?: string;
  id?: number | string;
};

export interface UserQrApiItem {
  qrId: number;
  userId?: number;
  customerId?: number;
  qrName: string;
  imgSrc?: string | null;
  details: Record<string, unknown>;
  createdAt: string;
  purchaseId?: number | null;
  packageName?: string | null;
  legacy?: boolean;
  activePackage?: boolean;
  active?: boolean;
  menuId?: number | null;
}

export interface UserQrPageApiResponse {
  content: UserQrApiItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export interface UserEntitlementApiItem {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  purchaseId: number;
  totalQuantity: number;
  remainingQuantity: number;
  usedQuantity: number;
  unlimited: boolean;
  startsAt?: string | null;
  expiresAt?: string | null;
  purchaseStatus?: string | null;
  usable: boolean;
  expired: boolean;
  lastUsage?: string | null;
}

export interface PurchaseApiItem {
  id: number;
  packageId?: number;
  packageName: string;
  packageCode: string;
  price?: number | string;
  currency?: string;
  status?: string;
  purchaseType?: string;
  paymentMode?: string;
  paymentStyle?: string;
  installmentCount?: number;
  paymentId?: string | null;
  paymentConversationId?: string | null;
  paymentMethodId?: number | null;
  cardBrand?: string | null;
  cardLastFour?: string | null;
  startsAt?: string;
  expiresAt?: string;
  purchasedAt?: string;
  subscriptionStatus?: string | null;
  billingPeriod?: "MONTHLY" | "YEARLY" | string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodConversationId?: string | null;
  currentPeriodPaidAt?: string | null;
  subscriptionGraceEndsAt?: string | null;
  manualPaymentRequired?: boolean;
  refundEligibleUntil?: string | null;
  refundEligible?: boolean;
  refundableAmount?: number | string | null;
  refundCoolingDays?: number | null;
  refundedAt?: string | null;
  refundStatus?: string | null;
  daysUntilExpiry?: number | null;
  nextPaymentDueAt?: string | null;
  paymentApproaching?: boolean;
  expiryApproaching?: boolean;
  usable: boolean;
  expired: boolean;
}

export type PurchaseStatus =
  | "PENDING"
  | "ACTIVE"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "SUPERSEDED";

export interface InstallmentOptionApiItem {
  installmentCount: number;
  monthlyAmount?: number | string;
  totalAmount?: number | string;
}

export interface InstallmentScheduleApiItem {
  installmentNumber: number;
  dueAt?: string;
  amount: number | string;
  currency?: string;
  status: string;
  startsAt?: string;
  expiresAt?: string;
}

export interface PurchaseBillingSnapshotApi {
  billingAddressId?: number | null;
  type?: string | null;
  name?: string | null;
  surname?: string | null;
  legalName?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface PurchaseSummaryApiItem {
  purchaseId: number | null;
  packageId: number;
  packageCode: string;
  packageName: string;
  price: number | string;
  currency: string;
  status: PurchaseStatus;
  purchaseType?: string;
  paymentStyle?: string;
  startsAt?: string;
  expiresAt?: string;
  purchasedAt?: string;
  subscriptionStatus?: string | null;
  billingPeriod?: "MONTHLY" | "YEARLY" | string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodConversationId?: string | null;
  currentPeriodPaidAt?: string | null;
  subscriptionGraceEndsAt?: string | null;
  manualPaymentRequired?: boolean;
  refundEligibleUntil?: string | null;
  refundEligible?: boolean;
  refundableAmount?: number | string | null;
  refundCoolingDays?: number | null;
  refundedAt?: string | null;
  refundStatus?: string | null;
  daysUntilExpiry?: number | null;
  nextPaymentDueAt?: string | null;
  paymentApproaching?: boolean;
  expiryApproaching?: boolean;
  expired: boolean;
  usable: boolean;
  paymentMode?: "DIRECT" | "THREE_DS" | "CHECKOUT_FORM" | string;
  installmentCount?: number;
  paymentId?: string | null;
  paymentConversationId?: string | null;
  paymentMethodId?: number | null;
  cardBrand?: string | null;
  cardLastFour?: string | null;
  billingSnapshot?: PurchaseBillingSnapshotApi | null;
  products?: UserEntitlementApiItem[];
  monthlyAmount?: number | string;
  totalAmount?: number | string;
  installmentSchedule?: InstallmentScheduleApiItem[];
  installments?: InstallmentScheduleApiItem[];
  retryPaymentAvailable?: boolean;
  updateCardAvailable?: boolean;
}

export interface FulfillmentDetailApiItem {
  id: number;
  fulfillmentId: number;
  featureCode: string;
  scopeCode: string | null;
  productTypeId: "PACKAGE_PRODUCT" | "ADDON_PRODUCT" | null;
  source: "PACKAGE_INCLUDE" | "ADDON_PURCHASE" | "ONBOARDING_PACKAGE";
  quantity: number;
  unlimited: boolean;
  usedQuantity: number;
  remainingQuantity: number;
  startsAt: string | null;
  expiresAt: string | null;
}

export interface SubscriptionOverviewApiItem {
  activePackage: PurchaseSummaryApiItem | null;
  entitlements: UserEntitlementApiItem[];
  addonPurchases?: PurchaseSummaryApiItem[];
  branchQuota?: {
    used: number;
    allowed: number;
    remaining: number;
    grandfathered: number;
    extraPurchased: number;
    canCreate: boolean;
  } | null;
  menuQuota?: {
    extraUsed: number;
    extraAllowed: number;
    extraRemaining: number;
    canCreateExtra: boolean;
  } | null;
  fulfillmentDetails?: FulfillmentDetailApiItem[];
  fulfillmentActive?: boolean;
}

export interface PlanPackageItemApi {
  id: number;
  productId?: number;
  productCode: string;
  productName: string;
  quantity: number;
  unlimited: boolean;
}

export type ProductBillingType = "RECURRING" | "ONE_TIME";

/** A catalog product as returned by `GET /products`. */
export interface CatalogProductApiItem {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  scopeCode?: string | null;
  typeId?: "PACKAGE_PRODUCT" | "ADDON_PRODUCT" | null;
  featureCode?: string | null;
  unitPrice: number | string;
  vatRate: number | string;
  countable?: boolean;
  consumable?: boolean;
  addonPurchasable?: boolean;
  billingType?: ProductBillingType | null;
  active: boolean;
}

/** An optional module the buyer may attach to a package at checkout. */
export interface PlanPackageModuleApi {
  productId: number;
  productCode: string;
  productName: string;
  description?: string | null;
  featureCode?: string | null;
  unitPrice: number | string;
  vatRate: number | string;
  billingType?: ProductBillingType | null;
  consumable?: boolean;
}

export interface PlanPackageApiItem {
  id: number;
  code: string;
  name: string;
  description: string;
  features?: string[];
  price: number | string;
  monthlyDiscount?: number | string | null;
  yearlyPrice?: number | string | null;
  yearlyDiscount?: number | string | null;
  effectiveMonthlyPrice?: number | string | null;
  effectiveYearlyPrice?: number | string | null;
  currency: string;
  active: boolean;
  validityDays: number;
  priority?: number | null;
  items: PlanPackageItemApi[];
  availableModules?: PlanPackageModuleApi[];
  allowedPaymentModes?: Array<"DIRECT" | "THREE_DS" | "CHECKOUT_FORM">;
  installmentOptions?: InstallmentOptionApiItem[];
  allowedInstallments?: number[];
}

export interface PackageUsageSummary {
  packageName: string;
  packageCode?: string | null;
  packageId?: number | null;
  purchaseType?: string | null;
  remaining: number;
  total: number;
  used: number;
  unlimited: boolean;
  expiresAt?: string | null;
  daysUntilExpiry?: number | null;
  nextPaymentDueAt?: string | null;
  paymentApproaching?: boolean;
  expiryApproaching?: boolean;
  usable?: boolean;
  isTrial?: boolean;
}

export function aggregatePackageUsage(
  entitlements: UserEntitlementApiItem[],
  purchases: PurchaseApiItem[],
): PackageUsageSummary {
  const activePurchase = pickActivePurchase(purchases);
  const activeEntitlements = entitlements.filter(
    (item) => (item.productCode === "QR_CREATE" || item.productCode === "QR_MENU") && item.usable && !item.expired,
  );
  const scopedEntitlements = activePurchase
    ? activeEntitlements.filter((item) => item.purchaseId === activePurchase.id)
    : activeEntitlements;
  const qrEntitlements = scopedEntitlements.filter((item) => item.productCode === "QR_CREATE");
  const unlimited = qrEntitlements.some((item) => item.unlimited);
  const remaining = qrEntitlements.reduce((sum, item) => sum + item.remainingQuantity, 0);
  const total = qrEntitlements.reduce((sum, item) => sum + item.totalQuantity, 0);
  const used = qrEntitlements.reduce((sum, item) => sum + item.usedQuantity, 0);

  return {
    packageName: activePurchase?.packageName ?? "Ücretsiz Paket",
    packageCode: activePurchase?.packageCode ?? null,
    packageId: activePurchase?.packageId ?? null,
    purchaseType: activePurchase?.purchaseType ?? null,
    remaining,
    total,
    used,
    unlimited,
    expiresAt: activePurchase?.expiresAt ?? null,
    daysUntilExpiry: activePurchase?.daysUntilExpiry ?? null,
    nextPaymentDueAt: activePurchase?.nextPaymentDueAt ?? null,
    paymentApproaching: activePurchase?.paymentApproaching ?? false,
    expiryApproaching: activePurchase?.expiryApproaching ?? false,
    usable: activePurchase ? isDateUsablePurchase(activePurchase) : false,
    isTrial: activePurchase?.purchaseType === "TRIAL",
  };
}

export async function getMyEntitlementsRequest(): Promise<UserEntitlementApiItem[]> {
  const response = await api.get<UserEntitlementApiItem[] | { content?: UserEntitlementApiItem[] }>(
    "/purchases/my/entitlements",
  );
  const data = response.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.content)) return data.content;
  return [];
}

export async function getMyPurchasesRequest(): Promise<PurchaseApiItem[]> {
  const response = await api.get<PurchaseApiItem[] | { content?: PurchaseApiItem[] }>("/purchases/my");
  const data = response.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.content)) return data.content;
  return [];
}

export async function getMySubscriptionOverviewRequest(): Promise<SubscriptionOverviewApiItem> {
  const response = await api.get<SubscriptionOverviewApiItem>("/purchases/subscription-overview");
  return {
    activePackage: response.data.activePackage ?? null,
    entitlements: Array.isArray(response.data.entitlements) ? response.data.entitlements : [],
    addonPurchases: Array.isArray(response.data.addonPurchases) ? response.data.addonPurchases : [],
    branchQuota: response.data.branchQuota ?? null,
    menuQuota: response.data.menuQuota ?? null,
    fulfillmentDetails: Array.isArray(response.data.fulfillmentDetails)
      ? response.data.fulfillmentDetails
      : [],
    fulfillmentActive: !!response.data.fulfillmentActive,
  };
}

export async function getActivePackagesRequest(): Promise<PlanPackageApiItem[]> {
  const response = await api.get<PlanPackageApiItem[]>("/packages");
  return response.data;
}

export async function getActiveProductsRequest(): Promise<CatalogProductApiItem[]> {
  const response = await api.get<CatalogProductApiItem[]>("/products");
  return response.data;
}

type CreateQrGatewayResponse = {
  imgSrc: string;
  qrId?: number;
  publicUrl?: string;
  menuId?: number;
};

export interface MenuQrBriefApiItem {
  id: number;
  name?: string;
  imgSrc?: string;
}

export interface MenuProfileApiItem {
  menuId?: number;
  qrId?: number;
  publicId?: string;
  branchId?: number | null;
  userId?: number;
  themeId: string;
  businessName: string;
  slogan?: string;
  chefName?: string | null;
  chefDisplayName?: string | null;
  chefAvatarKey?: string | null;
  chefAvatarUrl?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  phone?: string;
  email?: string;
  address?: string;
  publicUrl: string;
  active: boolean;
  ratingAvg?: number | string | null;
  ratingCount?: number | null;
  userRating?: number | null;
  updatedAt?: string | null;
  qr?: MenuQrBriefApiItem | null;
}

export type NutritionBasis = "PER_100G" | "PER_100ML";

export interface NutritionNutrientEntry {
  name: string;
  value?: number | string | null;
  unit?: string | null;
}

export interface NutritionFacts {
  basis?: NutritionBasis | null;
  energyKj?: number | string | null;
  energyKcal?: number | string | null;
  fat?: number | string | null;
  saturatedFat?: number | string | null;
  carbohydrate?: number | string | null;
  sugars?: number | string | null;
  polyols?: number | string | null;
  starch?: number | string | null;
  fibre?: number | string | null;
  protein?: number | string | null;
  salt?: number | string | null;
  vitaminsAndMinerals?: NutritionNutrientEntry[] | null;
  otherNutrients?: NutritionNutrientEntry[] | null;
}

export interface MenuProductApiItem {
  productId: number;
  menuId?: number | null;
  name: string;
  description?: string;
  price?: number | string;
  currency: string;
  subCategoryId: number;
  subCategorySlug?: string;
  subCategoryName?: string;
  mainCategoryId?: number;
  mainCategorySlug?: string;
  mainCategoryName?: string;
  tags?: MenuTagApiItem[];
  allergens?: MenuAllergenApiItem[];
  sortOrder: number;
  imageUrl?: string;
  available: boolean;
  chefRecommended?: boolean;
  ratingAvg?: number | string;
  ratingCount?: number;
  servesPeopleMin?: number | null;
  servesPeopleMax?: number | null;
  nutrition?: NutritionFacts | null;
  pairings?: {
    productIds?: number[];
    mainCategoryIds?: number[];
    subCategoryIds?: number[];
  };
  optionGroups?: MenuProductOptionGroupApiItem[];
}

export interface MenuProductOptionApiItem {
  optionId: number;
  name: string;
  priceDelta?: number | string;
  available: boolean;
  sortOrder: number;
}

export interface MenuProductOptionGroupApiItem {
  groupId: number;
  name: string;
  kind?: string;
  unit?: string;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  options: MenuProductOptionApiItem[];
  productIds?: number[];
}

export interface CatalogOptionGroupWriteBody {
  name: string;
  kind?: string;
  unit?: string;
  minSelect?: number;
  maxSelect?: number;
  sortOrder?: number;
  options: Array<{
    name: string;
    priceDelta?: number;
    available?: boolean;
    sortOrder?: number;
  }>;
}

export interface MenuTagApiItem {
  id: number;
  slug: string;
  name: string;
  sortOrder: number;
}

export interface MenuAllergenApiItem {
  id: number;
  slug: string;
  name: string;
  sortOrder: number;
}

export interface SubCategoryApiItem {
  id: number;
  mainCategoryId: number;
  slug: string;
  name: string;
  sortOrder: number;
}

export interface MainCategoryApiItem {
  id: number;
  menuId?: number;
  userId?: number;
  slug: string;
  name: string;
  sortOrder: number;
  imageUrl?: string | null;
  subs: SubCategoryApiItem[];
}

export interface MenuCategoryCreateBody {
  name: string;
  slug?: string;
  sortOrder?: number;
}

export interface MenuCategoryUpdateBody {
  name?: string;
  sortOrder?: number;
}

export interface MenuSubCategoryCreateBody {
  name: string;
  slug?: string;
  sortOrder?: number;
}

export interface MenuSubCategoryUpdateBody {
  name?: string;
  sortOrder?: number;
  mainCategoryId?: number;
}

/** @deprecated legacy tree shape — prefer MainCategoryApiItem */
export interface MenuCategoryApiItem {
  categoryId: number;
  menuId?: number;
  parentId?: number | null;
  name: string;
  sortOrder: number;
  children: MenuCategoryApiItem[];
  slug?: string;
}

export interface PublicMenuApiResponse {
  menu: MenuProfileApiItem;
  products: MenuProductApiItem[];
  categories?: MainCategoryApiItem[];
  themeId: string;
  productPage?: number;
  productSize?: number;
  productTotalElements?: number;
  productHasNext?: boolean;
  categoryPage?: number;
  categorySize?: number;
  categoryTotalElements?: number;
  categoryHasNext?: boolean;
}

export interface MenuRatingApiResponse {
  menuId?: number;
  ratingAvg?: number | string | null;
  ratingCount?: number | null;
  userRating?: number | null;
}

export interface MenuProductPageApiResponse {
  content: MenuProductApiItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export interface MenuCategoryPageApiResponse {
  content: MainCategoryApiItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  q?: string | null;
}

export interface MenuProductRequestBody {
  name: string;
  description?: string;
  price?: number | string;
  currency?: string;
  subCategoryId: number;
  tagIds?: number[];
  allergenIds?: number[];
  sortOrder?: number;
  imageUrl?: string;
  available?: boolean;
  chefRecommended?: boolean;
  servesPeopleMin?: number | null;
  servesPeopleMax?: number | null;
  nutrition?: NutritionFacts;
  pairings?: {
    productIds?: number[];
    mainCategoryIds?: number[];
    subCategoryIds?: number[];
  };
  optionGroups?: Array<{
    name: string;
    kind?: string;
    unit?: string;
    minSelect?: number;
    maxSelect?: number;
    sortOrder?: number;
    options: Array<{
      name: string;
      priceDelta?: number | string;
      available?: boolean;
      sortOrder?: number;
    }>;
  }>;
}

export interface ProductFacetsApiResponse {
  totalMatching: number;
  tags: Array<{ tagId: number; slug: string; name: string; count: number }>;
  allergens?: Array<{ allergenId: number; slug: string; name: string; count: number }>;
  servesBuckets: Array<{ key: string; label: string; count: number }>;
}

export type PublicProductQuery = {
  page?: number;
  size?: number;
  chefRecommended?: boolean;
  tagSlug?: string;
  minRating?: number | string;
  subCategoryId?: number;
  mainCategoryId?: number;
  tagIds?: number[];
  servesPeople?: number;
  servesPeopleMin?: number;
  servesPeopleMax?: number;
  q?: string;
};

function appendPublicProductParams(params: URLSearchParams, query: PublicProductQuery = {}) {
  if (query.page != null) params.set("page", String(query.page));
  if (query.size != null) params.set("size", String(query.size));
  if (query.chefRecommended != null) params.set("chefRecommended", String(query.chefRecommended));
  if (query.tagSlug) params.set("tagSlug", query.tagSlug);
  if (query.minRating != null) params.set("minRating", String(query.minRating));
  if (query.subCategoryId != null) params.set("subCategoryId", String(query.subCategoryId));
  if (query.mainCategoryId != null) params.set("mainCategoryId", String(query.mainCategoryId));
  if (query.servesPeople != null) params.set("servesPeople", String(query.servesPeople));
  if (query.servesPeopleMin != null) params.set("servesPeopleMin", String(query.servesPeopleMin));
  if (query.servesPeopleMax != null) params.set("servesPeopleMax", String(query.servesPeopleMax));
  if (query.q) params.set("q", query.q);
  for (const tagId of query.tagIds ?? []) {
    params.append("tagIds", String(tagId));
  }
}

export async function getMenuByQrIdRequest(qrId: number | string): Promise<MenuProfileApiItem> {
  const response = await api.get<MenuProfileApiItem>(`/menu/by-qr/${qrId}`);
  return {
    ...response.data,
    publicUrl: resolvePublicMenuHref({
      publicUrl: response.data.publicUrl,
      publicId: response.data.publicId,
    }),
  };
}

export interface ActiveMenuSummaryApiItem {
  menuId: number;
  qrId: number;
  branchId?: number | null;
  businessName?: string | null;
  themeId?: string | null;
  publicUrl?: string | null;
  active: boolean;
  qr?: { id: number; name?: string | null } | null;
}

export async function getMyActiveMenusRequest(): Promise<ActiveMenuSummaryApiItem[]> {
  const response = await api.get<ActiveMenuSummaryApiItem[]>("/menu/my/active");
  return Array.isArray(response.data) ? response.data : [];
}

export async function getMyMenusRequest(): Promise<ActiveMenuSummaryApiItem[]> {
  const response = await api.get<ActiveMenuSummaryApiItem[]>("/menu/my");
  return Array.isArray(response.data) ? response.data : [];
}

export interface MenuProductsByQrApiResponse {
  menuId: number;
  qrId: number;
  businessName?: string | null;
  content: MenuProductApiItem[];
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
  hasNext?: boolean;
}

export interface MenuCategoriesByQrApiResponse {
  menuId: number;
  qrId: number;
  businessName?: string | null;
  categories: MainCategoryApiItem[];
}

export type MenuProductsByQrQuery = {
  page?: number;
  size?: number;
  q?: string;
  subCategoryId?: number;
};

function applyLocalProductPagination(
  items: MenuProductApiItem[],
  options: MenuProductsByQrQuery = {},
): Pick<MenuProductPageApiResponse, "content" | "page" | "size" | "totalElements" | "totalPages" | "hasNext"> {
  const page = options.page ?? 0;
  const size = options.size ?? 20;
  let filtered = items;
  if (options.q) {
    const q = options.q.toLocaleLowerCase("tr");
    filtered = filtered.filter((product) => product.name.toLocaleLowerCase("tr").includes(q));
  }
  if (options.subCategoryId != null) {
    filtered = filtered.filter((product) => product.subCategoryId === options.subCategoryId);
  }
  const totalElements = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size) || 1);
  const start = page * size;
  const content = filtered.slice(start, start + size);
  return {
    content,
    page,
    size,
    totalElements,
    totalPages,
    hasNext: start + size < totalElements,
  };
}

function normalizeProductPage(
  raw: Partial<MenuProductPageApiResponse> | null | undefined,
  options: MenuProductsByQrQuery = {},
): MenuProductPageApiResponse {
  const page = options.page ?? 0;
  const size = options.size ?? 20;
  const items = Array.isArray(raw?.content) ? raw.content : [];
  if (items.length > size) {
    return applyLocalProductPagination(items, options);
  }
  return {
    content: items,
    page: raw?.page ?? page,
    size: raw?.size ?? size,
    totalElements: raw?.totalElements ?? items.length,
    totalPages: Math.max(1, raw?.totalPages ?? 1),
    hasNext: Boolean(raw?.hasNext),
  };
}

export async function getMenuProductsByQrRequest(
  qrId: number | string,
  options: MenuProductsByQrQuery = {},
): Promise<MenuProductsByQrApiResponse> {
  const params: Record<string, string | number> = {};
  if (options.page != null) params.page = options.page;
  if (options.size != null) params.size = options.size;
  if (options.q) params.q = options.q;
  if (options.subCategoryId != null) params.subCategoryId = options.subCategoryId;

  const response = await api.get<MenuProductsByQrApiResponse>(`/menu/by-qr/${qrId}/products`, {
    params,
  });
  const data = response.data;
  const page = normalizeProductPage(data, options);
  return {
    ...data,
    ...page,
    content: page.content,
  };
}

export async function getMenuProductsPageRequest(
  menuId: number | string,
  options: MenuProductsByQrQuery = {},
): Promise<MenuProductPageApiResponse> {
  const page = options.page ?? 0;
  const size = options.size ?? 20;
  const params: Record<string, string | number> = { page, size };
  if (options.q) params.q = options.q;
  if (options.subCategoryId != null) params.subCategoryId = options.subCategoryId;

  const response = await api.get<MenuProductPageApiResponse>(`/menu/${menuId}/products`, {
    params,
  });
  return normalizeProductPage(response.data, options);
}

export async function getMenuCategoriesByQrRequest(
  qrId: number | string,
): Promise<MenuCategoriesByQrApiResponse> {
  const response = await api.get<MenuCategoriesByQrApiResponse>(`/menu/by-qr/${qrId}/categories`);
  return {
    ...response.data,
    categories: Array.isArray(response.data?.categories) ? response.data.categories : [],
  };
}

export async function getMenuProductsRequest(menuId: number | string): Promise<MenuProductApiItem[]> {
  const products: MenuProductApiItem[] = [];
  let page = 0;
  let hasNext = true;

  while (hasNext) {
    const response = await api.get<MenuProductPageApiResponse>(`/menu/${menuId}/products`, {
      params: { page, size: 50 },
    });
    const data = response.data;
    products.push(...(data.content ?? []));
    hasNext = Boolean(data.hasNext);
    page += 1;
    if (page > 100) break;
  }

  return products;
}

export async function getPublicMenuProductsRequest(
  menuId: number | string,
  pageOrQuery: number | PublicProductQuery = 0,
  size = 20,
): Promise<MenuProductPageApiResponse> {
  const query: PublicProductQuery =
    typeof pageOrQuery === "number"
      ? { page: pageOrQuery, size }
      : { page: 0, size: 20, ...pageOrQuery };
  const params = new URLSearchParams();
  appendPublicProductParams(params, query);
  const response = await fetch(`/api/menu/public/${encodeURIComponent(String(menuId))}/products?${params}`);
  if (!response.ok) {
    throw new ApiError(response.status, "Ürünler yüklenemedi");
  }
  return response.json() as Promise<MenuProductPageApiResponse>;
}

export async function getPublicMenuCategoriesRequest(
  menuId: number | string,
  page = 0,
  size = 50,
  q?: string,
): Promise<MenuCategoryPageApiResponse> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  if (q?.trim()) params.set("q", q.trim());
  const response = await fetch(
    `/api/menu/public/${encodeURIComponent(String(menuId))}/categories?${params}`,
  );
  if (!response.ok) {
    throw new ApiError(response.status, "Kategoriler yüklenemedi");
  }
  return response.json() as Promise<MenuCategoryPageApiResponse>;
}

export async function getPublicProductFacetsRequest(
  menuId: number | string,
  query: PublicProductQuery = {},
): Promise<ProductFacetsApiResponse> {
  const params = new URLSearchParams();
  appendPublicProductParams(params, query);
  const response = await fetch(
    `/api/menu/public/${encodeURIComponent(String(menuId))}/product-facets?${params}`,
  );
  if (!response.ok) {
    throw new ApiError(response.status, "Ürün filtreleri yüklenemedi");
  }
  return response.json() as Promise<ProductFacetsApiResponse>;
}

export async function getPublicProductRequest(
  menuId: number | string,
  productId: number | string,
): Promise<MenuProductApiItem> {
  const response = await fetch(
    `/api/menu/public/${encodeURIComponent(String(menuId))}/products/${encodeURIComponent(String(productId))}`,
  );
  if (!response.ok) {
    throw new ApiError(response.status, "Ürün yüklenemedi");
  }
  return response.json() as Promise<MenuProductApiItem>;
}

export async function getPublicProductRecommendationsRequest(
  menuId: number | string,
  productId: number | string,
  limit = 6,
): Promise<MenuProductApiItem[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const response = await fetch(
    `/api/menu/public/${encodeURIComponent(String(menuId))}/products/${encodeURIComponent(String(productId))}/recommendations?${params}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new ApiError(response.status, "Öneriler yüklenemedi");
  }
  const data = (await response.json()) as MenuProductApiItem[];
  return Array.isArray(data) ? data : [];
}

export async function createMenuProductRequest(
  menuId: number | string,
  payload: MenuProductRequestBody,
): Promise<MenuProductApiItem> {
  const response = await api.post<MenuProductApiItem>(`/menu/${menuId}/products`, payload);
  return response.data;
}

export async function listCatalogProductsRequest(): Promise<MenuProductApiItem[]> {
  const response = await api.get<MenuProductApiItem[]>("/menu/catalog/products");
  return Array.isArray(response.data) ? response.data : [];
}

export async function listCatalogOptionGroupsRequest(): Promise<MenuProductOptionGroupApiItem[]> {
  const response = await api.get<MenuProductOptionGroupApiItem[]>("/menu/catalog/option-groups");
  return Array.isArray(response.data) ? response.data : [];
}

export async function createCatalogOptionGroupRequest(
  payload: CatalogOptionGroupWriteBody,
): Promise<MenuProductOptionGroupApiItem> {
  const response = await api.post<MenuProductOptionGroupApiItem>("/menu/catalog/option-groups", payload);
  return response.data;
}

export async function updateCatalogOptionGroupRequest(
  groupId: number,
  payload: CatalogOptionGroupWriteBody,
): Promise<MenuProductOptionGroupApiItem> {
  const response = await api.put<MenuProductOptionGroupApiItem>(
    `/menu/catalog/option-groups/${groupId}`,
    payload,
  );
  return response.data;
}

export async function deleteCatalogOptionGroupRequest(groupId: number): Promise<void> {
  await api.delete(`/menu/catalog/option-groups/${groupId}`);
}

export async function assignCatalogOptionGroupRequest(
  groupId: number,
  productIds: number[],
): Promise<MenuProductOptionGroupApiItem> {
  const response = await api.post<MenuProductOptionGroupApiItem>(
    `/menu/catalog/option-groups/${groupId}/assign`,
    { productIds },
  );
  return response.data;
}

export async function listCatalogCategoriesRequest(): Promise<MainCategoryApiItem[]> {
  const response = await api.get<MainCategoryApiItem[]>("/menu/catalog/categories");
  return Array.isArray(response.data) ? response.data : [];
}

export async function createCatalogCategoryRequest(
  payload: MenuCategoryCreateBody,
): Promise<MainCategoryApiItem> {
  const response = await api.post<MainCategoryApiItem>("/menu/catalog/categories", payload);
  return response.data;
}

export async function updateCatalogCategoryRequest(
  categoryId: number | string,
  payload: MenuCategoryUpdateBody,
): Promise<MainCategoryApiItem> {
  const response = await api.put<MainCategoryApiItem>(
    `/menu/catalog/categories/${categoryId}`,
    payload,
  );
  return response.data;
}

export async function deleteCatalogCategoryRequest(categoryId: number | string): Promise<void> {
  await api.delete(`/menu/catalog/categories/${categoryId}`);
}

export async function createCatalogSubCategoryRequest(
  categoryId: number | string,
  payload: MenuSubCategoryCreateBody,
): Promise<SubCategoryApiItem> {
  const response = await api.post<SubCategoryApiItem>(
    `/menu/catalog/categories/${categoryId}/subs`,
    payload,
  );
  return response.data;
}

export async function updateCatalogSubCategoryRequest(
  subId: number | string,
  payload: MenuSubCategoryUpdateBody,
): Promise<SubCategoryApiItem> {
  const response = await api.put<SubCategoryApiItem>(`/menu/catalog/subs/${subId}`, payload);
  return response.data;
}

export async function deleteCatalogSubCategoryRequest(subId: number | string): Promise<void> {
  await api.delete(`/menu/catalog/subs/${subId}`);
}

export async function createCatalogProductRequest(
  payload: MenuProductRequestBody,
): Promise<MenuProductApiItem> {
  const response = await api.post<MenuProductApiItem>("/menu/catalog/products", payload);
  return response.data;
}

export async function assignProductToMenuRequest(
  menuId: number | string,
  productId: number | string,
  subCategoryId: number,
): Promise<MenuProductApiItem> {
  const response = await api.post<MenuProductApiItem>(
    `/menu/${menuId}/products/${productId}/assign`,
    { subCategoryId },
  );
  return response.data;
}

export async function assignMenuBranchRequest(
  menuId: number | string,
  branchId: number | null,
): Promise<MenuProfileApiItem> {
  const response = await api.put<MenuProfileApiItem>(`/menu/${menuId}/branch`, { branchId });
  return response.data;
}

export async function updateMenuProductRequest(
  productId: number | string,
  payload: MenuProductRequestBody,
): Promise<MenuProductApiItem> {
  const response = await api.put<MenuProductApiItem>(`/menu/products/${productId}`, payload);
  return response.data;
}

export async function patchMenuProductNutritionRequest(
  productId: number | string,
  payload: NutritionFacts,
): Promise<MenuProductApiItem> {
  const response = await api.patch<MenuProductApiItem>(`/menu/products/${productId}/nutrition`, payload);
  return response.data;
}

export async function deleteMenuProductRequest(productId: number | string): Promise<void> {
  await api.delete(`/menu/products/${productId}`);
}

export async function getMenuCategoriesRequest(menuId: number | string): Promise<MainCategoryApiItem[]> {
  const response = await api.get<MainCategoryApiItem[]>(`/menu/${menuId}/categories`);
  return Array.isArray(response.data) ? response.data : [];
}

export async function createMenuCategoryRequest(
  menuId: number | string,
  payload: MenuCategoryCreateBody,
): Promise<MainCategoryApiItem> {
  const response = await api.post<MainCategoryApiItem>(`/menu/${menuId}/categories`, payload);
  return response.data;
}

export async function updateMenuCategoryRequest(
  menuId: number | string,
  categoryId: number | string,
  payload: MenuCategoryUpdateBody,
): Promise<MainCategoryApiItem> {
  const response = await api.put<MainCategoryApiItem>(
    `/menu/${menuId}/categories/${categoryId}`,
    payload,
  );
  return response.data;
}

export async function deleteMenuCategoryRequest(
  menuId: number | string,
  categoryId: number | string,
): Promise<void> {
  await api.delete(`/menu/${menuId}/categories/${categoryId}`);
}

export async function createMenuSubCategoryRequest(
  menuId: number | string,
  categoryId: number | string,
  payload: MenuSubCategoryCreateBody,
): Promise<SubCategoryApiItem> {
  const response = await api.post<SubCategoryApiItem>(
    `/menu/${menuId}/categories/${categoryId}/subs`,
    payload,
  );
  return response.data;
}

export async function updateMenuSubCategoryRequest(
  menuId: number | string,
  subId: number | string,
  payload: MenuSubCategoryUpdateBody,
): Promise<SubCategoryApiItem> {
  const response = await api.put<SubCategoryApiItem>(`/menu/${menuId}/subs/${subId}`, payload);
  return response.data;
}

export async function deleteMenuSubCategoryRequest(
  menuId: number | string,
  subId: number | string,
): Promise<void> {
  await api.delete(`/menu/${menuId}/subs/${subId}`);
}

export async function getMenuTagsRequest(): Promise<MenuTagApiItem[]> {
  const response = await api.get<MenuTagApiItem[]>("/menu/tags");
  return Array.isArray(response.data) ? response.data : [];
}

export async function getMenuAllergensRequest(): Promise<MenuAllergenApiItem[]> {
  const response = await api.get<MenuAllergenApiItem[]>("/menu/allergens");
  return Array.isArray(response.data) ? response.data : [];
}

export function flattenMenuCategories(
  categories: MainCategoryApiItem[],
): Array<{ id: number; label: string; mainCategoryId: number }> {
  return categories.flatMap((main) =>
    (main.subs ?? []).map((sub) => ({
      id: sub.id,
      mainCategoryId: main.id,
      label: `${main.name} / ${sub.name}`,
    })),
  );
}

export interface MenuUpdateRequestBody {
  themeId?: string;
  businessName?: string;
  slogan?: string;
  chefName?: string | null;
  chefAvatarKey?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  phone?: string;
  email?: string;
  address?: string;
  active?: boolean;
}

export interface ChefAvatarApiItem {
  key: string;
  label: string;
  imageUrl: string;
}

export async function getChefAvatarsRequest(): Promise<ChefAvatarApiItem[]> {
  const response = await api.get<ChefAvatarApiItem[]>("/menu/chef-avatars");
  return response.data ?? [];
}

export async function updateMenuRequest(menuId: number | string, payload: MenuUpdateRequestBody): Promise<MenuProfileApiItem> {
  const response = await api.patch<MenuProfileApiItem>(`/menu/${menuId}`, payload);
  return response.data;
}

export async function deleteMenuRequest(menuId: number | string): Promise<void> {
  await api.delete(`/menu/${menuId}`);
}

export async function getPublicMenuRequest(identifier: string): Promise<PublicMenuApiResponse> {
  const response = await fetch(`/api/menu/public/${encodeURIComponent(identifier)}`);
  if (!response.ok) {
    throw new ApiError(response.status, "Menü bulunamadı");
  }
  return response.json() as Promise<PublicMenuApiResponse>;
}

export async function getPublicMenuRatingRequest(
  identifier: number | string,
): Promise<MenuRatingApiResponse> {
  const response = await fetch(`/api/menu/public/${encodeURIComponent(String(identifier))}/rating`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ApiError(response.status, "Menü puanı yüklenemedi");
  }
  return response.json() as Promise<MenuRatingApiResponse>;
}

export async function submitPublicMenuRatingRequest(
  identifier: number | string,
  rating: number,
  comment?: string,
): Promise<MenuRatingApiResponse> {
  const response = await fetch(`/api/menu/public/${encodeURIComponent(String(identifier))}/rating`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ score: rating, comment }),
  });
  if (!response.ok) {
    throw new ApiError(response.status, "Menü puanı kaydedilemedi");
  }
  return response.json() as Promise<MenuRatingApiResponse>;
}

export interface ProductRatingApiResponse {
  productId?: number;
  menuId?: number;
  score?: number;
  comment?: string | null;
  ratingAvg?: number | string | null;
  ratingCount?: number | null;
  userRating?: number | null;
}

export async function submitPublicProductRatingRequest(
  menuId: number | string,
  productId: number | string,
  rating: number,
  comment?: string,
): Promise<ProductRatingApiResponse> {
  const response = await fetch(
    `/api/menu/public/${encodeURIComponent(String(menuId))}/products/${encodeURIComponent(String(productId))}/ratings`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: rating, comment }),
    },
  );
  if (!response.ok) {
    throw new ApiError(response.status, "Ürün puanı kaydedilemedi");
  }
  return response.json() as Promise<ProductRatingApiResponse>;
}

export async function createQrRequest(payload: CreateQrRequestBody): Promise<CreateQrResponse> {
  const details =
    payload.type === "menu" && "businessName" in payload.details
      ? { ...payload.details, publicOrigin: MENU_APP_ORIGIN }
      : payload.details;
  const requestBody = {
    qrName: payload.qrName,
    type: payload.type,
    details,
  };
  const response = await api.post<CreateQrGatewayResponse>("/features/QR_MENU/qrs", requestBody);
  const now = new Date().toISOString();
  const qrId = response.data.qrId;

  return {
    qrResponse: {
      id: qrId != null ? String(qrId) : `temp-${Date.now()}`,
      qrName: payload.qrName,
      type: payload.type,
      details,
      imgSrc: response.data.imgSrc,
      status: "active",
      createdAt: now,
      updatedAt: now,
      scans: 0,
    },
    qrId,
    publicUrl: response.data.publicUrl
      ? resolvePublicMenuHref({ publicUrl: response.data.publicUrl })
      : response.data.publicUrl,
    menuId: response.data.menuId,
  };
}

export type QrListScope = "ALL" | "CURRENT" | "LEGACY";

export async function getUserQrsRequest(
  userId: number | string,
  options?: { includeImage?: boolean; page?: number; size?: number; scope?: QrListScope },
): Promise<UserQrPageApiResponse> {
  const includeImage = options?.includeImage === true;
  const page = options?.page ?? 0;
  const size = options?.size ?? 5;
  const scope = options?.scope ?? "ALL";
  const response = await api.get<UserQrPageApiResponse>(`/qr/user/${userId}`, {
    params: { includeImage, page, size, scope },
  });
  return response.data;
}

export async function deleteQrRequest(qrId: number | string): Promise<string> {
  const response = await api.delete<string>(`/qr/delete/${qrId}`);
  return response.data;
}

export async function deleteMenuQrRequest(qrId: number | string): Promise<string> {
  const response = await api.delete<string>(`/qr/delete-menu/${qrId}`);
  return response.data;
}

export interface UpdateQrActiveRequestBody {
  active: boolean;
}

export interface UpdateQrActiveResponse {
  qrId: number;
  active: boolean;
}

export async function updateQrActiveRequest(
  qrId: number | string,
  payload: UpdateQrActiveRequestBody,
): Promise<UpdateQrActiveResponse> {
  const response = await api.patch<UpdateQrActiveResponse>(`/qr/update-active/${qrId}`, payload);
  return response.data;
}

export async function updateQrRequest(
  qrId: number | string,
  payload: UpdateQrRequestBody
): Promise<UpdateQrGatewayResponse> {
  const requestBody = {
    userId: payload.userId,
    qrName: payload.qrName,
    type: payload.type,
    details: payload.details,
  };
  const response = await api.put<UpdateQrGatewayResponse>(`/qr/update/${qrId}`, requestBody);
  return response.data;
}

export async function updateQrNameRequest(
  qrId: number | string,
  payload: UpdateQrNameRequestBody
): Promise<UpdateQrNameGatewayResponse> {
  const response = await api.patch<UpdateQrNameGatewayResponse>(`/qr/update-name/${qrId}`, payload);
  return response.data;
}

export interface MenuAnalyticsReportKpis {
  sessions: number;
  menuOpens: number;
  productViews: number;
  categoryViews: number;
  avgProductsPerSession: number;
}

export interface MenuAnalyticsReportResponse {
  menuId?: number | null;
  menuName?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  from: string;
  to: string;
  kpis: MenuAnalyticsReportKpis;
  daily: { date: string; sessions: number; menuOpens: number; productViews: number }[];
  hourly: { hour: number; views: number }[];
  devices: { name: string; value: number }[];
  topProducts: { productId: number; name: string; views: number }[];
  topCategories: { categoryId: number; name: string; views: number }[];
  categoryProductTree: { name: string; size: number; children?: { name: string; size: number }[] }[];
  sampleJourneys: {
    sessionId: string;
    startedAt: string;
    steps: { type: string; name: string; at: string }[];
  }[];
  funnel: { menuOpens: number; categoryViews: number; productViews: number };
}

export async function getMenuAnalyticsReportRequest(
  menuId: number | string,
  from: string,
  to: string,
): Promise<MenuAnalyticsReportResponse> {
  const response = await api.get<MenuAnalyticsReportResponse>(
    `/analytics/menu/${menuId}/report`,
    { params: { from, to } },
  );
  return response.data;
}

export interface MenuRevenueKpis {
  totalRevenue?: number | string | null;
  orderCount?: number;
  itemCount?: number;
  avgOrderValue?: number | string | null;
  currency?: string | null;
}

export interface MenuRevenueProductRow {
  productId: number;
  name: string;
  quantity: number;
  revenue?: number | string | null;
}

export interface MenuRevenueReportResponse {
  menuId?: number | null;
  menuName?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  from: string;
  to: string;
  kpis: MenuRevenueKpis;
  daily: { date: string; revenue?: number | string | null; orderCount?: number }[];
  products: MenuRevenueProductRow[];
  categories: {
    categoryId?: number | null;
    name: string;
    quantity: number;
    revenue?: number | string | null;
  }[];
  spotlight?: {
    byQuantity?: MenuRevenueProductRow | null;
    byRevenue?: MenuRevenueProductRow | null;
    leastSoldByQuantity?: MenuRevenueProductRow | null;
  } | null;
  hourly?: { hour: number; revenue?: number | string | null; orderCount?: number }[];
  unsold?: {
    count?: number;
    products?: { productId: number; name: string }[];
  } | null;
  paymentBreakdown?: MenuRevenuePaymentBreakdown | null;
  personnel?: MenuRevenuePersonnelRow[];
  channels?: RevenueChannelShare[];
  channelDaily?: RevenueChannelDailyPoint[];
}

export interface MenuRevenuePaymentBreakdown {
  cashRevenue?: number | string | null;
  cardRevenue?: number | string | null;
  tipRevenue?: number | string | null;
  uberEatsRevenue?: number | string | null;
  grossRevenue?: number | string | null;
  fixedExpenseTotal?: number | string | null;
  netRevenue?: number | string | null;
  currency?: string | null;
}

export interface RevenueChannelShare {
  code: string;
  label: string;
  revenue?: number | string | null;
  orderCount?: number;
  avgOrderValue?: number | string | null;
  sharePercent?: number | string | null;
  deltaVsPrevPercent?: number | string | null;
  connected: boolean;
}

export interface RevenueChannelDailyPoint {
  date: string;
  channelCode: string;
  revenue?: number | string | null;
  orderCount?: number;
}

export interface MenuRevenuePersonnelRow {
  staffId?: number | null;
  waiterId?: number | null;
  displayName: string;
  revenue?: number | string | null;
  cashRevenue?: number | string | null;
  cardRevenue?: number | string | null;
  tipRevenue?: number | string | null;
  active?: boolean;
}

export interface MenuFixedExpenseItem {
  id: number;
  menuId: number;
  title: string;
  dailyAmount?: number | string | null;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export type FixedExpensePeriod = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface BranchFixedExpenseItem {
  id: number;
  branchId: number;
  title: string;
  amount?: number | string | null;
  period: FixedExpensePeriod;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export async function listMenuFixedExpensesRequest(
  menuId: number | string,
): Promise<MenuFixedExpenseItem[]> {
  const response = await api.get<MenuFixedExpenseItem[]>(`/menus/${menuId}/fixed-expenses`);
  return Array.isArray(response.data) ? response.data : [];
}

export async function createMenuFixedExpenseRequest(
  menuId: number | string,
  payload: { title: string; dailyAmount: number; active?: boolean },
): Promise<MenuFixedExpenseItem> {
  const response = await api.post<MenuFixedExpenseItem>(`/menus/${menuId}/fixed-expenses`, payload);
  return response.data;
}

export async function updateMenuFixedExpenseRequest(
  menuId: number | string,
  expenseId: number | string,
  payload: { title?: string; dailyAmount?: number; active?: boolean },
): Promise<MenuFixedExpenseItem> {
  const response = await api.put<MenuFixedExpenseItem>(
    `/menus/${menuId}/fixed-expenses/${expenseId}`,
    payload,
  );
  return response.data;
}

export async function deleteMenuFixedExpenseRequest(
  menuId: number | string,
  expenseId: number | string,
): Promise<void> {
  await api.delete(`/menus/${menuId}/fixed-expenses/${expenseId}`);
}

export async function listBranchFixedExpensesRequest(
  branchId: number | string,
): Promise<BranchFixedExpenseItem[]> {
  const response = await api.get<BranchFixedExpenseItem[]>(`/branches/${branchId}/fixed-expenses`);
  return Array.isArray(response.data) ? response.data : [];
}

export async function createBranchFixedExpenseRequest(
  branchId: number | string,
  payload: { title: string; amount: number; period: FixedExpensePeriod; active?: boolean },
): Promise<BranchFixedExpenseItem> {
  const response = await api.post<BranchFixedExpenseItem>(
    `/branches/${branchId}/fixed-expenses`,
    payload,
  );
  return response.data;
}

export async function deleteBranchFixedExpenseRequest(
  branchId: number | string,
  expenseId: number | string,
): Promise<void> {
  await api.delete(`/branches/${branchId}/fixed-expenses/${expenseId}`);
}

export async function getMenuRevenueReportRequest(
  menuId: number | string,
  from: string,
  to: string,
): Promise<MenuRevenueReportResponse> {
  const response = await api.get<MenuRevenueReportResponse>(
    `/analytics/menu/${menuId}/revenue`,
    { params: { from, to } },
  );
  return response.data;
}

export interface MenuWaiterPerformanceKpis {
  activeWaiterCount?: number;
  assignedOrderCount?: number;
  unassignedOrderCount?: number;
  totalRevenue?: number | string | null;
  itemCount?: number;
  totalCommission?: number | string | null;
  totalTip?: number | string | null;
  billsClosedCount?: number;
  currency?: string | null;
}

export interface MenuWaiterPerformanceProductRow {
  productId: number;
  name: string;
  quantity: number;
  revenue?: number | string | null;
}

export interface MenuWaiterPerformanceRow {
  waiterId?: number | null;
  staffId?: number | null;
  displayName: string;
  orderCount?: number;
  itemCount?: number;
  revenue?: number | string | null;
  tipAmount?: number | string | null;
  commissionAmount?: number | string | null;
  billsClosedCount?: number;
  avgOrderValue?: number | string | null;
  revenueSharePercent?: number;
  orderSharePercent?: number;
  itemSharePercent?: number;
  active?: boolean;
  topProducts?: MenuWaiterPerformanceProductRow[];
}

export interface MenuWaiterPerformanceReportResponse {
  menuId?: number | null;
  menuName?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  from: string;
  to: string;
  kpis: MenuWaiterPerformanceKpis;
  waiters: MenuWaiterPerformanceRow[];
  daily?: { date: string; revenue?: number | string | null; orderCount?: number }[];
  hourly?: { hour: number; revenue?: number | string | null; orderCount?: number }[];
  products?: MenuWaiterPerformanceProductRow[];
}

export async function getMenuWaiterPerformanceReportRequest(
  menuId: number | string,
  from: string,
  to: string,
): Promise<MenuWaiterPerformanceReportResponse> {
  const response = await api.get<MenuWaiterPerformanceReportResponse>(
    `/analytics/menu/${menuId}/waiter-performance`,
    { params: { from, to } },
  );
  return response.data;
}

function branchReportParams(from: string, to: string, menuId?: number | null) {
  return {
    from,
    to,
    ...(menuId != null ? { menuId } : {}),
  };
}

export async function getBranchAnalyticsReportRequest(
  branchId: number | string,
  from: string,
  to: string,
  menuId?: number | null,
): Promise<MenuAnalyticsReportResponse> {
  const response = await api.get<MenuAnalyticsReportResponse>(
    `/analytics/branch/${branchId}/report`,
    { params: branchReportParams(from, to, menuId) },
  );
  return response.data;
}

export async function getBranchRevenueReportRequest(
  branchId: number | string,
  from: string,
  to: string,
  menuId?: number | null,
): Promise<MenuRevenueReportResponse> {
  const response = await api.get<MenuRevenueReportResponse>(
    `/analytics/branch/${branchId}/revenue`,
    { params: branchReportParams(from, to, menuId) },
  );
  return response.data;
}

export async function getBranchWaiterPerformanceReportRequest(
  branchId: number | string,
  from: string,
  to: string,
  menuId?: number | null,
): Promise<MenuWaiterPerformanceReportResponse> {
  const response = await api.get<MenuWaiterPerformanceReportResponse>(
    `/analytics/branch/${branchId}/waiter-performance`,
    { params: branchReportParams(from, to, menuId) },
  );
  return response.data;
}

export interface AnalyticsCoverage {
  kitchenMetrics: boolean;
  discounts: boolean;
  shifts: boolean;
  cartToOrderFunnel: boolean;
  coversPerTable: boolean;
}

export interface AnalyticsPeriod {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
}

export interface SummaryOverview {
  grossRevenue?: number | string | null;
  netRevenue?: number | string | null;
  tipTotal?: number | string | null;
  orderCount?: number;
  completedOrderCount?: number;
  cancelledOrderCount?: number;
  avgBasket?: number | string | null;
  activeOpenTables?: number;
  occupancyRatio?: number | null;
  cancelRate?: number;
  revenueVsPreviousPct?: number | null;
  currency?: string | null;
}

export interface SummaryAnalyticsResponse {
  menuId?: number | null;
  menuName?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  period: AnalyticsPeriod;
  overview: SummaryOverview;
  salesTeaser: {
    hourlyRevenue: { hour: number; revenue?: number | string | null; orderCount?: number }[];
    topProducts: MenuRevenueProductRow[];
    categoryShare: {
      categoryId?: number | null;
      name: string;
      quantity: number;
      revenue?: number | string | null;
    }[];
  };
  staffTeaser: {
    topWaitersByRevenue: MenuWaiterPerformanceRow[];
    unassignedRevenueShare?: number | null;
  };
  operationsTeaser: {
    openBills: number;
    confirmedOrders: number;
  };
  tablesTeaser: {
    topTablesByRevenue: TableAnalyticsRow[];
    avgTurnMinutes?: number | null;
  };
  qrTeaser: {
    sessions: number;
    menuOpens: number;
    productViews: number;
    browseFunnel: { menuOpens: number; categoryViews: number; productViews: number };
  };
  coverage: AnalyticsCoverage;
}

export interface TableAnalyticsRow {
  tableId: number;
  tableName: string;
  revenue?: number | string | null;
  orderCount?: number;
  billCount?: number;
  avgCheck?: number | string | null;
  avgDwellMinutes?: number | null;
  closedBills?: number;
  qrOrderCount?: number;
  staffOrderCount?: number;
  capacity?: number | null;
  coverCountTotal?: number | null;
  revenuePerCover?: number | string | null;
}

export interface ProductCoPurchase {
  productId: number;
  name: string;
  billCount: number;
  companions: {
    productId: number;
    name: string;
    togetherCount: number;
    sharePercent: number;
  }[];
}

export interface FullAnalyticsResponse {
  menuId?: number | null;
  menuName?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  period: AnalyticsPeriod;
  coverage: AnalyticsCoverage;
  dashboard: {
    overview: SummaryOverview;
    daily: { date: string; revenue?: number | string | null; orderCount?: number }[];
    hourly: { hour: number; revenue?: number | string | null; orderCount?: number }[];
    previousPeriod: AnalyticsPeriod;
    previousGrossRevenue?: number | string | null;
  };
  orders: {
    countsByStatus: { status: string; count: number }[];
    hourly: { hour: number; orderCount: number }[];
    daily: { date: string; orderCount: number }[];
    avgItemsPerOrder: number;
    cancelRate: number;
    aov?: number | string | null;
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
  };
  staff: {
    kpis: MenuWaiterPerformanceKpis;
    rows: MenuWaiterPerformanceRow[];
    ranking: {
      staffId?: number | null;
      waiterId?: number | null;
      displayName: string;
      revenue?: number | string | null;
      orderCount?: number;
      rank: number;
    }[];
    hourly: { hour: number; revenue?: number | string | null; orderCount?: number }[];
    products: MenuWaiterPerformanceProductRow[];
  };
  products: {
    top: MenuRevenueProductRow[];
    bottom: MenuRevenueProductRow[];
    byCategory: {
      categoryId?: number | null;
      name: string;
      quantity: number;
      revenue?: number | string | null;
    }[];
    hourly: { hour: number; revenue?: number | string | null; orderCount?: number }[];
    coPurchase: ProductCoPurchase[];
    unsold?: {
      count?: number;
      products?: { productId: number; name: string }[];
    } | null;
  };
  tables: {
    perTable: TableAnalyticsRow[];
    avgDwellMinutes?: number | null;
    turnRate?: number | null;
    qrOrderCount?: number;
    staffOrderCount?: number;
    qrOrderSharePercent?: number | null;
    occupancyRatio?: number | null;
    avgRevenuePerCover?: number | string | null;
  };
  qr: {
    kpis: MenuAnalyticsReportKpis;
    funnel: {
      menuOpens: number;
      categoryViews: number;
      productViews: number;
      addToCart?: number;
      checkoutStarts?: number;
      orderSubmitted?: number;
    };
    devices: { name: string; value: number }[];
    topViewed: { productId: number; name: string; views: number }[];
    journeys: {
      sessionId: string;
      startedAt: string;
      steps: { type: string; name: string; at: string }[];
    }[];
  };
  finance: {
    grossRevenue?: number | string | null;
    tipRevenue?: number | string | null;
    cashRevenue?: number | string | null;
    cardRevenue?: number | string | null;
    fixedExpenses?: number | string | null;
    netRevenue?: number | string | null;
    orderTotalAmount?: number | string | null;
    collectedAmount?: number | string | null;
    discountTotal?: number | string | null;
    refundTotal?: number | string | null;
    voidTotal?: number | string | null;
    channels?: RevenueChannelShare[];
    paymentBreakdown?: MenuRevenuePaymentBreakdown | null;
    currency?: string | null;
  };
  cancellations: {
    byStatus: { status: string; count: number }[];
    byWaiter: {
      staffId?: number | null;
      waiterId?: number | null;
      displayName: string;
      cancelCount: number;
    }[];
    totalCancelled: number;
    totalRejected: number;
  };
  kitchen?: {
    kpis: {
      avgConfirmToPrepareMinutes?: number | null;
      avgPrepareToReadyMinutes?: number | null;
      avgReadyToServeMinutes?: number | null;
      avgConfirmToServeMinutes?: number | null;
      preparingCount: number;
      readyCount: number;
      servedCount: number;
      delayedCount: number;
      delayRatePercent: number;
    };
    hourlyLoad: { hour: number; orderCount: number; avgPrepMinutes?: number | null }[];
    delayThresholdMinutes: number;
  } | null;
  shifts?: {
    shifts: {
      shiftId: number;
      openedAt: string;
      closedAt?: string | null;
      status: string;
      openingFloat?: number | string | null;
      closingCash?: number | string | null;
      revenue?: number | string | null;
      orderCount: number;
      waiterCount: number;
    }[];
    totalRevenue?: number | string | null;
    totalOrders: number;
  } | null;
  customers: {
    identifiedCustomerOrderCount: number;
    distinctIdentifiedCustomers: number;
    anonymousSessions: number;
    repeatAnonymousSessions: number;
    newAnonymousVisitors?: number;
    returningAnonymousVisitors?: number;
    identifiedOrderSharePercent?: number | null;
  };
  drillDownHints: {
    billId?: number | null;
    orderId?: number | null;
    tableId?: number | null;
    staffId?: number | null;
    waiterId?: number | null;
    productId?: number | null;
    paidAt?: string | null;
    amount?: number | string | null;
  }[];
}

export async function getBranchSummaryAnalyticsRequest(
  branchId: number | string,
  from: string,
  to: string,
  menuId?: number | null,
): Promise<SummaryAnalyticsResponse> {
  const response = await api.get<SummaryAnalyticsResponse>(
    `/analytics/branch/${branchId}/summary`,
    { params: branchReportParams(from, to, menuId) },
  );
  return response.data;
}

export async function getBranchFullAnalyticsRequest(
  branchId: number | string,
  from: string,
  to: string,
  menuId?: number | null,
): Promise<FullAnalyticsResponse> {
  const response = await api.get<FullAnalyticsResponse>(
    `/analytics/branch/${branchId}/full`,
    { params: branchReportParams(from, to, menuId) },
  );
  return response.data;
}

export type FeedbackTypeFilter = "all" | "menu" | "product";

export interface FeedbackItemApi {
  id: number;
  type: "menu" | "product" | string;
  productId?: number | null;
  productName?: string | null;
  score: number;
  comment?: string | null;
  deviceType?: string | null;
  createdAt?: string | null;
}

export interface FeedbackPageApiResponse {
  content: FeedbackItemApi[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export interface FeedbackBucketSummaryApi {
  ratingAvg?: number | string | null;
  ratingCount?: number | null;
  scoreHistogram?: Array<{ score: number; count: number }>;
}

export interface FeedbackSummaryApiResponse {
  menuId: number;
  menu: FeedbackBucketSummaryApi;
  products: FeedbackBucketSummaryApi;
}

export async function getMenuFeedbackRequest(
  menuId: number | string,
  params?: {
    type?: FeedbackTypeFilter;
    from?: string;
    to?: string;
    minScore?: number;
    page?: number;
    size?: number;
  },
): Promise<FeedbackPageApiResponse> {
  const response = await api.get<FeedbackPageApiResponse>(`/menu/${menuId}/feedback`, {
    params,
  });
  return response.data;
}

export async function getMenuFeedbackSummaryRequest(
  menuId: number | string,
): Promise<FeedbackSummaryApiResponse> {
  const response = await api.get<FeedbackSummaryApiResponse>(`/menu/${menuId}/feedback/summary`);
  return response.data;
}

export type MenuReservationStatus = "PENDING" | "ACTIVE" | "CANCELED";

export interface MenuReservationApiItem {
  id: number;
  menuId: number;
  customerName: string;
  phone?: string | null;
  email?: string | null;
  partySize: number;
  reservationAt: string;
  status: MenuReservationStatus;
  note?: string | null;
  deviceType?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface MenuReservationCreateBody {
  customerName: string;
  phone?: string;
  email?: string;
  partySize: number;
  reservationAt: string;
  note?: string;
}

export interface MenuReservationUpdateBody {
  status?: MenuReservationStatus;
  reservationAt?: string;
}

export interface MenuReservationPageApiResponse {
  content: MenuReservationApiItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export async function createPublicReservationRequest(
  menuId: number | string,
  payload: MenuReservationCreateBody,
): Promise<MenuReservationApiItem> {
  const response = await fetch(
    `/api/menu/public/${encodeURIComponent(String(menuId))}/reservations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    let message = "Rezervasyon oluşturulamadı";
    try {
      const data = (await response.json()) as { message?: string };
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<MenuReservationApiItem>;
}

export async function getMenuReservationsRequest(
  menuId: number | string,
  params?: {
    status?: MenuReservationStatus | "all";
    from?: string;
    to?: string;
    q?: string;
    page?: number;
    size?: number;
  },
): Promise<MenuReservationPageApiResponse> {
  const response = await api.get<MenuReservationPageApiResponse>(`/menu/${menuId}/reservations`, {
    params,
  });
  return response.data;
}

export async function updateMenuReservationRequest(
  menuId: number | string,
  reservationId: number | string,
  payload: MenuReservationUpdateBody,
): Promise<MenuReservationApiItem> {
  const response = await api.patch<MenuReservationApiItem>(
    `/menu/${menuId}/reservations/${reservationId}`,
    payload,
  );
  return response.data;
}

export type PlatformFeedbackStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export type PlatformFeedbackSubject =
  | "Teknik sorun"
  | "Abonelik / Ödeme"
  | "Dijital menü"
  | "Garson paneli"
  | "Öneri"
  | "Diğer";

export const PLATFORM_FEEDBACK_SUBJECTS: PlatformFeedbackSubject[] = [
  "Teknik sorun",
  "Abonelik / Ödeme",
  "Dijital menü",
  "Garson paneli",
  "Öneri",
  "Diğer",
];

export interface PlatformFeedbackItemApi {
  id: number;
  userId: number;
  userEmail: string | null;
  userFullName: string | null;
  title: string;
  subject: string;
  description: string;
  screenshotUrl: string | null;
  status: PlatformFeedbackStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformFeedbackPageApiResponse {
  content: PlatformFeedbackItemApi[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export interface PlatformFeedbackCreateBody {
  title: string;
  subject: PlatformFeedbackSubject;
  description: string;
  screenshotUrl?: string;
  screenshotKey?: string;
}

export async function createPlatformFeedbackRequest(
  payload: PlatformFeedbackCreateBody,
): Promise<PlatformFeedbackItemApi> {
  const response = await api.post<PlatformFeedbackItemApi>("/platform-feedback", payload);
  return response.data;
}

export async function getMyPlatformFeedbackRequest(
  params?: { page?: number; size?: number },
): Promise<PlatformFeedbackPageApiResponse> {
  const response = await api.get<PlatformFeedbackPageApiResponse>("/platform-feedback/my", {
    params,
  });
  return response.data;
}

export type AccountingEntryType = "GELIR" | "GIDER" | "BORC";
export type AccountingSourceType = "MANUAL" | "BILL_SALE" | "BILL_TIP" | "ORDER_SALE";

export interface AccountingEntryApiItem {
  id: number;
  entryType: AccountingEntryType;
  title: string;
  amount: number | string;
  currency: string;
  occurredAt: string;
  note?: string | null;
  menuId?: number | null;
  menuName?: string | null;
  sourceType: AccountingSourceType;
  sourceBillId?: number | null;
  sourceOrderId?: number | null;
  createdByWaiterId?: number | null;
  createdAt: string;
}

export interface AccountingSummaryTotals {
  totalGelir: number | string;
  totalGider: number | string;
  totalBorc: number | string;
  currency: string;
}

export interface AccountingEntryPageApiResponse {
  content: AccountingEntryApiItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  summary: AccountingSummaryTotals;
}

export interface AccountingEntryCreateBody {
  entryType: AccountingEntryType;
  title: string;
  amount: number;
  occurredAt: string;
  note?: string;
  menuId?: number;
}

export async function listAccountingEntriesRequest(params?: {
  type?: AccountingEntryType | "all";
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}): Promise<AccountingEntryPageApiResponse> {
  const response = await api.get<AccountingEntryPageApiResponse>("/accounting/entries", {
    params,
  });
  return response.data;
}

export async function createAccountingEntryRequest(
  payload: AccountingEntryCreateBody,
): Promise<AccountingEntryApiItem> {
  const response = await api.post<AccountingEntryApiItem>("/accounting/entries", payload);
  return response.data;
}

export async function deleteAccountingEntryRequest(entryId: number | string): Promise<void> {
  await api.delete(`/accounting/entries/${entryId}`);
}

export interface AccountingEntryDetailLineItem {
  id: number;
  productName: string;
  unitPrice: number | string;
  quantity: number;
  lineTotal: number | string;
  note?: string | null;
  sourceOrderId?: number | null;
}

export interface AccountingEntryDetailApiResponse {
  entryId: number;
  sourceType: AccountingSourceType;
  sourceBillId?: number | null;
  sourceOrderId?: number | null;
  title: string;
  amount: number | string;
  currency: string;
  items: AccountingEntryDetailLineItem[];
}

export async function getAccountingEntryDetailRequest(
  entryId: number | string,
): Promise<AccountingEntryDetailApiResponse> {
  const response = await api.get<AccountingEntryDetailApiResponse>(
    `/accounting/entries/${entryId}/detail`,
  );
  return response.data;
}
