import { ApiError } from "@/lib/api/errors";

const NETWORK_CODES = new Set(["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT", "ECONNRESET"]);

export function isServerFailure(error: unknown): boolean {
  const status = statusOf(error);
  if (status != null) return status === 0 || status >= 500;
  return isNetworkError(error);
}

export function isServerStatus(status: number): boolean {
  return status === 0 || status >= 500;
}

function statusOf(error: unknown): number | null {
  if (error instanceof ApiError) return error.status;
  if (!error || typeof error !== "object") return null;
  const record = error as { status?: unknown; response?: { status?: unknown } | null };
  if (typeof record.status === "number") return record.status;
  if (record.response && typeof record.response.status === "number") return record.response.status;
  if ("response" in record && record.response == null) return 0;
  return null;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && NETWORK_CODES.has(code);
}
