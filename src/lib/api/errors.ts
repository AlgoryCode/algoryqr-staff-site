export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function getApiErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.data == null || typeof error.data !== "object") {
    return null;
  }
  const code = (error.data as { code?: unknown }).code;
  return typeof code === "string" && code.trim() ? code : null;
}
