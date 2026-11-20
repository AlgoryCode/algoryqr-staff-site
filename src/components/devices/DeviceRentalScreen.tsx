"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { deviceQueryKeys, isDeviceRentalNotEnabledError, listDevices } from "@/lib/device-api";
import { cn } from "@/lib/utils";

import { CustomersPanel } from "./CustomersPanel";
import { DeviceGrid } from "./DeviceGrid";
import { HistoryPanel } from "./HistoryPanel";
import { ReservationsPanel } from "./ReservationsPanel";

type DeviceTab = "devices" | "reservations" | "customers" | "history";

const TABS: { key: DeviceTab; label: string }[] = [
  { key: "devices", label: "Cihazlar" },
  { key: "reservations", label: "Rezervasyonlar" },
  { key: "customers", label: "Müşteriler" },
  { key: "history", label: "Son oturumlar" },
];

/**
 * Whether Oyun & Cihaz Takip is on for this business. The staff app has no package snapshot of its own, so it asks
 * the device list once: a 403 FEATURE_NOT_IN_PLAN / NO_ACTIVE_PLAN (or a missing endpoint) means the add-on is off.
 * Shares its cache with the device grid.
 */
export function useDeviceRentalAccess(enabled: boolean): boolean {
  const probe = useQuery({
    queryKey: deviceQueryKeys.devices,
    queryFn: listDevices,
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
  return probe.data != null && !isDeviceRentalNotEnabledError(probe.error);
}

export function DeviceRentalScreen() {
  const [tab, setTab] = useState<DeviceTab>("devices");
  const probe = useQuery({ queryKey: deviceQueryKeys.devices, queryFn: listDevices, retry: false });

  if (isDeviceRentalNotEnabledError(probe.error)) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
        <h1 className="text-xl font-semibold">Oyun & Cihaz Takip aktif değil</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bu eklenti işletmenin paketinde yok. Yöneticinize danışın.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Oyun & Cihaz Takip</h1>
        <p className="text-sm text-muted-foreground">Saatlik cihaz kiralama · süre, ürün ve ödeme</p>
      </div>
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Cihaz takip bölümleri"
      >
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={cn(
              "shrink-0 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors",
              tab === item.key ? "border-primary bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted/60",
            )}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "devices" ? <DeviceGrid /> : null}
      {tab === "reservations" ? <ReservationsPanel /> : null}
      {tab === "customers" ? <CustomersPanel /> : null}
      {tab === "history" ? <HistoryPanel /> : null}
    </div>
  );
}
