"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  BellRing,
  CalendarClock,
  Check,
  Gamepad2,
  Package,
  Pause,
  Play,
  Plus,
  ShoppingBag,
  Square,
  Timer,
  Wrench,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  deviceTypeLabel,
  deviceUsesControllers,
  formatClock,
  formatCountdown,
  formatDeviceMoney,
  formatIstanbulDateTime,
  formatIstanbulTime,
  formatMinutes,
  liveElapsedSeconds,
  remainingSeconds,
  type Device,
  type DeviceSession,
} from "@/lib/device-rental";
import { cn } from "@/lib/utils";

import { DeviceTypeIcon, deviceCardClass } from "./device-ui";

export type DeviceCardActions = {
  onStart: (device: Device) => void;
  onPauseToggle: (session: DeviceSession) => void;
  onExtend: (session: DeviceSession, minutes: number) => void;
  onTransfer: (session: DeviceSession) => void;
  onItems: (session: DeviceSession) => void;
  onFinish: (session: DeviceSession) => void;
  onMaintenance: (device: Device, mode: "start" | "end") => void;
  onExtensionRequest: (session: DeviceSession, approve: boolean) => void;
};

export function DeviceCard({
  device,
  session,
  fetchedAt,
  now,
  pending,
  actions,
}: {
  device: Device;
  session: DeviceSession | null;
  fetchedAt: number;
  now: number;
  pending: boolean;
  actions: DeviceCardActions;
}) {
  const busy = session != null || device.busy;
  const maintenance = device.maintenance === true && session == null;
  const elapsed = session ? liveElapsedSeconds(session, fetchedAt, now) : 0;
  const remaining = session ? remainingSeconds(session.plannedMinutes, elapsed) : null;
  const overtime = remaining != null && remaining <= 0;
  const next = device.nextReservation?.status === "BOOKED" ? device.nextReservation : null;

  return (
    <article
      className={cn(
        deviceCardClass,
        !busy && !maintenance && "border-emerald-700/30",
        maintenance && "border-amber-500/50 bg-amber-50/60 dark:bg-amber-950/20",
        busy && !overtime && "border-primary/40 ring-1 ring-primary/10",
        overtime && "border-red-600 bg-red-50 ring-2 ring-red-500/40 dark:bg-red-950/30",
      )}
    >
      <header className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            busy
              ? "bg-primary/10 text-primary"
              : maintenance
                ? "bg-amber-100 text-amber-900"
                : "bg-emerald-100 text-emerald-900",
          )}
        >
          <DeviceTypeIcon type={device.deviceType} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{device.name}</h3>
          <p className="text-xs text-muted-foreground">{deviceTypeLabel(device.deviceType)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
              busy
                ? "bg-red-500 text-white"
                : maintenance
                  ? "bg-amber-300 text-amber-950"
                  : "bg-emerald-200 text-emerald-950",
            )}
          >
            {busy ? "Dolu" : maintenance ? "Bakımda" : "Boş"}
          </span>
          {session?.paused ? (
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
              Duraklatıldı
            </span>
          ) : null}
        </div>
      </header>

      {session ? (
        <div className="space-y-2">
          <p className="truncate text-sm">
            <span className="font-medium">{session.customerName?.trim() || "Misafir"}</span>
            {deviceUsesControllers(session.deviceType ?? device.deviceType) ? (
              <span className="text-muted-foreground"> · {session.controllerCount} kol</span>
            ) : null}
          </p>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[11px] text-muted-foreground">Geçen süre</p>
              <p className="text-2xl font-semibold tabular-nums">{formatClock(elapsed)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">Tutar</p>
              <p className="text-lg font-semibold tabular-nums">{formatDeviceMoney(session.amount ?? session.grossAmount)}</p>
            </div>
          </div>
          {remaining != null ? (
            <p
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium tabular-nums",
                overtime ? "text-red-600" : "text-muted-foreground",
              )}
            >
              <Timer className="h-3.5 w-3.5" />
              {overtime ? `Süre doldu · ${formatCountdown(remaining)}` : `Kalan ${formatCountdown(remaining)}`}
              <span className="font-normal text-muted-foreground">/ {formatMinutes(session.plannedMinutes)}</span>
            </p>
          ) : null}
          {session.packageName || session.gameName ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {session.packageName ? (
                <span className="flex min-w-0 items-center gap-1">
                  <Package className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{session.packageName}</span>
                </span>
              ) : null}
              {session.gameName ? (
                <span className="flex min-w-0 items-center gap-1">
                  <Gamepad2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{session.gameName}</span>
                </span>
              ) : null}
            </p>
          ) : null}
          {session.note?.trim() ? <p className="truncate text-xs text-amber-800">{session.note.trim()}</p> : null}
          {session.extensionRequestMinutes ? (
            <div className="flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-50 px-2 py-1.5 text-xs dark:bg-sky-950/30">
              <BellRing className="h-3.5 w-3.5 shrink-0 text-sky-700" />
              <span className="min-w-0 flex-1 font-medium text-sky-900 dark:text-sky-200">
                QR: +{formatMinutes(session.extensionRequestMinutes)} istendi
              </span>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2"
                disabled={pending}
                onClick={() => actions.onExtensionRequest(session, true)}
              >
                <Check />
                Onayla
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2"
                disabled={pending}
                onClick={() => actions.onExtensionRequest(session, false)}
              >
                <X />
                Reddet
              </Button>
            </div>
          ) : null}
        </div>
      ) : maintenance ? (
        <div className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
          <p className="flex items-center gap-1.5 font-medium">
            <Wrench className="h-3.5 w-3.5" />
            Bakımda{device.maintenanceSince ? ` · başlangıç ${formatIstanbulDateTime(device.maintenanceSince)}` : ""}
          </p>
          {device.maintenanceNote?.trim() ? <p className="truncate">{device.maintenanceNote.trim()}</p> : null}
          <p className="text-muted-foreground">Bakımdaki cihazda oturum başlatılamaz.</p>
        </div>
      ) : busy ? (
        <p className="text-xs text-muted-foreground">Oturum bilgisi yükleniyor…</p>
      ) : null}

      {next ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Rezervasyon {formatIstanbulTime(next.startsAt)}
            {next.customerName ? ` · ${next.customerName}` : ""}
          </span>
        </p>
      ) : null}

      <div className="mt-auto">
        {session ? (
          <BusyActions session={session} pending={pending} actions={actions} />
        ) : maintenance ? (
          <Button type="button" variant="outline" className="w-full" onClick={() => actions.onMaintenance(device, "end")}>
            <Wrench />
            Bakımı bitir
          </Button>
        ) : !busy ? (
          <div className="flex gap-2">
            <Button type="button" className="flex-1" disabled={pending} onClick={() => actions.onStart(device)}>
              <Play />
              Başlat
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Bakıma al"
              title="Bakıma al"
              onClick={() => actions.onMaintenance(device, "start")}
            >
              <Wrench />
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function BusyActions({
  session,
  pending,
  actions,
}: {
  session: DeviceSession;
  pending: boolean;
  actions: DeviceCardActions;
}) {
  const [extendOpen, setExtendOpen] = useState(false);
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => actions.onPauseToggle(session)}>
        {session.paused ? <Play /> : <Pause />}
        {session.paused ? "Devam" : "Duraklat"}
      </Button>
      <Popover open={extendOpen} onOpenChange={setExtendOpen}>
        <PopoverTrigger asChild>
          <Button type="button" size="sm" variant="outline" disabled={pending}>
            <Plus />
            Süre ekle
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44">
          <div className="grid grid-cols-3 gap-1.5">
            {[15, 30, 60].map((minutes) => (
              <Button
                key={minutes}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setExtendOpen(false);
                  actions.onExtend(session, minutes);
                }}
              >
                +{minutes}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => actions.onTransfer(session)}>
        <ArrowLeftRight />
        Cihaz değiştir
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => actions.onItems(session)}>
        <ShoppingBag />
        Ürün ekle
        {session.items && session.items.length > 0 ? (
          <span className="rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">{session.items.length}</span>
        ) : null}
      </Button>
      <Button
        type="button"
        size="sm"
        className="col-span-2"
        variant="destructive"
        disabled={pending}
        onClick={() => actions.onFinish(session)}
      >
        <Square />
        Bitir
      </Button>
    </div>
  );
}
