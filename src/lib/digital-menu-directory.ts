import type { BranchItem } from "@/lib/branch";

export type DigitalMenuDirectoryItem = {
  menuId: number;
  qrId: number;
  publicId?: string | null;
  businessName: string;
  branchId: number | null;
  branchName: string;
  active: boolean;
};

export type MenuDirectoryStatusFilter = "all" | "active" | "inactive";

export type MenuDirectoryFilters = {
  query: string;
  status: MenuDirectoryStatusFilter;
  branchId: number | "all";
};

export const DEFAULT_MENU_DIRECTORY_FILTERS: MenuDirectoryFilters = {
  query: "",
  status: "all",
  branchId: "all",
};

export function withUnassignedMenus(
  branches: BranchItem[],
  activeMenus: Array<{
    menuId: number;
    qrId: number;
    branchId?: number | null;
    businessName?: string | null;
    active: boolean;
    publicId?: string | null;
  }>,
): DigitalMenuDirectoryItem[] {
  const fromBranches = flattenBranchMenus(branches);
  const seen = new Set(fromBranches.map((menu) => menu.menuId));
  const branchNameById = new Map(branches.map((branch) => [branch.id, branch.name]));
  const extras = activeMenus
    .filter((menu) => !seen.has(menu.menuId))
    .map((menu) => ({
      menuId: menu.menuId,
      qrId: menu.qrId,
      publicId: menu.publicId,
      businessName: menu.businessName?.trim() || `Menü #${menu.qrId}`,
      branchId: menu.branchId ?? null,
      branchName:
        menu.branchId != null
          ? branchNameById.get(menu.branchId) ?? "Şube"
          : "Şube atanmadı",
      active: menu.active,
    }));
  return [...fromBranches, ...extras];
}

export function flattenBranchMenus(branches: BranchItem[]): DigitalMenuDirectoryItem[] {
  return branches.flatMap((branch) =>
    branch.menus.map((menu) => ({
      menuId: menu.menuId,
      qrId: menu.qrId,
      publicId: menu.publicId,
      businessName: menu.businessName?.trim() || `Menü #${menu.qrId}`,
      branchId: branch.id,
      branchName: branch.name,
      active: menu.active,
    })),
  );
}

export function filterMenuDirectory(
  items: DigitalMenuDirectoryItem[],
  filters: MenuDirectoryFilters,
): DigitalMenuDirectoryItem[] {
  const query = filters.query.trim().toLocaleLowerCase("tr-TR");

  return items.filter((item) => {
    if (filters.status === "active" && !item.active) {
      return false;
    }
    if (filters.status === "inactive" && item.active) {
      return false;
    }
    if (filters.branchId !== "all" && item.branchId !== filters.branchId) {
      return false;
    }
    if (!query) {
      return true;
    }
    const haystack = `${item.businessName} ${item.branchName}`.toLocaleLowerCase("tr-TR");
    return haystack.includes(query);
  });
}

export function sortMenuDirectory(items: DigitalMenuDirectoryItem[]): DigitalMenuDirectoryItem[] {
  return [...items].sort((a, b) => {
    const branchCompare = a.branchName.localeCompare(b.branchName, "tr-TR");
    if (branchCompare !== 0) {
      return branchCompare;
    }
    return a.businessName.localeCompare(b.businessName, "tr-TR");
  });
}

export function sortMenuDirectoryByMenuName(items: DigitalMenuDirectoryItem[]): DigitalMenuDirectoryItem[] {
  return [...items].sort((a, b) => {
    const nameCompare = a.businessName.localeCompare(b.businessName, "tr-TR");
    if (nameCompare !== 0) {
      return nameCompare;
    }
    return a.branchName.localeCompare(b.branchName, "tr-TR");
  });
}
