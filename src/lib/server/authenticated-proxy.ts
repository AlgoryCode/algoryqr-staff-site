import axios, { AxiosError } from "axios";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getUserIdFromAccessToken } from "@/lib/auth-user";
import { API_BASE_URL } from "@/lib/config";
import { readAccessTokenFromCookies } from "@/lib/server/auth-cookies";
import { clientContextHeaders } from "@/lib/server/client-headers";

export async function proxyAuthenticatedRequest(
  request: Request,
  upstreamPath: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  options?: { timeoutMs?: number },
) {
  try {
    const cookieStore = await cookies();
    const accessToken = readAccessTokenFromCookies(cookieStore);
    if (!accessToken) {
      return NextResponse.json({ message: "Oturum gerekli" }, { status: 401 });
    }

    const userId = getUserIdFromAccessToken(accessToken);
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

    const upstream = await axios.request({
      url: `${API_BASE_URL}${upstreamPath}${query}`,
      method,
      data,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(writesJson ? { "Content-Type": "application/json" } : {}),
        ...(userId != null ? { "X-User-Id": String(userId) } : {}),
        ...clientContextHeaders(request),
      },
      validateStatus: () => true,
      timeout: options?.timeoutMs ?? 20_000,
    });

    if (upstream.status === 204 || upstream.data == null || upstream.data === "") {
      return new NextResponse(null, { status: upstream.status });
    }
    return NextResponse.json(upstream.data, { status: upstream.status });
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
