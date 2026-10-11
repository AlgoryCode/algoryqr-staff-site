import { NextResponse } from "next/server";

import { activePackagePath } from "@/lib/active-package-path";
import { getUserIdFromAccessToken } from "@/lib/auth-user";
import { API_BASE_URL } from "@/lib/config";
import {
  setActivePackageCookie,
  type ActivePackageSnapshot,
} from "@/lib/server/auth-cookies";

const ACTIVE_PACKAGE_TIMEOUT_MS = 10_000;

export function resolveLoginUserId(userId: unknown, accessToken?: string | null): number | undefined {
  if (typeof userId === "number" && Number.isInteger(userId) && userId > 0) return userId;
  const fromToken = getUserIdFromAccessToken(accessToken);
  return fromToken != null && fromToken > 0 ? fromToken : undefined;
}

export async function fetchActivePackage(
  userId: number,
  accessToken: string,
): Promise<ActivePackageSnapshot | null> {
  if (!API_BASE_URL || !accessToken || !Number.isInteger(userId) || userId <= 0) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ACTIVE_PACKAGE_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${activePackagePath(userId)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    return parseActivePackageSnapshot(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function applyActivePackageCookie(
  response: NextResponse,
  userId: number | null | undefined,
  accessToken: string | undefined,
) {
  if (userId == null || !accessToken) {
    setActivePackageCookie(response, null);
    return;
  }
  const snapshot = await fetchActivePackage(userId, accessToken);
  setActivePackageCookie(response, snapshot);
}

export async function attachActivePackageCookie(upstream: NextResponse): Promise<NextResponse> {
  if (upstream.status < 200 || upstream.status >= 300) return upstream;
  const payload: unknown = await upstream.json();
  const response = NextResponse.json(payload, { status: upstream.status });
  setActivePackageCookie(response, parseActivePackageSnapshot(payload));
  return response;
}

export function parseActivePackageSnapshot(payload: unknown): ActivePackageSnapshot | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  return {
    packageCode: stringOrNull(record.packageCode) ?? stringOrNull(record.activePackage),
    packageName: stringOrNull(record.packageName),
    periodStart: dateOrNull(record.periodStart),
    periodEnd: dateOrNull(record.periodEnd),
    products: stringArray(record.products),
    scopes: stringArray(record.scopes),
  };
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function dateOrNull(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (!Array.isArray(value) || value.length < 3) return null;
  const [year, month, day] = value;
  if (typeof year !== "number" || typeof month !== "number" || typeof day !== "number") return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
