"use client";

import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

import { getJsonErrorText } from "@/lib/api-error-text";
import { ApiError } from "@/lib/api/errors";
import { recordFlow } from "@/lib/flow-log";
import { clearPackageAccess, loadPackageAccess } from "@/lib/load-package-access";

let refreshPromise: Promise<boolean> | null = null;

const EMAIL_NOT_VERIFIED_CODE = "EMAIL_NOT_VERIFIED";

const PUBLIC_AUTH_API_PATHS = [
  "/auth/login",
  "/auth/logout",
  "/auth/register",
  "/auth/refresh",
  "/auth/demo-account",
  "/auth/demo/register",
  "/auth/demo/login",
  "/auth/demo/username-available",
  "/auth/2fa/login/verify",
  "/auth/email-verification/resend",
  "/auth/email-verification/verify",
] as const;

function isPublicAuthApiPath(url: string): boolean {
  return PUBLIC_AUTH_API_PATHS.some((path) => url.includes(path));
}

function isEmailNotVerified(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  return (data as { code?: unknown }).code === EMAIL_NOT_VERIFIED_CODE;
}

export async function refreshSiteSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const r = await axios.post("/api/auth/refresh", {}, {
          withCredentials: true,
          validateStatus: (s) => s < 500,
        });
        recordFlow({
          scope: "api",
          method: "POST",
          path: "/api/auth/refresh",
          status: r.status,
          body: r.data,
        });
        if (r.status === 401) {
          clearPackageAccess();
          await axios.post("/api/auth/logout", {}, { withCredentials: true, validateStatus: () => true }).catch(() => undefined);
          if (window.location.pathname !== "/login") {
            window.location.assign("/login");
          }
          return false;
        }
        if (r.status >= 200 && r.status < 300) {
          void loadPackageAccess(true);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

type SiteRetryCfg = InternalAxiosRequestConfig & { __site401Retried?: boolean; __flowStarted?: number };

let siteInstance: AxiosInstance | null = null;

function toApiError(error: AxiosError): ApiError {
  const status = error.response?.status ?? 0;
  const msg =
    getJsonErrorText(error.response?.data) || error.message || "Bir hata oluştu";
  return new ApiError(status, msg, error.response?.data);
}

export function getSiteSameOriginAxios(): AxiosInstance {
  if (siteInstance) return siteInstance;
  siteInstance = axios.create({
    baseURL: "/api",
    timeout: 15_000,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    withCredentials: true,
  });
  siteInstance.interceptors.request.use((config) => {
    (config as SiteRetryCfg).__flowStarted = Date.now();
    return config;
  });
  siteInstance.interceptors.response.use(
    (response) => {
      const config = response.config as SiteRetryCfg;
      recordFlow({
        scope: "api",
        method: (config.method || "GET").toUpperCase(),
        path: `${config.baseURL ?? ""}${config.url ?? ""}`,
        status: response.status,
        durationMs: config.__flowStarted ? Date.now() - config.__flowStarted : 0,
        request: config.data,
        body: response.data,
      });
      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as SiteRetryCfg | undefined;
      recordFlow({
        scope: "api",
        method: (config?.method || "GET").toUpperCase(),
        path: `${config?.baseURL ?? ""}${config?.url ?? ""}`,
        status: error.response?.status ?? 0,
        durationMs: config?.__flowStarted ? Date.now() - config.__flowStarted : 0,
        request: config?.data,
        body: error.response?.data ?? error.message,
      });
      const status = error.response?.status;
      const cfg = error.config as SiteRetryCfg | undefined;
      const requestUrl = `${cfg?.baseURL ?? ""}${cfg?.url ?? ""}`;
      if (
        typeof window !== "undefined"
        && status === 403
        && isEmailNotVerified(error.response?.data)
        && !isPublicAuthApiPath(requestUrl)
      ) {
        clearPackageAccess();
        await axios
          .post("/api/auth/logout", {}, { withCredentials: true, validateStatus: () => true })
          .catch(() => undefined);
        window.location.assign("/login?verify=1");
        return Promise.reject(toApiError(error));
      }
      if (typeof window !== "undefined" && status === 401 && cfg && !cfg.__site401Retried) {
        if (!isPublicAuthApiPath(requestUrl)) {
          cfg.__site401Retried = true;
          const ok = await refreshSiteSession();
          if (ok) {
            return siteInstance!.request(cfg);
          }
        }
      }
      return Promise.reject(toApiError(error));
    },
  );
  return siteInstance;
}
