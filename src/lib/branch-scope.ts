import type { BranchItem } from "@/lib/branch";
import { flattenBranchMenus, type DigitalMenuDirectoryItem } from "@/lib/digital-menu-directory";
import { listMerchantKitchenQueue, listMerchantOrders, type OrderResponse } from "@/lib/ordering-api";

export type BranchScope = "all" | number;

export function parseBranchScope(value: string | null | undefined): BranchScope {
  if (!value || value === "all") return "all";
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : "all";
}

export function menusInBranchScope(branches: BranchItem[], scope: BranchScope): DigitalMenuDirectoryItem[] {
  const menus = flattenBranchMenus(branches).filter((menu) => menu.active);
  if (scope === "all") return menus;
  return menus.filter((menu) => menu.branchId === scope);
}

export function stampMenuOrder(
  order: OrderResponse,
  menu: Pick<DigitalMenuDirectoryItem, "branchId" | "menuId">,
): OrderResponse {
  return {
    ...order,
    menuId: order.menuId ?? menu.menuId,
    branchId: menu.branchId,
  };
}

export function ordersForStaffBranch<T extends { branchId?: number | null }>(
  orders: T[],
  branchId: number,
): T[] {
  return orders.filter((order) => order.branchId == null || order.branchId === branchId);
}

export async function listScopedMenuOrders(menus: DigitalMenuDirectoryItem[]): Promise<OrderResponse[]> {
  const batches = await Promise.all(
    menus.map(async (menu) => {
      const orders = await listMerchantOrders(menu.menuId, "ALL");
      return orders.map((order) => stampMenuOrder(order, menu));
    }),
  );
  return batches.flat();
}

export async function listScopedKitchenOrders(menus: DigitalMenuDirectoryItem[]): Promise<OrderResponse[]> {
  const batches = await Promise.all(
    menus.map(async (menu) => {
      const orders = await listMerchantKitchenQueue(menu.menuId);
      return orders.map((order) => stampMenuOrder(order, menu));
    }),
  );
  return batches.flat();
}
