import axios, { AxiosError } from "axios";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { authUrl } from "@/lib/config";
import { clientContextHeaders } from "@/lib/server/client-headers";
import {
  clearStaffAuthCookies,
  readStaffAccessTokenFromCookies,
  readStaffRefreshTokenFromCookies,
  setStaffAuthCookies,
  staffAppFromRequest,
  type StaffApp,
} from "@/lib/server/waiter-auth-cookies";

function appForStaffRole(role: unknown): StaffApp {
  const raw = typeof role === "string" ? role.trim().toUpperCase() : "";
  if (raw === "KITCHEN") return "kitchen";
  if (raw === "COURIER") return "courier";
  return "waiter";
}

function readMerchantId(value: unknown): number | null {
  const raw = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isSafeInteger(raw) || raw <= 0) return null;
  return raw;
}

function staffIdFrom(data: Record<string, unknown>): number | undefined {
  const raw = data.staffId ?? data.waiterId;
  return typeof raw === "number" && raw > 0 ? raw : undefined;
}

function publicStaffProfile(data: Record<string, unknown>) {
  const role = typeof data.staffRole === "string" ? data.staffRole : "WAITER";
  return {
    staffId: staffIdFrom(data) ?? null,
    waiterId: staffIdFrom(data) ?? null,
    branchId: typeof data.branchId === "number" ? data.branchId : null,
    displayName: typeof data.displayName === "string" ? data.displayName : null,
    username: typeof data.username === "string" ? data.username : null,
    staffRole: role,
    kitchenEnabled: role === "KITCHEN" || data.kitchenEnabled === true,
    courierEnabled: role === "COURIER" || data.courierEnabled === true,
    active: data.active !== false,
  };
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return null;
  }
}

function upstreamError(error: unknown) {
  if (error instanceof AxiosError) {
    if (error.code === "ECONNABORTED") {
      return NextResponse.json({ message: "Gateway timeout" }, { status: 504 });
    }
    if (error.response) {
      return NextResponse.json(error.response.data ?? {}, { status: error.response.status });
    }
  }
  return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 });
}

function profileFromAccess(data: Record<string, unknown>) {
  const profile = (typeof data.profile === "object" && data.profile != null
    ? data.profile
    : {}) as Record<string, unknown>;
  return {
    ...profile,
    staffRole: typeof data.role === "string" ? data.role : profile.role,
  };
}

async function handleLogin(request: Request) {
  const body = await readJson(request);
  if (body == null) {
    return NextResponse.json({ message: "Geçersiz JSON" }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const merchantId = readMerchantId(body.merchantId);
  if (merchantId == null) {
    return NextResponse.json({ message: "İşletme ID gerekli" }, { status: 400 });
  }
  if (!username || !password) {
    return NextResponse.json({ message: "Kullanıcı adı ve şifre gerekli" }, { status: 400 });
  }

  try {
    const upstream = await axios.post<Record<string, unknown>>(
      authUrl("login"),
      { identifier: username, password, merchantId },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...clientContextHeaders(request),
        },
        validateStatus: () => true,
        timeout: 20_000,
      },
    );
    const data = (typeof upstream.data === "object" && upstream.data != null ? upstream.data : {}) as Record<
      string,
      unknown
    >;
    if (upstream.status < 200 || upstream.status >= 300) {
      const message = typeof data.message === "string" ? data.message : "Giriş başarısız";
      return NextResponse.json({ message }, { status: upstream.status || 401 });
    }

    const accessToken = typeof data.accessToken === "string" ? data.accessToken : undefined;
    const refreshToken = typeof data.refreshToken === "string" ? data.refreshToken : undefined;
    const access = accessToken
      ? await axios.get<Record<string, unknown>>(authUrl("access"), {
          headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
          validateStatus: () => true,
          timeout: 20_000,
        })
      : null;
    const accessBody = (access && typeof access.data === "object" && access.data != null ? access.data : {}) as Record<
      string,
      unknown
    >;
    const staff = profileFromAccess(accessBody);
    const app = appForStaffRole(staff.staffRole);
    const response = NextResponse.json(publicStaffProfile(staff));
    setStaffAuthCookies(response, app, accessToken, refreshToken, staffIdFrom(data));
    return response;
  } catch (error) {
    return upstreamError(error);
  }
}

async function handleRefresh(request: Request) {
  const app = staffAppFromRequest(request);
  const cookieStore = await cookies();
  const refreshToken = readStaffRefreshTokenFromCookies(cookieStore, app);
  if (!refreshToken) {
    return NextResponse.json({ message: "Oturum gerekli" }, { status: 401 });
  }

  try {
    const upstream = await axios.post<Record<string, unknown>>(
      authUrl("refresh"),
      { refreshToken },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...clientContextHeaders(request),
        },
        validateStatus: () => true,
        timeout: 20_000,
      },
    );
    const data = (typeof upstream.data === "object" && upstream.data != null ? upstream.data : {}) as Record<
      string,
      unknown
    >;
    if (upstream.status < 200 || upstream.status >= 300) {
      const response = NextResponse.json(
        { message: typeof data.message === "string" ? data.message : "Oturum gerekli" },
        { status: upstream.status || 401 },
      );
      clearStaffAuthCookies(response, app);
      return response;
    }
    const response = NextResponse.json({ ok: true });
    setStaffAuthCookies(
      response,
      appForStaffRole(data.staffRole ?? (app === "kitchen" ? "KITCHEN" : app === "courier" ? "COURIER" : "WAITER")),
      typeof data.accessToken === "string" ? data.accessToken : undefined,
      typeof data.refreshToken === "string" ? data.refreshToken : undefined,
      staffIdFrom(data),
    );
    return response;
  } catch (error) {
    return upstreamError(error);
  }
}

async function handleLogout(request: Request) {
  const app = staffAppFromRequest(request);
  const cookieStore = await cookies();
  const accessToken = readStaffAccessTokenFromCookies(cookieStore, app);
  const refreshToken = readStaffRefreshTokenFromCookies(cookieStore, app);
  if (refreshToken) {
    try {
      await axios.post(
        authUrl("logout"),
        { refreshToken },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            ...clientContextHeaders(request),
          },
          validateStatus: () => true,
          timeout: 20_000,
        },
      );
    } catch {
      // Local session still ends.
    }
  }
  const response = NextResponse.json({ ok: true });
  clearStaffAuthCookies(response, app);
  return response;
}

async function handleMe(request: Request) {
  const app = staffAppFromRequest(request);
  const cookieStore = await cookies();
  const accessToken = readStaffAccessTokenFromCookies(cookieStore, app);
  if (!accessToken) {
    return NextResponse.json({ message: "Oturum gerekli" }, { status: 401 });
  }
  try {
    const access = await axios.get<Record<string, unknown>>(authUrl("access"), {
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
      validateStatus: () => true,
      timeout: 20_000,
    });
    const data = (typeof access.data === "object" && access.data != null ? access.data : {}) as Record<string, unknown>;
    if (access.status < 200 || access.status >= 300) {
      const message = typeof data.message === "string" ? data.message : "Oturum gerekli";
      return NextResponse.json({ message }, { status: access.status || 401 });
    }
    return NextResponse.json(publicStaffProfile(profileFromAccess(data)));
  } catch (error) {
    return upstreamError(error);
  }
}

export async function handleStaffAuth(
  request: Request,
  method: string,
  key: string,
): Promise<NextResponse | null> {
  if (method === "POST" && key === "auth/login") return handleLogin(request);
  if (method === "POST" && key === "auth/refresh") return handleRefresh(request);
  if (method === "POST" && key === "auth/logout") return handleLogout(request);
  if (method === "GET" && key === "auth/me") return handleMe(request);
  return null;
}
