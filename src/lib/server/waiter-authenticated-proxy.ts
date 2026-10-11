import axios, { AxiosError } from "axios";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { API_BASE_URL, authUrl } from "@/lib/config";
import {
  clearStaffAuthCookies,
  readStaffAccessTokenFromCookies,
  readStaffRefreshTokenFromCookies,
  setStaffAuthCookies,
  staffAppFromRequest,
  type StaffApp,
} from "@/lib/server/waiter-auth-cookies";

type RefreshedWaiterTokens = {
  accessToken: string;
  refreshToken?: string;
  waiterId?: number;
};

async function tryRefreshStaffTokens(app: StaffApp): Promise<RefreshedWaiterTokens | null> {
  const cookieStore = await cookies();
  const refreshToken = readStaffRefreshTokenFromCookies(cookieStore, app);
  if (!refreshToken) return null;

  const upstream = await axios.post<Record<string, unknown>>(
    authUrl("refresh"),
    { refreshToken },
    {
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      validateStatus: () => true,
      timeout: 20_000,
    },
  );

  const data = (typeof upstream.data === "object" && upstream.data != null
    ? upstream.data
    : {}) as { accessToken?: string; refreshToken?: string; staffId?: number; waiterId?: number };

  if (upstream.status < 200 || upstream.status >= 300) {
    return null;
  }
  if (typeof data.accessToken !== "string" || !data.accessToken) {
    return null;
  }

  return {
    accessToken: data.accessToken,
    refreshToken: typeof data.refreshToken === "string" ? data.refreshToken : undefined,
    waiterId: typeof data.staffId === "number" ? data.staffId : typeof data.waiterId === "number" ? data.waiterId : undefined,
  };
}

export async function proxyWaiterAuthenticatedRequest(
  request: Request,
  upstreamPath: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  options?: { requireAuth?: boolean },
) {
  try {
    const requireAuth = options?.requireAuth !== false;
    const app = staffAppFromRequest(request);
    const cookieStore = await cookies();
    const accessToken = readStaffAccessTokenFromCookies(cookieStore, app);
    if (requireAuth && !accessToken) {
      return NextResponse.json({ message: "Oturum gerekli" }, { status: 401 });
    }

    const requestUrl = new URL(request.url);
    const query = upstreamPath.includes("?") ? "" : requestUrl.search;
    const writesJson = method !== "GET" && method !== "DELETE";
    const text = writesJson ? await request.text() : "";
    let data: unknown;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        return NextResponse.json({ message: "Geçersiz JSON" }, { status: 400 });
      }
    } else if (writesJson) {
      // Spring treats an empty POST as unreadable JSON on optional @RequestBody endpoints.
      data = {};
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");

    const doRequest = (token: string | null) =>
      axios.request({
        url: `${API_BASE_URL}${upstreamPath}${query}`,
        method,
        data,
        headers: {
          Accept: "application/json",
          ...(writesJson ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}),
          ...(!forwardedFor && realIp ? { "X-Forwarded-For": realIp } : {}),
        },
        validateStatus: () => true,
        timeout: 20_000,
      });

    let upstream = await doRequest(accessToken);
    let refreshedTokens: RefreshedWaiterTokens | null = null;

    if (upstream.status === 401 && requireAuth) {
      refreshedTokens = await tryRefreshStaffTokens(app);
      if (refreshedTokens) {
        upstream = await doRequest(refreshedTokens.accessToken);
      }
    }

    if (upstream.status === 401 && requireAuth) {
      const response = NextResponse.json(upstream.data ?? { message: "Oturum gerekli" }, {
        status: 401,
      });
      clearStaffAuthCookies(response, app);
      return response;
    }

    const response =
      upstream.status === 204 || upstream.data == null || upstream.data === ""
        ? new NextResponse(null, { status: upstream.status })
        : NextResponse.json(upstream.data, { status: upstream.status });

    if (refreshedTokens) {
      setStaffAuthCookies(
        response as NextResponse,
        app,
        refreshedTokens.accessToken,
        refreshedTokens.refreshToken,
        refreshedTokens.waiterId,
      );
    }

    return response;
  } catch (error) {
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
}
