const TRUSTED_PROXY_IP_HEADERS = ["cf-connecting-ip", "x-vercel-forwarded-for", "x-real-ip"] as const;

function singleIp(value: string | null): string | null {
  if (!value) return null;
  const ip = value.split(",")[0]?.trim() ?? "";
  if (!ip || /\s/.test(ip) || ip.length > 64) return null;
  return ip;
}

/** IP comes from the proxy that accepted the connection, never from the caller X-Forwarded-For list. */
export function trustedClientIp(request: Request): string | null {
  for (const header of TRUSTED_PROXY_IP_HEADERS) {
    const ip = singleIp(request.headers.get(header));
    if (ip) return ip;
  }
  return null;
}

export function trustedForwardedForHeader(request: Request): Record<string, string> {
  const ip = trustedClientIp(request);
  return ip ? { "X-Forwarded-For": ip } : {};
}

/**
 * Upstream builds session rows (device, browser, IP) from these headers. Server-side
 * requests would otherwise describe the Node process instead of the end user's browser.
 */
export function clientContextHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};

  const userAgent = request.headers.get("user-agent");
  if (userAgent) {
    headers["User-Agent"] = userAgent;
  }

  Object.assign(headers, trustedForwardedForHeader(request));

  return headers;
}
