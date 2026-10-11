export function publicMenuPath(identifier: number | string) {
  return `/menu/${identifier}/content`;
}

export function publicMenuContentPath(identifier: number | string) {
  return `/menu/${identifier}/content`;
}

export type PublicMenuContentQuery = {
  categoryId?: number;
  subCategoryId?: number;
  productId?: number;
  tableToken?: string;
};

export function buildPublicMenuContentPath(
  identifier: number | string,
  query: PublicMenuContentQuery = {},
): string {
  const params = new URLSearchParams();
  if (query.tableToken) params.set("t", query.tableToken);
  if (query.productId != null) params.set("productId", String(query.productId));
  if (query.categoryId != null) params.set("categoryId", String(query.categoryId));
  if (query.subCategoryId != null) params.set("subCategoryId", String(query.subCategoryId));
  const qs = params.toString();
  return qs ? `${publicMenuContentPath(identifier)}?${qs}` : publicMenuContentPath(identifier);
}

export type PublicMenuLandingPanel = "landing" | "reservation" | "feedback" | "contact";

export function parsePublicMenuPanel(value: string | null | undefined): PublicMenuLandingPanel {
  if (value === "reservation" || value === "feedback" || value === "contact") {
    return value;
  }
  return "landing";
}
