import { api } from "@/lib/api/client";

export type BranchMenuSummary = {
  menuId: number;
  qrId: number;
  publicId?: string | null;
  businessName: string;
  active: boolean;
};

export type BranchItem = {
  id: number;
  userId: number;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  grandfathered: boolean;
  active: boolean;
  kitchenEnabled?: boolean;
  courierEnabled?: boolean;
  printKitchenEnabled?: boolean;
  menus: BranchMenuSummary[];
};

export type BranchQuota = {
  used: number;
  allowed: number;
  remaining: number;
  grandfathered: number;
  extraPurchased: number;
  canCreate: boolean;
};

export type BranchMenuQuota = {
  extraUsed: number;
  extraAllowed: number;
  extraRemaining: number;
  canCreateExtra: boolean;
};

export type BranchListResponse = {
  content: BranchItem[];
  quota: BranchQuota;
  menuQuota: BranchMenuQuota;
};

export type BranchWritePayload = {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  active?: boolean;
  kitchenEnabled?: boolean;
  courierEnabled?: boolean;
  printKitchenEnabled?: boolean;
};

export async function listBranchesRequest() {
  const { data } = await api.get<BranchListResponse>("/branches");
  return data;
}

export async function createBranchRequest(payload: BranchWritePayload) {
  const { data } = await api.post<BranchItem>("/features/QR_BRANCH/branches", payload);
  return data;
}

export async function getBranchRequest(branchId: number) {
  const { data } = await api.get<BranchItem>(`/branches/${branchId}`);
  return data;
}

export async function updateBranchRequest(branchId: number, payload: BranchWritePayload) {
  const { data } = await api.put<BranchItem>(`/branches/${branchId}`, payload);
  return data;
}

export async function enableBranchKitchenRequest(branchId: number) {
  const { data } = await api.post<BranchItem>(`/branches/${branchId}/kitchen`);
  return data;
}

export async function deleteBranchRequest(branchId: number) {
  await api.delete(`/branches/${branchId}`);
}

export async function uploadBranchPhotoRequest(branchId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<BranchItem>(`/branches/${branchId}/photo`, form, {
    headers: { "Content-Type": undefined },
    timeout: 60_000,
  });
  return data;
}

export async function deleteBranchPhotoRequest(branchId: number) {
  const { data } = await api.delete<BranchItem>(`/branches/${branchId}/photo`);
  return data;
}

export async function applyBranchPhotoToAllBranchesRequest(branchId: number) {
  const { data } = await api.post<BranchListResponse>(`/branches/${branchId}/photo/apply-all-branches`);
  return data;
}

export async function applyBranchPhotoToAllMenusRequest(branchId: number) {
  const { data } = await api.post<BranchListResponse>(`/branches/${branchId}/photo/apply-all-menus`);
  return data;
}

export type PurchasedBranchUsage = {
  purchased: number;
  used: number;
  remaining: number;
};

export function packageIncludedBranchSlots(quota: BranchQuota): number {
  return Math.max(0, quota.allowed - quota.extraPurchased);
}

export function summarizePurchasedBranchUsage(quota: BranchQuota): PurchasedBranchUsage {
  const purchased = Math.max(0, quota.extraPurchased);
  const used = Math.max(0, quota.used - packageIncludedBranchSlots(quota));
  return {
    purchased,
    used,
    remaining: Math.max(0, purchased - used),
  };
}

export function formatBranchQuotaSubtitle(quota: BranchQuota): string {
  if (quota.extraPurchased > 0) {
    return "Satın alınan şube hakkı";
  }
  return `Paket dahil ${packageIncludedBranchSlots(quota)} şube`;
}

export function formatBranchQuotaUsageFraction(quota: BranchQuota): string {
  if (quota.extraPurchased > 0) {
    const purchased = summarizePurchasedBranchUsage(quota);
    return `${purchased.remaining}/${purchased.purchased}`;
  }
  return `${quota.remaining}/${quota.allowed}`;
}

export function formatBranchQuota(quota: BranchQuota | null | undefined) {
  if (!quota) return null;
  if (quota.remaining <= 0) return "Şube hakkınız doldu. Ek şube ücretlidir.";
  if (quota.remaining === 1) return "1 şube hakkınız kaldı";
  return `${quota.remaining} şube hakkınız kaldı`;
}

export function formatBranchCreateQuota(quota: BranchQuota | null | undefined) {
  if (!quota) return null;
  if (quota.remaining <= 0) return "Şube ekleme hakkınız bitti. Satın alın.";
  return `Şube oluşturma hakkınız: ${quota.remaining}/${quota.allowed}`;
}

export function formatBranchMenuQuota(quota: BranchMenuQuota | null | undefined) {
  if (!quota) return null;
  if (quota.extraRemaining <= 0) return "Ek menü hakkınız yok. Her şubenin ilk menüsü ücretsizdir.";
  if (quota.extraRemaining === 1) return "1 ek menü hakkınız kaldı";
  return `${quota.extraRemaining} ek menü hakkınız kaldı`;
}

export function branchAllowsFirstMenu(branch: BranchItem) {
  return branch.menus.filter((menu) => menu.active).length === 0;
}

export function canCreateMenuOnBranch(
  branch: BranchItem,
  menuQuota: BranchMenuQuota | null | undefined,
) {
  if (branchAllowsFirstMenu(branch)) return true;
  return Boolean(menuQuota?.canCreateExtra);
}

export function isBranchKitchenEnabled(branch?: Pick<BranchItem, "kitchenEnabled"> | null) {
  return Boolean(branch?.kitchenEnabled);
}

export function isBranchCourierEnabled(branch?: Pick<BranchItem, "courierEnabled"> | null) {
  return Boolean(branch?.courierEnabled);
}

export function isBranchPrintKitchenEnabled(branch?: Pick<BranchItem, "printKitchenEnabled"> | null) {
  return Boolean(branch?.printKitchenEnabled);
}

export function formatBranchCode(branchId: number) {
  return `#${branchId}`;
}

export function formatBranchCodeLabel(branch: Pick<BranchItem, "id" | "name">) {
  return `${formatBranchCode(branch.id)} · ${branch.name}`;
}

export function formatBranchListLabel(branch: Pick<BranchItem, "id" | "name">) {
  return `${branch.name} · ${formatBranchCode(branch.id)}`;
}

function branchRows<T>(branches: T[] | { content?: T[] | null } | null | undefined): T[] {
  if (Array.isArray(branches)) return branches;
  if (branches && Array.isArray(branches.content)) return branches.content;
  return [];
}

export function anyBranchHasKitchen(
  branches: Array<Pick<BranchItem, "kitchenEnabled">> | { content?: Array<Pick<BranchItem, "kitchenEnabled">> | null } | null | undefined,
) {
  return branchRows(branches).some((branch) => isBranchKitchenEnabled(branch));
}

export function anyBranchHasCourier(
  branches: Array<Pick<BranchItem, "courierEnabled">> | { content?: Array<Pick<BranchItem, "courierEnabled">> | null } | null | undefined,
) {
  return branchRows(branches).some((branch) => isBranchCourierEnabled(branch));
}
