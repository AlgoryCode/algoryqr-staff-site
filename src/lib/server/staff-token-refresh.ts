import { cookies } from "next/headers";

import { getStaffIdFromAccessToken } from "@/lib/auth-user";
import { authUrl } from "@/lib/config";
import { qrServiceAxios } from "@/lib/server/qr-service-axios";
import { agentDebugLogServer } from "@/lib/server/agent-debug-log";
import {
  readStaffRefreshTokenFromCookies,
  type StaffApp,
} from "@/lib/server/waiter-auth-cookies";

export type RefreshedStaffTokens = {
  accessToken: string;
  refreshToken?: string;
  staffId?: number;
};

const refreshInflight: Partial<Record<StaffApp, Promise<RefreshedStaffTokens | null>>> = {};

function readTokensFromRefreshBody(data: Record<string, unknown>): RefreshedStaffTokens | null {
  const accessToken =
    typeof data.accessToken === "string"
      ? data.accessToken
      : typeof data.access_token === "string"
        ? data.access_token
        : undefined;
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken:
      typeof data.refreshToken === "string"
        ? data.refreshToken
        : typeof data.refresh_token === "string"
          ? data.refresh_token
          : undefined,
    staffId: getStaffIdFromAccessToken(accessToken) ?? undefined,
  };
}

async function refreshStaffTokensOnce(app: StaffApp): Promise<RefreshedStaffTokens | null> {
  const cookieStore = await cookies();
  const refreshToken = readStaffRefreshTokenFromCookies(cookieStore, app);
  if (!refreshToken) {
    agentDebugLogServer({
      hypothesisId: "H5",
      location: "staff-token-refresh.ts",
      message: "refresh skipped no refresh cookie",
      data: { app },
      runId: "post-fix-2",
    });
    return null;
  }

  const upstream = await qrServiceAxios.post<Record<string, unknown>>(
    authUrl("refresh"),
    { refreshToken },
    {
      headers: { Accept: "application/json", "Content-Type": "application/json" },
    },
  );

  const data = (typeof upstream.data === "object" && upstream.data != null ? upstream.data : {}) as Record<
    string,
    unknown
  >;

  if (upstream.status < 200 || upstream.status >= 300) {
    agentDebugLogServer({
      hypothesisId: "H12",
      location: "staff-token-refresh.ts",
      message: "upstream refresh failed",
      data: { app, status: upstream.status },
      runId: "post-fix-2",
    });
    return null;
  }

  const tokens = readTokensFromRefreshBody(data);
  if (!tokens) {
    agentDebugLogServer({
      hypothesisId: "H12",
      location: "staff-token-refresh.ts",
      message: "refresh ok but no access token in body",
      data: { app },
      runId: "post-fix-2",
    });
    return null;
  }

  agentDebugLogServer({
    hypothesisId: "H12",
    location: "staff-token-refresh.ts",
    message: "refresh ok",
    data: { app, staffId: tokens.staffId ?? null },
    runId: "post-fix-2",
  });
  return tokens;
}

/** Single in-flight refresh per staff app (avoids rotating refresh token races). */
export function refreshStaffTokensDeduped(app: StaffApp): Promise<RefreshedStaffTokens | null> {
  if (!refreshInflight[app]) {
    refreshInflight[app] = refreshStaffTokensOnce(app).finally(() => {
      refreshInflight[app] = undefined;
    });
  }
  return refreshInflight[app]!;
}

export const STAFF_REFRESH_ATTEMPTED_HEADER = "x-staff-refresh-attempted";
