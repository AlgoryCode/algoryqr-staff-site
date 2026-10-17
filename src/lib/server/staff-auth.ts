import { AxiosError } from "axios";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getBranchIdFromAccessToken,
  getMerchantIdFromAccessToken,
  getStaffIdFromAccessToken,
  parseNumericId,
} from "@/lib/auth-user";
import { authUrl } from "@/lib/config";
import { agentDebugLogServer } from "@/lib/server/agent-debug-log";
import { clientContextHeaders } from "@/lib/server/client-headers";
import { qrServiceAxios, upstreamTimeoutMessage } from "@/lib/server/qr-service-axios";
import { refreshStaffTokensDeduped } from "@/lib/server/staff-token-refresh";
import {
  clearStaffAuthCookies,
  readStaffAccessTokenFromCookies,
  readStaffRefreshTokenFromCookies,
  setStaffAuthCookies,
  staffAppFromRequest,
} from "@/lib/server/waiter-auth-cookies";

function readMerchantId(value: unknown): number | null {
  return parseNumericId(value);
}

function staffIdFromAccessTokenOnly(accessToken: string): number | undefined {
  return getStaffIdFromAccessToken(accessToken) ?? undefined;
}

function readTokensFromBody(data: Record<string, unknown>): {
  accessToken?: string;
  refreshToken?: string;
} {
  const accessRaw = data.accessToken ?? data.access_token;
  const refreshRaw = data.refreshToken ?? data.refresh_token;
  return {
    accessToken: typeof accessRaw === "string" && accessRaw ? accessRaw : undefined,
    refreshToken: typeof refreshRaw === "string" && refreshRaw ? refreshRaw : undefined,
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
      return NextResponse.json(upstreamTimeoutMessage(authUrl("staffLogin")), { status: 504 });
    }
    if (error.response) {
      return NextResponse.json(error.response.data ?? {}, { status: error.response.status });
    }
  }
  return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 });
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

  const app = staffAppFromRequest(request);

  try {
    const upstream = await qrServiceAxios.post<Record<string, unknown>>(
      authUrl("staffLogin"),
      { merchantId, username, password },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...clientContextHeaders(request),
        },
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

    const { accessToken, refreshToken } = readTokensFromBody(data);
    if (!accessToken) {
      return NextResponse.json({ message: "Oturum token'ları alınamadı" }, { status: 502 });
    }

    const staffId = staffIdFromAccessTokenOnly(accessToken);
    if (staffId == null) {
      // #region agent log
      agentDebugLogServer({
        hypothesisId: "H4",
        location: "staff-auth.ts:handleLogin",
        message: "login rejected missing staffId in JWT",
        data: { app, hasRefresh: Boolean(refreshToken) },
        runId: "post-fix-2",
      });
      // #endregion
      return NextResponse.json({ message: "Personel kimliği access token içinde yok" }, { status: 502 });
    }

    const responseBody: Record<string, string> = { accessToken };
    if (refreshToken) responseBody.refreshToken = refreshToken;
    const response = NextResponse.json(responseBody);
    setStaffAuthCookies(response, app, accessToken, refreshToken, staffId);
    // #region agent log
    agentDebugLogServer({
      hypothesisId: "H4",
      location: "staff-auth.ts:handleLogin",
      message: "login ok cookies set",
      data: {
        app,
        staffId,
        branchId: getBranchIdFromAccessToken(accessToken),
        merchantId: getMerchantIdFromAccessToken(accessToken),
        hasRefresh: Boolean(refreshToken),
      },
      runId: "post-fix-2",
    });
    // #endregion
    return response;
  } catch (error) {
    return upstreamError(error);
  }
}

async function handleRefresh(request: Request) {
  const app = staffAppFromRequest(request);
  try {
    const tokens = await refreshStaffTokensDeduped(app);
    if (!tokens) {
      // #region agent log
      agentDebugLogServer({
        hypothesisId: "H12",
        location: "staff-auth.ts:handleRefresh",
        message: "refresh route failed (cookies kept)",
        data: { app },
        runId: "post-fix-2",
      });
      // #endregion
      return NextResponse.json({ message: "Oturum gerekli" }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true });
    setStaffAuthCookies(
      response,
      app,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.staffId,
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
      await qrServiceAxios.post(
        authUrl("logout"),
        { refreshToken },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            ...clientContextHeaders(request),
          },
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

async function handlePing(request: Request) {
  const app = staffAppFromRequest(request);
  const cookieStore = await cookies();
  const access = readStaffAccessTokenFromCookies(cookieStore, app);
  const refresh = readStaffRefreshTokenFromCookies(cookieStore, app);
  const ok = Boolean(access || refresh);
  // #region agent log
  agentDebugLogServer({
    hypothesisId: "H16",
    location: "staff-auth.ts:handlePing",
    message: ok ? "staff auth cookies present" : "staff auth cookies missing",
    data: { app, hasAccess: Boolean(access), hasRefresh: Boolean(refresh) },
    runId: "post-fix-6",
  });
  // #endregion
  if (!ok) {
    return NextResponse.json({ message: "Oturum gerekli" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}

export async function handleStaffAuth(
  request: Request,
  method: string,
  key: string,
): Promise<NextResponse | null> {
  if (method === "GET" && key === "auth/ping") return handlePing(request);
  if (method === "POST" && key === "auth/login") return handleLogin(request);
  if (method === "POST" && key === "auth/refresh") return handleRefresh(request);
  if (method === "POST" && key === "auth/logout") return handleLogout(request);
  return null;
}
