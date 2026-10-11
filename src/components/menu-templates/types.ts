import type { MenuVisitAnalytics } from "@/hooks/use-menu-visit-analytics";
import type {
  MainCategoryApiItem,
  MenuProductApiItem,
  MenuProfileApiItem,
  SubCategoryApiItem,
} from "@/lib/api";

export type MenuTemplateProps = {
  menu: MenuProfileApiItem;
  products: MenuProductApiItem[];
  categories?: MainCategoryApiItem[];
  analytics?: MenuVisitAnalytics;
};

export type MenuTemplateRendererProps = MenuTemplateProps & {
  themeId: string;
  /** Public menu QR identifier (path segment /menu/[identifier]). */
  identifier?: string;
  productPage?: number;
  productSize?: number;
  productTotalElements?: number;
  productHasNext?: boolean;
  categoryPage?: number;
  categorySize?: number;
  categoryTotalElements?: number;
  categoryHasNext?: boolean;
};

export type MenuNavCategory = {
  key: string;
  mainCategoryId: number | null;
  subCategoryId: number | null;
  name: string;
  depth: number;
};

export function flattenTaxonomyNav(categories: MainCategoryApiItem[] = []): MenuNavCategory[] {
  return categories.flatMap((main) => [
    {
      key: `main-${main.id}`,
      mainCategoryId: main.id,
      subCategoryId: null,
      name: main.name,
      depth: 0,
    },
    ...(main.subs ?? []).map((sub) => ({
      key: `sub-${sub.id}`,
      mainCategoryId: main.id,
      subCategoryId: sub.id,
      name: sub.name,
      depth: 1,
    })),
  ]);
}

export function resolveMenuNavCategories(
  categories: MainCategoryApiItem[] | undefined,
  products: MenuProductApiItem[],
): MenuNavCategory[] {
  const fromApi = flattenTaxonomyNav(categories ?? []);
  if (fromApi.length > 0) return fromApi;

  const seen = new Set<string>();
  const fromProducts: MenuNavCategory[] = [];
  for (const product of products) {
    const name = product.subCategoryName?.trim() || product.mainCategoryName?.trim() || "Genel";
    if (seen.has(name)) continue;
    seen.add(name);
    fromProducts.push({
      key: `name-${name.toLowerCase()}`,
      mainCategoryId: product.mainCategoryId ?? null,
      subCategoryId: product.subCategoryId ?? null,
      name,
      depth: 0,
    });
  }
  return fromProducts;
}

export function filterProductsByNavCategory(
  products: MenuProductApiItem[],
  category: MenuNavCategory | null,
): MenuProductApiItem[] {
  if (!category) return products;
  if (category.subCategoryId != null) {
    return products.filter((product) => product.subCategoryId === category.subCategoryId);
  }
  if (category.mainCategoryId != null) {
    return products.filter((product) => product.mainCategoryId === category.mainCategoryId);
  }
  return products;
}

export function findSubCategory(
  categories: MainCategoryApiItem[],
  subCategoryId: number,
): SubCategoryApiItem | null {
  for (const main of categories) {
    const found = (main.subs ?? []).find((sub) => sub.id === subCategoryId);
    if (found) return found;
  }
  return null;
}

export function findMainCategory(
  categories: MainCategoryApiItem[],
  mainCategoryId: number,
): MainCategoryApiItem | null {
  return categories.find((main) => main.id === mainCategoryId) ?? null;
}

const MAIN_NAV_OFFSET = 1_000_000;

export type TaxonomyNavNode = {
  categoryId: number;
  name: string;
  parentId: number | null;
  sortOrder: number;
  kind: "main" | "sub";
  mainCategoryId: number;
  subCategoryId: number | null;
  imageUrl?: string | null;
  slug?: string | null;
  children: TaxonomyNavNode[];
};

export function taxonomyAsNavTree(mains: MainCategoryApiItem[] = []): TaxonomyNavNode[] {
  return mains.map((main) => {
    const mainNavId = MAIN_NAV_OFFSET + main.id;
    return {
      categoryId: mainNavId,
      name: main.name,
      parentId: null,
      sortOrder: main.sortOrder,
      kind: "main" as const,
      mainCategoryId: main.id,
      subCategoryId: null,
      imageUrl: main.imageUrl ?? null,
      slug: main.slug,
      children: (main.subs ?? []).map((sub) => ({
        categoryId: sub.id,
        name: sub.name,
        parentId: mainNavId,
        sortOrder: sub.sortOrder,
        kind: "sub" as const,
        mainCategoryId: main.id,
        subCategoryId: sub.id,
        slug: sub.slug,
        children: [],
      })),
    };
  });
}

export function findCategoryById(
  categories: TaxonomyNavNode[],
  categoryId: number,
): TaxonomyNavNode | null {
  for (const category of categories) {
    if (category.categoryId === categoryId) return category;
    const nested = findCategoryById(category.children, categoryId);
    if (nested) return nested;
  }
  return null;
}

export function collectCategoryIds(category: TaxonomyNavNode): number[] {
  return [category.categoryId, ...category.children.flatMap(collectCategoryIds)];
}

export function flattenNavCategories(categories: TaxonomyNavNode[]): Array<{
  categoryId: number;
  name: string;
  depth: number;
}> {
  const out: Array<{ categoryId: number; name: string; depth: number }> = [];
  const walk = (nodes: TaxonomyNavNode[], depth: number) => {
    for (const node of nodes) {
      out.push({ categoryId: node.categoryId, name: node.name, depth });
      walk(node.children, depth + 1);
    }
  };
  walk(categories, 0);
  return out;
}

export function filterProductsByNavNode(
  products: MenuProductApiItem[],
  category: TaxonomyNavNode | null,
): MenuProductApiItem[] {
  if (!category) return products;
  if (category.kind === "sub" && category.subCategoryId != null) {
    return products.filter((product) => product.subCategoryId === category.subCategoryId);
  }
  return products.filter((product) => product.mainCategoryId === category.mainCategoryId);
}

export function trackIdForNavNode(category: TaxonomyNavNode): number {
  return category.subCategoryId ?? category.mainCategoryId;
}

export function resolveProductNavCategory(
  categories: TaxonomyNavNode[],
  product: MenuProductApiItem,
): TaxonomyNavNode | null {
  if (product.subCategoryId != null) {
    const sub = findCategoryById(categories, product.subCategoryId);
    if (sub) return sub;
  }
  if (product.mainCategoryId != null) {
    return findCategoryById(categories, MAIN_NAV_OFFSET + product.mainCategoryId);
  }
  return null;
}

export function groupProductsByCategory(products: MenuProductApiItem[]) {
  const groups = new Map<string, MenuProductApiItem[]>();
  for (const product of products) {
    const key =
      product.subCategoryName?.trim() ||
      product.mainCategoryName?.trim() ||
      "Genel";
    const list = groups.get(key) ?? [];
    list.push(product);
    groups.set(key, list);
  }
  return Array.from(groups.entries());
}

export function formatMenuPrice(price?: number | string, currency = "TRY") {
  const amount = typeof price === "string" ? parseFloat(price) : price;
  if (amount == null || !Number.isFinite(amount)) return "";
  const symbol = currency === "TRY" || currency === "TL" ? "₺" : currency;
  return `${symbol}${amount.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
}
