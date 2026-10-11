import { MENU_APP_ORIGIN } from "@/lib/config";
import { publicMenuContentPath } from "@/lib/public-menu-paths";

function withContentPath(url: string): string {
  const match = url.match(/^([^?#]*)(.*)$/);
  const pathname = (match?.[1] ?? url).replace(/\/$/, "");
  const suffix = match?.[2] ?? "";
  if (pathname.endsWith("/content")) return `${pathname}${suffix}`;
  if (/\/menu\/[^/]+$/.test(pathname)) return `${pathname}/content${suffix}`;
  return `${pathname}${suffix}`;
}

function absoluteMenuHref(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${MENU_APP_ORIGIN}${normalized}`;
}

/**
 * Builds the stable "Menüyü aç" href. The API may return a dashboard, localhost,
 * or legacy QR host, but public menu links always point at menu.algorycode.com.
 */
export function resolvePublicMenuHref(options: {
  publicUrl?: string | null;
  publicId?: string | null;
}): string {
  const publicId = options.publicId?.trim() || "";
  const raw = options.publicUrl?.trim();

  if (raw) {
    if (/^https?:\/\//i.test(raw)) {
      try {
        const parsed = new URL(raw);
        if (publicId) return absoluteMenuHref(publicMenuContentPath(publicId));
        return absoluteMenuHref(withContentPath(`${parsed.pathname}${parsed.search}`));
      } catch {
        return absoluteMenuHref(withContentPath(raw));
      }
    }
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    const contentPath = path.includes("/content") ? path : withContentPath(path);
    return absoluteMenuHref(contentPath);
  }

  if (!publicId) return "";
  return absoluteMenuHref(publicMenuContentPath(publicId));
}
