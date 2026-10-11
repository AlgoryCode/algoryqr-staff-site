/** Invisible mark stored on the customer name so list payloads can tell phone orders from online ones. */
export const PHONE_ORDER_MARK = "\u2060";

export function markPhoneCustomerName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  return trimmed.includes(PHONE_ORDER_MARK) ? trimmed : `${trimmed}${PHONE_ORDER_MARK}`;
}

export function isPhoneCustomerName(name?: string | null): boolean {
  return (name ?? "").includes(PHONE_ORDER_MARK);
}

export function stripPhoneCustomerName(name?: string | null): string {
  return (name ?? "").replaceAll(PHONE_ORDER_MARK, "").trim();
}
