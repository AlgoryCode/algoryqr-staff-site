const trimTrailingSlash = (s: string) => s.replace(/\/$/, "");

function readRuntimeEnv(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  return raw ? trimTrailingSlash(raw) : undefined;
}

function readDeployEnv(): string {
  return (process.env.APP_ENV || process.env.DEPLOY_ENV || "").trim().toLowerCase();
}

const STAGE_API_BASE = "https://stage.qrapi.algorycode.com";
const PROD_API_BASE = "https://prod.qrapi.algorycode.com";

function resolveApiBaseUrl(): string {
  const fromEnv = readRuntimeEnv("API_BASE_URL") || readRuntimeEnv("API_UPSTREAM");
  if (fromEnv) return fromEnv;

  const deployEnv = readDeployEnv();
  if (deployEnv === "stage" || deployEnv === "staging") return STAGE_API_BASE;
  if (deployEnv === "prod" || deployEnv === "production") return PROD_API_BASE;

  // Only infer cloud API from APP_URL on production deploys — local dev must not
  // follow APP_URL when it points at staff.algorycode.com while qr-service runs locally.
  const productionDeploy =
    deployEnv === "prod" ||
    deployEnv === "production" ||
    (process.env.NODE_ENV === "production" && deployEnv !== "development" && deployEnv !== "dev");
  if (productionDeploy) {
    try {
      const appUrl = readRuntimeEnv("APP_URL") || readRuntimeEnv("NEXT_PUBLIC_APP_URL");
      if (appUrl) {
        const host = new URL(appUrl).hostname.toLowerCase();
        if (host.includes("stage.")) return STAGE_API_BASE;
        if (
          host.includes("prod.") ||
          host === "qr.algorycode.com" ||
          host === "staff.algorycode.com" ||
          host.endsWith(".algorycode.com")
        ) {
          return PROD_API_BASE;
        }
      }
    } catch {
      // ignore
    }
  }

  if (typeof window !== "undefined" || process.env.NODE_ENV !== "production") return "http://localhost:8080";
  if (process.env["NEXT_PHASE"] === "phase-production-build") return STAGE_API_BASE;
  throw new Error("API_BASE_URL is required");
}

const AUTH_ROUTES = {
  login: "/api/v1/auth/login",
  staffLogin: "/api/v1/auth/staff/login",
  register: "/api/v1/auth/register",
  demoLogin: "/api/v1/auth/demo/login",
  demoRegister: "/api/v1/auth/demo/register",
  demoProvision: "/api/v1/auth/register",
  demoStatus: "/api/v1/auth/access",
  demoUsernameAvailable: "/api/v1/auth/demo/register",
  refresh: "/api/v1/auth/tokens/refresh",
  logout: "/api/v1/auth/tokens/revoke",
  access: "/api/v1/auth/access",
  googleAuthorize: "/api/v1/auth/google/authorize",
  googleRedeem: "/api/v1/auth/google/redeem",
} as const;

export type AuthRoute = keyof typeof AUTH_ROUTES;

function resolveAuthBaseUrl(): string {
  const explicit = readRuntimeEnv("AUTH_BASE_URL");
  if (explicit) return explicit;
  return resolveApiBaseUrl();
}

function resolvePublicApiBaseUrl(): string {
  return readRuntimeEnv("PUBLIC_API_BASE_URL") || resolveApiBaseUrl();
}

function resolveAppUrl(): string {
  const fromEnv = process.env.APP_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  return "";
}

export const API_BASE_URL = resolveApiBaseUrl();

export const AUTH_BASE_URL = resolveAuthBaseUrl();

export const PUBLIC_API_BASE_URL = resolvePublicApiBaseUrl();

export function authUrl(route: AuthRoute): string {
  return `${AUTH_BASE_URL}${AUTH_ROUTES[route]}`;
}

export const APP_URL = resolveAppUrl();

export const WAITER_APP_ORIGIN = trimTrailingSlash(
  process.env.NEXT_PUBLIC_WAITER_APP_ORIGIN?.trim() ||
    process.env.WAITER_APP_ORIGIN?.trim() ||
    "http://localhost:3003",
);

export const KITCHEN_APP_ORIGIN = trimTrailingSlash(
  process.env.NEXT_PUBLIC_KITCHEN_APP_ORIGIN?.trim() ||
    process.env.KITCHEN_APP_ORIGIN?.trim() ||
    "http://localhost:3004",
);

export const COURIER_APP_ORIGIN = trimTrailingSlash(
  process.env.NEXT_PUBLIC_COURIER_APP_ORIGIN?.trim() ||
    process.env.COURIER_APP_ORIGIN?.trim() ||
    "http://localhost:3005",
);

export const STORE_APP_ORIGIN = trimTrailingSlash(
  process.env.NEXT_PUBLIC_STORE_APP_ORIGIN?.trim() ||
    process.env.STORE_APP_ORIGIN?.trim() ||
    "http://localhost:3006",
);

/**
 * Public menu links intentionally use one stable host in every environment.
 * The menu site owns this hostname; it must not follow the dashboard/API host.
 */
export const MENU_APP_ORIGIN = "https://menu.algorycode.com";

export const MARKETING_APP_ORIGIN = trimTrailingSlash(
  process.env.NEXT_PUBLIC_MARKETING_APP_ORIGIN?.trim() ||
    process.env.MARKETING_APP_ORIGIN?.trim() ||
    "http://localhost:3000",
);

export const QR_API_BASE = `${API_BASE_URL}/qr`;

function resolveQrMcpBaseUrl(): string {
  const fromEnv = process.env.QR_MCP_BASE_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  return "https://prod.qr-mcp.algorycode.com";
}

export const QR_MCP_BASE_URL = resolveQrMcpBaseUrl();

export const QR_MCP_API_KEY = process.env.QR_MCP_API_KEY?.trim() ?? "";

function resolveQrAgentBaseUrl(): string {
  const fromEnv = process.env.QR_AGENT_BASE_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  return "http://localhost:3200";
}

export const QR_AGENT_BASE_URL = resolveQrAgentBaseUrl();

function resolveAiServiceBaseUrl(): string {
  const fromEnv = process.env.AI_SERVICE_BASE_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  return "http://localhost:8000";
}

export const AI_SERVICE_BASE_URL = resolveAiServiceBaseUrl();

export const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY?.trim() ?? "";

function resolveProductServiceBaseUrl(): string {
  const fromEnv = process.env.PRODUCT_SERVICE_BASE_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  return "";
}

export const PRODUCT_SERVICE_BASE_URL = resolveProductServiceBaseUrl();

export const PRODUCT_SERVICE_AUTH_TOKEN = process.env.PRODUCT_SERVICE_AUTH_TOKEN?.trim() ?? "";

export const PRODUCT_SERVICE_AUTH_HEADER =
  process.env.PRODUCT_SERVICE_AUTH_HEADER?.trim() || "X-Service-Token";

export const ACCESS_TOKEN_EXPIRY_MS = 900_000;
export const ACCESS_TOKEN_EXPIRY_SECONDS = ACCESS_TOKEN_EXPIRY_MS / 1000;
export const REFRESH_TOKEN_EXPIRY_DAYS = 7;
export const COOKIE_MAX_AGE_SECONDS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60;
export const TWO_FACTOR_PENDING_COOKIE_MAX_AGE_SECONDS = ACCESS_TOKEN_EXPIRY_SECONDS;
