import axios from "axios";

import { resolveRefreshExpiresAt } from "@/lib/auth-user";
import { API_BASE_URL } from "@/lib/config";

type SessionRow = {
  current?: boolean;
  refreshExpiresAt?: string | null;
};

type SessionPage = {
  content?: SessionRow[];
};

export async function fetchCurrentSessionRefreshExpiresAt(
  accessToken: string,
): Promise<number | undefined> {
  try {
    const upstream = await axios.get<SessionPage>(`${API_BASE_URL}/account/sessions`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      params: { page: 0, size: 50 },
      validateStatus: () => true,
      timeout: 10_000,
    });
    if (upstream.status < 200 || upstream.status >= 300) {
      return undefined;
    }
    const rows = Array.isArray(upstream.data?.content) ? upstream.data.content : [];
    const current = rows.find((session) => session.current === true) ?? rows[0];
    const exp = resolveRefreshExpiresAt(null, current?.refreshExpiresAt ?? null);
    return exp ?? undefined;
  } catch {
    return undefined;
  }
}

export async function resolveRefreshCookieExpiry(
  refreshToken: string | undefined,
  refreshExpiresAt: string | null | undefined,
  accessToken: string | undefined,
): Promise<number | undefined> {
  const fromToken = resolveRefreshExpiresAt(refreshToken, refreshExpiresAt);
  if (fromToken != null) return fromToken;
  if (!accessToken) return undefined;
  return fetchCurrentSessionRefreshExpiresAt(accessToken);
}
