function firstStringFromErrorMap(errors: Record<string, unknown>): string {
  for (const v of Object.values(errors)) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return String(v[0]).trim();
  }
  return "";
}

/** AuthService / qr-service ErrorResponse veya ProblemDetail benzeri gövdelerden okunabilir metin. */
export function getJsonErrorText(data: unknown): string {
  if (data == null || typeof data !== "object") return "";
  const o = data as Record<string, unknown>;

  const fe = o.fieldErrors;
  if (fe && typeof fe === "object") {
    const fromFieldErrors = firstStringFromErrorMap(fe as Record<string, unknown>);
    if (fromFieldErrors) return fromFieldErrors;
  }

  const fieldMap = o.errors;
  if (fieldMap && typeof fieldMap === "object" && !Array.isArray(fieldMap)) {
    const fromFieldMap = firstStringFromErrorMap(fieldMap as Record<string, unknown>);
    if (fromFieldMap) return fromFieldMap;
  }

  if (Array.isArray(o.errors) && o.errors.length > 0) {
    const first = o.errors[0];
    if (typeof first === "string" && first.trim()) return first.trim();
  }

  if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  if (typeof o.detail === "string" && o.detail.trim()) return o.detail.trim();

  return "";
}

export const TOTP_WRONG_USER_MESSAGE = "2FA kodu hatalı.";

/** Yanlış TOTP (AuthService veya eski 500 sarmalanmış 401 metni). */
export function isLikelyWrongTotpBackendText(text: string): boolean {
  const t = text.toLowerCase();
  if (t.includes("invalid verification code")) return true;
  if (t.includes("401 unauthorized") && t.includes("invalid verification")) return true;
  return false;
}
