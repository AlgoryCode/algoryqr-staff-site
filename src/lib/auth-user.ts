export interface AuthUser {
  id?: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

type JwtPayload = Record<string, unknown>;

export type PackageCode =
  | "FREE_PACKAGE"
  | "STARTER_PACKAGE"
  | "PRO_PACKAGE"
  | "ULTIMATE_PACKAGE"
  | "ULTIMATE_TRIAL_PACKAGE"
  | "CORPORATE_PACKAGE";

export type ProductCode =
  | "QR_CREATE"
  | "QR_MENU"
  | "QR_BRANCH"
  | "MENU_PRODUCT"
  | "WAITER_PANEL"
  | "SMART_ASSISTANT"
  | "SMART_SUMMARY"
  | "SMART_REPORTING"
  | "CUSTOM_DESIGN"
  | "QR_AGENT"
  | "QR_ANALYTICS"
  | "AI_MENU_IMPORT"
  | "ONLINE_ORDER";

export type ProductScope =
  | "QR_CREATE_OWNER"
  | "QR_MENU_OWNER"
  | "QR_BRANCH_OWNER"
  | "MENU_PRODUCT_OWNER"
  | "WAITER_PANEL_OWNER"
  | "SMART_ASSISTANT_OWNER"
  | "SMART_SUMMARY_OWNER"
  | "SMART_REPORTING_OWNER"
  | "CUSTOM_DESIGN_OWNER"
  | "QR_ANALYTICS_OWNER"
  | "AI_MENU_IMPORT_OWNER"
  | "ONLINE_ORDER_OWNER";

export type AuthProvider = "GOOGLE" | "BASIC" | "MOBILE_GOOGLE";

export interface AccessProfile {
  activePackage: PackageCode | null;
  products: ProductCode[];
  scopes: ProductScope[];
  roles: string[];
  provider: AuthProvider | null;
}

const KNOWN_PRODUCT_CODES = new Set<string>([
  "QR_CREATE",
  "QR_MENU",
  "QR_BRANCH",
  "MENU_PRODUCT",
  "WAITER_PANEL",
  "SMART_ASSISTANT",
  "SMART_SUMMARY",
  "SMART_REPORTING",
  "CUSTOM_DESIGN",
  "QR_AGENT",
  "QR_ANALYTICS",
  "AI_MENU_IMPORT",
  "ONLINE_ORDER",
]);

const KNOWN_PRODUCT_SCOPES = new Set<string>([
  "QR_CREATE_OWNER",
  "QR_MENU_OWNER",
  "QR_BRANCH_OWNER",
  "MENU_PRODUCT_OWNER",
  "WAITER_PANEL_OWNER",
  "SMART_ASSISTANT_OWNER",
  "SMART_SUMMARY_OWNER",
  "SMART_REPORTING_OWNER",
  "CUSTOM_DESIGN_OWNER",
  "QR_ANALYTICS_OWNER",
  "AI_MENU_IMPORT_OWNER",
  "ONLINE_ORDER_OWNER",
]);

const PACKAGE_CODES = new Set<string>([
  "FREE_PACKAGE",
  "STARTER_PACKAGE",
  "PRO_PACKAGE",
  "ULTIMATE_PACKAGE",
  "ULTIMATE_TRIAL_PACKAGE",
  "CORPORATE_PACKAGE",
]);

function decodeBase64Url(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(padded, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

function parseJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const payloadRaw = decodeBase64Url(parts[1]);
  if (!payloadRaw) return null;
  try {
    return JSON.parse(payloadRaw) as JwtPayload;
  } catch {
    return null;
  }
}

/** ISO-8601 tarih/saat → Unix epoch (saniye). */
export function isoToEpochSeconds(iso?: string | null): number | null {
  if (!iso?.trim()) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/**
 * JWT access token'dan exp (saniye cinsinden epoch) döner; yoksa null.
 * Backend exp'i bazen ms veriyor (örn. Spring 300000 ms); > 1e12 ise ms kabul edip saniyeye çeviriyoruz.
 */
export function getExpFromJwt(token?: string | null): number | null {
  if (!token) return null;
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return null;
  const exp = payload.exp;
  if (exp >= 1e12) return Math.floor(exp / 1000);
  return exp;
}

export function getExpFromAccessToken(token?: string | null): number | null {
  return getExpFromJwt(token);
}

export function resolveRefreshExpiresAt(
  refreshToken?: string | null,
  refreshExpiresAt?: string | null,
): number | undefined {
  return getExpFromJwt(refreshToken) ?? isoToEpochSeconds(refreshExpiresAt) ?? undefined;
}

export function parseNumericId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.trunc(value);
    return n > 0 ? n : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const n = parseInt(trimmed, 10);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  }
  return null;
}

function parseNumericClaim(value: unknown): number | null {
  return parseNumericId(value);
}

export function getStaffIdFromAccessToken(token?: string | null): number | null {
  if (!token) return null;
  const payload = parseJwtPayload(token);
  if (!payload) return null;
  const fromStaffClaims =
    parseNumericClaim(payload.staffId) ?? parseNumericClaim(payload.staff_id);
  if (fromStaffClaims != null) return fromStaffClaims;
  const subjectType =
    typeof payload.subjectType === "string" ? payload.subjectType.trim().toUpperCase() : "";
  if (subjectType === "STAFF") {
    return parseNumericClaim(payload.userId) ?? parseNumericClaim(payload.user_id);
  }
  return null;
}

export function getSubjectFromAccessToken(token?: string | null): string | null {
  if (!token) return null;
  const payload = parseJwtPayload(token);
  if (!payload) return null;
  const sub = payload.sub;
  return typeof sub === "string" && sub.trim() ? sub.trim() : null;
}

export function getRolesFromAccessToken(token?: string | null): string[] {
  if (!token) return [];
  const payload = parseJwtPayload(token);
  if (!payload) return [];
  const roles = payload.roles;
  if (!Array.isArray(roles)) return [];
  return roles.map((r) => String(r));
}

export function getBranchIdFromAccessToken(token?: string | null): number | null {
  if (!token) return null;
  const payload = parseJwtPayload(token);
  if (!payload) return null;
  return parseNumericClaim(payload.branchId) ?? parseNumericClaim(payload.branch_id);
}

export function getMerchantIdFromAccessToken(token?: string | null): number | null {
  if (!token) return null;
  const payload = parseJwtPayload(token);
  if (!payload) return null;
  return parseNumericClaim(payload.merchantId) ?? parseNumericClaim(payload.merchant_id);
}

export function getUserIdFromAccessToken(token?: string | null): number | null {
  if (!token) return null;
  const payload = parseJwtPayload(token);
  if (!payload) return null;
  return (
    parseNumericClaim(payload.merchantId) ??
    parseNumericClaim(payload.userId) ??
    parseNumericClaim(payload.accountId) ??
    parseNumericClaim(payload.customerId) ??
    parseNumericClaim(payload.id)
  );
}

type SessionCookieStore = { get: (name: string) => { value?: string } | undefined };

export function resolveSessionUserId(
  accessToken: string | null | undefined,
  cookieStore?: SessionCookieStore,
): number | null {
  const fromToken = getUserIdFromAccessToken(accessToken);
  if (fromToken != null) return fromToken;
  if (!cookieStore) return null;
  const raw = cookieStore.get("userId")?.value?.trim();
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getUserFromAccessToken(token?: string | null): AuthUser | null {
  if (!token) return null;
  const payload = parseJwtPayload(token);
  if (!payload) return null;

  const email = (payload.email as string | undefined) || "";
  const firstName = (payload.firstName as string | undefined) || (payload.first_name as string | undefined);
  const lastName = (payload.lastName as string | undefined) || (payload.last_name as string | undefined);
  const numericUserId = getUserIdFromAccessToken(token);
  const fallbackId =
    (payload.accountId as string | number | undefined) ||
    (payload.customerId as string | number | undefined) ||
    (payload.sub as string | number | undefined);

  if (numericUserId == null && fallbackId == null && !email && !firstName && !lastName) return null;

  return {
    id: numericUserId != null ? String(numericUserId) : fallbackId != null ? String(fallbackId) : undefined,
    email: email || "",
    first_name: firstName,
    last_name: lastName,
  };
}

function isProductCode(value: string): value is ProductCode {
  return KNOWN_PRODUCT_CODES.has(value);
}

export function normalizeProductCode(value: string): ProductCode | null {
  if (isProductCode(value)) return value;
  if (value === "SMART_REPORTING") return "SMART_REPORTING";
  if (value === "SMART_ASSISTANT") return "SMART_ASSISTANT";
  if (value === "SMART_SUMMARY") return "SMART_SUMMARY";
  return null;
}

function isProductScope(value: string): value is ProductScope {
  if (KNOWN_PRODUCT_SCOPES.has(value)) return true;
  if (value === "SMART_REPORTING_OWNER") return true;
  return false;
}

export function normalizeProductScope(value: string): ProductScope | null {
  if (value === "SMART_REPORTING_OWNER") return "SMART_REPORTING_OWNER";
  return isProductScope(value) ? value : null;
}

export function toAccessProfile(input: {
  packageCode: string | null;
  products: readonly string[];
  scopes: readonly string[];
  roles: readonly string[];
  provider: unknown;
}): AccessProfile {
  const products = input.products
    .map(normalizeProductCode)
    .filter((item): item is ProductCode => item != null);
  const activePackageRaw = input.packageCode;
  return {
    activePackage:
      activePackageRaw && PACKAGE_CODES.has(activePackageRaw)
        ? (activePackageRaw as PackageCode)
        : null,
    products: [...new Set(products)],
    scopes: input.scopes
      .map(normalizeProductScope)
      .filter((item): item is ProductScope => item != null),
    roles: [...input.roles],
    provider: parseAuthProvider(input.provider),
  };
}

export function getAccessProfileFromToken(token?: string | null): AccessProfile {
  const payload = token ? parseJwtPayload(token) : null;
  if (!payload) {
    return { activePackage: null, products: [], scopes: [], roles: [], provider: null };
  }
  return toAccessProfile({
    packageCode: typeof payload.activePackage === "string" ? payload.activePackage : null,
    products: readStringArray(payload.products),
    scopes: readStringArray(payload.scopes),
    roles: readStringArray(payload.roles),
    provider: payload.provider,
  });
}

export function isGoogleAuthProvider(provider: AuthProvider | null | undefined): boolean {
  return provider === "GOOGLE" || provider === "MOBILE_GOOGLE";
}

function parseAuthProvider(value: unknown): AuthProvider | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "GOOGLE" || normalized === "BASIC" || normalized === "MOBILE_GOOGLE") {
    return normalized;
  }
  return null;
}

export function hasScope(profile: AccessProfile | null | undefined, scope: ProductScope): boolean {
  if (!profile) return false;
  if (scope === "SMART_REPORTING_OWNER" || scope === "QR_ANALYTICS_OWNER") {
    return hasProduct(profile, "SMART_REPORTING") || hasProduct(profile, "QR_ANALYTICS");
  }
  if (scope.endsWith("_OWNER")) {
    const product = normalizeProductCode(scope.slice(0, -"_OWNER".length));
    if (product) return hasProduct(profile, product);
  }
  return profile.scopes.includes(scope);
}

export function hasProduct(profile: AccessProfile | null | undefined, product: ProductCode): boolean {
  const present = productInPackage(profile, product);
  if (typeof window !== "undefined") {
    void import("@/lib/flow-log").then(({ recordProductCheck }) => {
      recordProductCheck(product, present, profile?.activePackage ?? null);
    });
  }
  return present;
}

function productInPackage(profile: AccessProfile | null | undefined, product: ProductCode): boolean {
  if (!profile) return false;
  if (profile.products.includes(product)) return true;
  if (product === "QR_ANALYTICS" && profile.products.includes("SMART_REPORTING")) return true;
  if (product === "QR_AGENT" && profile.products.includes("SMART_ASSISTANT")) return true;
  return false;
}

export function tokenHasScope(token: string | null | undefined, scope: ProductScope): boolean {
  return hasScope(getAccessProfileFromToken(token), scope);
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function buildUpstreamAuthHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  const userId = getUserIdFromAccessToken(accessToken);
  if (userId != null) {
    headers["X-User-Id"] = String(userId);
  }
  return headers;
}
