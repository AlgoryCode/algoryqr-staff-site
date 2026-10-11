import { NextResponse } from "next/server";

import { COOKIE_MAX_AGE_SECONDS } from "@/lib/config";

export type StaffApp = "waiter" | "kitchen" | "courier";

export const STAFF_APP_HEADER = "x-staff-app";

export const STAFF_COOKIE_NAMES = {
  waiter: {
    access: "waiter_access",
    refresh: "waiter_refresh",
    id: "waiter_id",
  },
  kitchen: {
    access: "kitchen_access",
    refresh: "kitchen_refresh",
    id: "kitchen_id",
  },
  courier: {
    access: "courier_access",
    refresh: "courier_refresh",
    id: "courier_id",
  },
} as const;

const baseOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

const cookieOptions = { ...baseOptions, maxAge: COOKIE_MAX_AGE_SECONDS };

type CookieStore = { get: (name: string) => { value?: string } | undefined };

export function parseStaffApp(value: unknown): StaffApp | null {
  return value === "kitchen" || value === "waiter" || value === "courier" ? value : null;
}

export function staffAppFromRequest(
  request: { headers: Headers },
  bodyApp?: unknown,
): StaffApp {
  return parseStaffApp(bodyApp) ?? parseStaffApp(request.headers.get(STAFF_APP_HEADER)?.trim().toLowerCase()) ?? "waiter";
}

function cookieValue(cookieStore: CookieStore, name: string): string | null {
  const t = cookieStore.get(name)?.value?.trim();
  return t || null;
}

export function readStaffAccessTokenFromCookies(cookieStore: CookieStore, app: StaffApp): string | null {
  return cookieValue(cookieStore, STAFF_COOKIE_NAMES[app].access);
}

export function readStaffRefreshTokenFromCookies(cookieStore: CookieStore, app: StaffApp): string | null {
  return cookieValue(cookieStore, STAFF_COOKIE_NAMES[app].refresh);
}

export function readStaffIdFromCookies(cookieStore: CookieStore, app: StaffApp): number | null {
  const raw = cookieValue(cookieStore, STAFF_COOKIE_NAMES[app].id);
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setStaffAuthCookies(
  response: NextResponse,
  app: StaffApp,
  accessToken?: string,
  refreshToken?: string,
  waiterId?: number,
) {
  const names = STAFF_COOKIE_NAMES[app];
  if (accessToken) {
    response.cookies.set(names.access, accessToken, cookieOptions);
  }
  if (refreshToken) {
    response.cookies.set(names.refresh, refreshToken, cookieOptions);
  }
  if (waiterId != null && waiterId > 0) {
    response.cookies.set(names.id, String(waiterId), cookieOptions);
  }
}

export function clearStaffAuthCookies(response: NextResponse, app: StaffApp) {
  const names = STAFF_COOKIE_NAMES[app];
  const clearOptions = { ...cookieOptions, maxAge: 0 };
  response.cookies.set(names.access, "", clearOptions);
  response.cookies.set(names.refresh, "", clearOptions);
  response.cookies.set(names.id, "", clearOptions);
}

export function readWaiterAccessTokenFromCookies(cookieStore: CookieStore): string | null {
  return readStaffAccessTokenFromCookies(cookieStore, "waiter");
}

export function readWaiterRefreshTokenFromCookies(cookieStore: CookieStore): string | null {
  return readStaffRefreshTokenFromCookies(cookieStore, "waiter");
}

export function readWaiterIdFromCookies(cookieStore: CookieStore): number | null {
  return readStaffIdFromCookies(cookieStore, "waiter");
}

export function setWaiterAuthCookies(
  response: NextResponse,
  accessToken?: string,
  refreshToken?: string,
  waiterId?: number,
) {
  setStaffAuthCookies(response, "waiter", accessToken, refreshToken, waiterId);
}

export function clearWaiterAuthCookies(response: NextResponse) {
  clearStaffAuthCookies(response, "waiter");
}
