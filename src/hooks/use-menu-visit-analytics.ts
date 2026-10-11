"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  detectMenuDeviceType,
  getOrCreateMenuSessionId,
  nextMenuEventSequence,
  postMenuAnalyticsEvents,
  type MenuAnalyticsDeviceType,
  type MenuAnalyticsEventItem,
  type MenuAnalyticsEventType,
} from "@/lib/menu-analytics";

const CATEGORY_DEBOUNCE_MS = 400;

export type MenuVisitAnalytics = {
  trackCategoryView: (categoryId: number | null | undefined) => void;
  trackProductView: (productId: number, categoryId?: number | null) => void;
  trackServesFilter: (servesPeople: number) => void;
};

export function useMenuVisitAnalytics(publicId: string | null | undefined): MenuVisitAnalytics {
  const sessionIdRef = useRef<string>("");
  const deviceTypeRef = useRef<MenuAnalyticsDeviceType>("DESKTOP");
  const queueRef = useRef<MenuAnalyticsEventItem[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCategoryRef = useRef<number | null>(null);
  const openedRef = useRef(false);

  const flush = useCallback(() => {
    if (!publicId || queueRef.current.length === 0) {
      return;
    }
    const batch = queueRef.current.splice(0, queueRef.current.length);
    postMenuAnalyticsEvents(publicId, sessionIdRef.current, batch, deviceTypeRef.current);
  }, [publicId]);

  const enqueue = useCallback(
    (type: MenuAnalyticsEventType, extras: Partial<MenuAnalyticsEventItem> = {}) => {
      if (!publicId) {
        return;
      }
      if (!sessionIdRef.current) {
        sessionIdRef.current = getOrCreateMenuSessionId(publicId);
      }
      queueRef.current.push({
        type,
        sequence: nextMenuEventSequence(publicId),
        occurredAt: new Date().toISOString().slice(0, 19),
        ...extras,
      });
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      flushTimerRef.current = setTimeout(() => {
        flush();
        flushTimerRef.current = null;
      }, 250);
    },
    [flush, publicId],
  );

  useEffect(() => {
    if (!publicId || openedRef.current) {
      return;
    }
    openedRef.current = true;
    sessionIdRef.current = getOrCreateMenuSessionId(publicId);
    deviceTypeRef.current = detectMenuDeviceType();
    enqueue("MENU_OPEN");
    return () => {
      if (categoryTimerRef.current) {
        clearTimeout(categoryTimerRef.current);
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      flush();
    };
  }, [enqueue, flush, publicId]);

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush]);

  const trackCategoryView = useCallback(
    (categoryId: number | null | undefined) => {
      if (categoryId == null) {
        return;
      }
      if (lastCategoryRef.current === categoryId) {
        return;
      }
      if (categoryTimerRef.current) {
        clearTimeout(categoryTimerRef.current);
      }
      categoryTimerRef.current = setTimeout(() => {
        lastCategoryRef.current = categoryId;
        enqueue("CATEGORY_VIEW", { categoryId });
        categoryTimerRef.current = null;
      }, CATEGORY_DEBOUNCE_MS);
    },
    [enqueue],
  );

  const trackProductView = useCallback(
    (productId: number, categoryId?: number | null) => {
      enqueue("PRODUCT_VIEW", {
        productId,
        ...(categoryId != null ? { categoryId } : {}),
      });
    },
    [enqueue],
  );

  const trackServesFilter = useCallback(
    (servesPeople: number) => {
      if (!Number.isFinite(servesPeople) || servesPeople < 1) {
        return;
      }
      enqueue("SERVES_FILTER", { servesPeople });
    },
    [enqueue],
  );

  return { trackCategoryView, trackProductView, trackServesFilter };
}
