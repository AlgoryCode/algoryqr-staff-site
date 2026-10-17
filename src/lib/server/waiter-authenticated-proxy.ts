import { AxiosError } from "axios";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getBranchIdFromAccessToken,
  getMerchantIdFromAccessToken,
  getStaffIdFromAccessToken,
} from "@/lib/auth-user";
import { API_BASE_URL } from "@/lib/config";
import { qrServiceAxios, upstreamTimeoutMessage } from "@/lib/server/qr-service-axios";
import { agentDebugLogServer } from "@/lib/server/agent-debug-log";
import {
  refreshStaffTokensDeduped,
  STAFF_REFRESH_ATTEMPTED_HEADER,
} from "@/lib/server/staff-token-refresh";
import {
  readStaffAccessTokenFromCookies,
  setStaffAuthCookies,
  STAFF_APP_HEADER,
  staffAppFromRequest,
} from "@/lib/server/waiter-auth-cookies";

function upstreamMessageFromData(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("message" in data)) return null;
  const message = (data as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

/** qr-service returns 401 with a message when JWT is valid but staff/waiter row cannot be resolved. */
function isStaffBusinessUnauthorized401(message: string | null): boolean {
  if (!message) return false;
  const normalized = message.toLocaleLowerCase("tr-TR");
  return (
    normalized.includes("garson bulunamadı") ||
    normalized.includes("personel bulunamadı") ||
    normalized.includes("personel oturumu gerekli") ||
    normalized.includes("waiter not found")
  );
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
      // #region agent log
      agentDebugLogServer({
        hypothesisId: "H1",
        location: "waiter-authenticated-proxy.ts",
        message: "no staff access cookie",
        data: { app, upstreamPath, apiBase: API_BASE_URL },
        runId: "pre-fix",
      });
      // #endregion
      const missing = NextResponse.json({ message: "Oturum gerekli" }, { status: 401 });
      missing.headers.set(STAFF_REFRESH_ATTEMPTED_HEADER, "1");
      return missing;
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

    const staffAppHeader = request.headers.get(STAFF_APP_HEADER)?.trim().toLowerCase();

    const upstreamUrl = `${API_BASE_URL}${upstreamPath}${query}`;

    const doRequest = (token: string | null) =>
      qrServiceAxios.request({
        url: upstreamUrl,
        method,
        data,
        headers: {
          Accept: "application/json",
          ...(writesJson ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(staffAppHeader ? { [STAFF_APP_HEADER]: staffAppHeader } : {}),
          ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}),
          ...(!forwardedFor && realIp ? { "X-Forwarded-For": realIp } : {}),
        },
      });

    if (upstreamPath.includes("/branches/") && upstreamPath.endsWith("/tables")) {
      // #region agent log
      agentDebugLogServer({
        hypothesisId: "H4",
        location: "waiter-authenticated-proxy.ts",
        message: "branch tables proxy request",
        data: {
          app,
          upstreamPath,
          tokenMerchantId: getMerchantIdFromAccessToken(accessToken),
          tokenBranchId: getBranchIdFromAccessToken(accessToken),
          tokenStaffId: getStaffIdFromAccessToken(accessToken),
          hadAccessToken: Boolean(accessToken),
        },
        runId: "pre-fix",
      });
      // #endregion
    }

    let upstream = await doRequest(accessToken);
    let refreshedTokens = null as Awaited<ReturnType<typeof refreshStaffTokensDeduped>>;
    let refreshAttempted = false;

    if (upstream.status === 401 && requireAuth) {
      const business401 = isStaffBusinessUnauthorized401(upstreamMessageFromData(upstream.data));
      if (business401) {
        // #region agent log
        agentDebugLogServer({
          hypothesisId: "H13",
          location: "waiter-authenticated-proxy.ts",
          message: "business 401 skip token refresh",
          data: {
            app,
            upstreamPath,
            upstreamMessage: upstreamMessageFromData(upstream.data),
            tokenStaffId: getStaffIdFromAccessToken(accessToken),
          },
          runId: "post-fix-3",
        });
        // #endregion
        const businessUnauthorized = NextResponse.json(upstream.data ?? { message: "Yetkisiz" }, {
          status: 401,
        });
        // Token may still be valid; tell the browser not to call /api/staff/auth/refresh.
        businessUnauthorized.headers.set(STAFF_REFRESH_ATTEMPTED_HEADER, "1");
        return businessUnauthorized;
      }
      refreshAttempted = true;
      refreshedTokens = await refreshStaffTokensDeduped(app);
      if (refreshedTokens) {
        upstream = await doRequest(refreshedTokens.accessToken);
      }
    }

    if (upstream.status === 401 && requireAuth) {
      const upstreamMessage = upstreamMessageFromData(upstream.data);
      // #region agent log
      agentDebugLogServer({
        hypothesisId: "H3",
        location: "waiter-authenticated-proxy.ts",
        message: "upstream 401 (cookies kept)",
        data: {
          app,
          upstreamPath,
          hadAccessToken: Boolean(accessToken),
          refreshAttempted,
          refreshSucceeded: Boolean(refreshedTokens),
          upstreamMessage,
        },
        runId: "post-fix-3",
      });
      // #endregion
      const unauthorized = NextResponse.json(upstream.data ?? { message: "Oturum gerekli" }, {
        status: 401,
      });
      if (refreshAttempted) {
        unauthorized.headers.set(STAFF_REFRESH_ATTEMPTED_HEADER, "1");
      }
      if (refreshedTokens) {
        setStaffAuthCookies(
          unauthorized,
          app,
          refreshedTokens.accessToken,
          refreshedTokens.refreshToken,
          refreshedTokens.staffId,
        );
        // #region agent log
        agentDebugLogServer({
          hypothesisId: "H15",
          location: "waiter-authenticated-proxy.ts",
          message: "persisted refreshed tokens on 401 response",
          data: { app, upstreamPath, staffId: refreshedTokens.staffId ?? null },
          runId: "post-fix-5",
        });
        // #endregion
      }
      return unauthorized;
    }

    const response =
      upstream.status === 204 || upstream.data == null || upstream.data === ""
        ? new NextResponse(null, { status: upstream.status })
        : NextResponse.json(upstream.data, { status: upstream.status });

    if (
      upstreamPath.includes("/branches/") &&
      upstreamPath.endsWith("/tables") &&
      upstream.status >= 200 &&
      upstream.status < 300
    ) {
      // #region agent log
      agentDebugLogServer({
        hypothesisId: "H3",
        location: "waiter-authenticated-proxy.ts",
        message: "branch tables proxy ok",
        data: {
          app,
          upstreamPath,
          status: upstream.status,
          tokenStaffId: getStaffIdFromAccessToken(refreshedTokens?.accessToken ?? accessToken),
        },
        runId: "post-fix",
      });
      // #endregion
    }

    if (refreshedTokens) {
      setStaffAuthCookies(
        response as NextResponse,
        app,
        refreshedTokens.accessToken,
        refreshedTokens.refreshToken,
        refreshedTokens.staffId,
      );
    }

    return response;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.code === "ECONNABORTED") {
        agentDebugLogServer({
          hypothesisId: "H17",
          location: "waiter-authenticated-proxy.ts",
          message: "upstream timeout",
          data: { upstreamPath, apiBase: API_BASE_URL },
          runId: "post-fix-7",
        });
        return NextResponse.json(upstreamTimeoutMessage(`${API_BASE_URL}${upstreamPath}`), { status: 504 });
      }
      if (error.response) {
        return NextResponse.json(error.response.data ?? {}, { status: error.response.status });
      }
    }

    const isDev = process.env.NODE_ENV !== "production";
    const target = `${API_BASE_URL}${upstreamPath}`;
    if (isDev) {
      const code = error instanceof AxiosError ? error.code : undefined;
      const refused = code === "ECONNREFUSED" || code === "ENOTFOUND";
      return NextResponse.json(
        {
          message: refused
            ? "qr-service'e bağlanılamadı. API_BASE_URL'in qr-service SERVER_PORT ile aynı olduğundan emin olun."
            : "Sunucu hatası",
          code,
          target,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 });
  }
}
