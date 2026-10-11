export type ProductAccessEntitlement = {
  productCode: string;
  purchaseId: number;
  usable: boolean;
  expired: boolean;
  startsAt?: string | null;
  expiresAt?: string | null;
  purchaseStatus?: string | null;
};

export type ProductAccessPurchase = {
  id: number;
  usable: boolean;
  expired: boolean;
  expiresAt?: string | null;
  purchaseType?: string | null;
  packageCode?: string | null;
  status?: string | null;
};

export function isActivePaidPurchase(purchase: ProductAccessPurchase | null | undefined): boolean {
  if (!purchase || !isDateUsablePurchase(purchase)) {
    return false;
  }
  if (purchase.purchaseType !== "PAID") {
    return false;
  }
  return purchase.packageCode !== "FREE_PACKAGE";
}

export function isDateUsablePurchase(purchase: ProductAccessPurchase): boolean {
  if (purchase.expired) {
    return false;
  }
  if (purchase.status === "EXPIRED" || purchase.status === "CANCELLED" || purchase.status === "FAILED") {
    return false;
  }
  if (purchase.usable) {
    if (!purchase.expiresAt) {
      return true;
    }
    const ms = new Date(purchase.expiresAt).getTime();
    if (!Number.isFinite(ms)) {
      return true;
    }
    return ms > Date.now();
  }
  return false;
}

export function pickActivePurchase<T extends ProductAccessPurchase>(purchases: T[]): T | null {
  const usable = purchases.filter((purchase) => isDateUsablePurchase(purchase));
  const pool =
    usable.length > 0
      ? usable
      : purchases.filter(
          (purchase) =>
            purchase.usable &&
            !purchase.expired &&
            purchase.status !== "EXPIRED" &&
            purchase.status !== "CANCELLED",
        );
  if (pool.length === 0) return null;

  const rank = (purchase: ProductAccessPurchase) => {
    if (purchase.purchaseType === "ADD_ON") return -1;
    if (purchase.purchaseType === "PAID") return 3;
    if (purchase.purchaseType === "TRIAL") return 2;
    if (purchase.packageCode && purchase.packageCode !== "FREE_PACKAGE") return 1;
    return 0;
  };

  return [...pool].sort((left, right) => rank(right) - rank(left))[0] ?? null;
}

export function isDateUsableEntitlement(
  entitlement: ProductAccessEntitlement,
  purchase?: ProductAccessPurchase | null,
): boolean {
  if (!entitlement.usable || entitlement.expired) {
    return false;
  }
  if (
    entitlement.purchaseStatus === "EXPIRED" ||
    entitlement.purchaseStatus === "CANCELLED" ||
    entitlement.purchaseStatus === "FAILED"
  ) {
    return false;
  }
  if (purchase?.expired) {
    return false;
  }
  if (purchase?.status === "EXPIRED" || purchase?.status === "CANCELLED" || purchase?.status === "FAILED") {
    return false;
  }
  return true;
}

const PRODUCT_CODE_ALIASES: Record<string, readonly string[]> = {
  QR_CREATE: ["QR_CREATE"],
  QR_MENU: ["QR_MENU"],
  QR_AGENT: ["QR_AGENT", "SMART_ASSISTANT"],
  QR_ANALYTICS: ["QR_ANALYTICS", "SMART_REPORTING"],
  SMART_ASSISTANT: ["SMART_ASSISTANT", "QR_AGENT"],
  SMART_REPORTING: ["SMART_REPORTING", "QR_ANALYTICS"],
  SMART_SUMMARY: ["SMART_SUMMARY"],
  AI_MENU_IMPORT: ["AI_MENU_IMPORT"],
};

export function matchesProductCode(actual: string, expected: string): boolean {
  const aliases = PRODUCT_CODE_ALIASES[expected] ?? [expected];
  return aliases.includes(actual);
}

export type PackageWithItems = {
  id?: number;
  code?: string;
  items?: { productCode: string }[];
};

export function findPackageForPurchase(
  packages: PackageWithItems[],
  purchase: { packageId?: number | null; packageCode?: string | null } | null,
): PackageWithItems | null {
  if (!purchase) return null;
  return (
    packages.find((pkg) => purchase.packageId != null && pkg.id === purchase.packageId) ??
    packages.find((pkg) => !!purchase.packageCode && pkg.code === purchase.packageCode) ??
    null
  );
}

export function packageIncludesProduct(
  pkg: PackageWithItems | null | undefined,
  productCode: string,
): boolean {
  return !!pkg?.items?.some((item) => matchesProductCode(item.productCode, productCode));
}

export function hasActivePackageProduct(
  purchase: ProductAccessPurchase | null,
  packages: PackageWithItems[],
  productCode: string,
): boolean {
  if (!purchase || !isDateUsablePurchase(purchase)) return false;
  return packageIncludesProduct(findPackageForPurchase(packages, purchase), productCode);
}

export function hasActiveProductAccess(
  entitlements: ProductAccessEntitlement[],
  purchases: ProductAccessPurchase[],
  productCode: string,
): boolean {
  const purchasesById = new Map(
    purchases.map((purchase) => [Number(purchase.id), purchase] as const),
  );
  return entitlements.some((entitlement) => {
    if (!matchesProductCode(entitlement.productCode, productCode)) return false;
    const purchase = purchasesById.get(Number(entitlement.purchaseId)) ?? null;
    return isDateUsableEntitlement(entitlement, purchase);
  });
}

export function hasExpiredProductAccess(
  entitlements: ProductAccessEntitlement[],
  purchases: ProductAccessPurchase[],
  productCode: string,
): boolean {
  if (hasActiveProductAccess(entitlements, purchases, productCode)) {
    return false;
  }
  const purchasesById = new Map(
    purchases.map((purchase) => [Number(purchase.id), purchase] as const),
  );
  return entitlements.some((entitlement) => {
    if (!matchesProductCode(entitlement.productCode, productCode)) return false;
    const purchase = purchasesById.get(Number(entitlement.purchaseId));
    if (entitlement.expired) return true;
    if (purchase?.expired) return true;
    if (purchase && !isDateUsablePurchase(purchase)) return true;
    return (
      entitlement.purchaseStatus === "EXPIRED" ||
      entitlement.purchaseStatus === "CANCELLED" ||
      entitlement.purchaseStatus === "FAILED"
    );
  });
}
