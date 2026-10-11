import { NextResponse } from "next/server";

import { COOKIE_MAX_AGE_SECONDS, TWO_FACTOR_PENDING_COOKIE_MAX_AGE_SECONDS } from "@/lib/config";
import { clearDemoOnboardingCookies } from "@/lib/server/demo-onboarding-cookies";

const baseOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

const cookieOptions = { ...baseOptions, maxAge: COOKIE_MAX_AGE_SECONDS };

type CookieStore = { get: (name: string) => { value?: string } | undefined };

export function readAccessTokenFromCookies(cookieStore: CookieStore): string | null {
  const t =
    cookieStore.get("accessToken")?.value?.trim() || cookieStore.get("algory_access_token")?.value?.trim();
  return t || null;
}

export function readRefreshTokenFromCookies(cookieStore: CookieStore): string | null {
  const t =
    cookieStore.get("refreshToken")?.value?.trim() || cookieStore.get("algory_refresh_token")?.value?.trim();
  return t || null;
}

export function readUserIdFromCookies(cookieStore: CookieStore): number | null {
  const raw = cookieStore.get("userId")?.value?.trim();
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Eski `algory_*` auth çerezlerini kaldır (rent-fe ile aynı strateji). */
export function clearLegacyAlgoryAuthCookies(response: NextResponse) {
  const clear = { ...cookieOptions, maxAge: 0 };
  response.cookies.set("algory_access_token", "", clear);
  response.cookies.set("algory_refresh_token", "", clear);
}

export type ActivePackageSnapshot = {
  packageCode: string | null;
  packageName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  products: string[];
  scopes: string[];
};

export function setActivePackageCookie(response: NextResponse, snapshot: ActivePackageSnapshot | null) {
  if (!snapshot) {
    response.cookies.set("activePackage", "", { ...cookieOptions, maxAge: 0 });
    return;
  }
  response.cookies.set("activePackage", JSON.stringify(snapshot), cookieOptions);
}

export function setAuthCookies(
  response: NextResponse,
  accessToken?: string,
  refreshToken?: string,
  userId?: number,
) {
  if (accessToken) {
    response.cookies.set("accessToken", accessToken, cookieOptions);
  }
  if (refreshToken) {
    response.cookies.set("refreshToken", refreshToken, cookieOptions);
  }
  if (userId != null && userId > 0) {
    response.cookies.set("userId", String(userId), cookieOptions);
  }
  clearLegacyAlgoryAuthCookies(response);
}

export function setTokenExpiryCookies(
  response: NextResponse,
  accessTokenExpiresAt?: number,
  refreshTokenExpiresAt?: number,
) {
  const clear = { ...cookieOptions, maxAge: 0 };
  if (accessTokenExpiresAt != null && accessTokenExpiresAt > 0) {
    response.cookies.set("accessTokenExp", String(accessTokenExpiresAt), cookieOptions);
  } else {
    response.cookies.set("accessTokenExp", "", clear);
  }
  if (refreshTokenExpiresAt != null && refreshTokenExpiresAt > 0) {
    response.cookies.set("refreshTokenExp", String(refreshTokenExpiresAt), cookieOptions);
  } else {
    response.cookies.set("refreshTokenExp", "", clear);
  }
}

export function setRefreshTokenExpiryCookie(
  response: NextResponse,
  refreshTokenExpiresAt: number,
) {
  if (refreshTokenExpiresAt > 0) {
    response.cookies.set("refreshTokenExp", String(refreshTokenExpiresAt), cookieOptions);
  }
}

export function setTwoFactorPendingCookie(response: NextResponse, token: string) {
  response.cookies.set("algory_2fa_pending", token, {
    ...baseOptions,
    maxAge: TWO_FACTOR_PENDING_COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearAuthCookies(response: NextResponse) {
  const clearOptions = { ...cookieOptions, maxAge: 0 };
  response.cookies.set("accessToken", "", clearOptions);
  response.cookies.set("refreshToken", "", clearOptions);
  response.cookies.set("accessTokenExp", "", clearOptions);
  response.cookies.set("refreshTokenExp", "", clearOptions);
  response.cookies.set("userId", "", clearOptions);
  response.cookies.set("activePackage", "", clearOptions);
  clearLegacyAlgoryAuthCookies(response);
  clearDemoOnboardingCookies(response);
  response.cookies.set("algory_2fa_pending", "", { ...baseOptions, maxAge: 0 });
}
