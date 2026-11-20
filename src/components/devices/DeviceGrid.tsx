"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveDeviceExtension,
  deviceQueryKeys,
  dismissDeviceExtension,
  extendDeviceSession,
  invalidateDeviceData,
  listActiveDeviceSessions,
  listDevices,
  pauseDeviceSession,
  resumeDeviceSession,
} from "@/lib/device-api";
import { liveElapsedSeconds, remainingSeconds, type Device, type DeviceSession } from "@/lib/device-rental";

import { DeviceCard, type DeviceCardActions } from "./DeviceCard";
import { ErrorText, playTimeUpBeep, useNow } from "./device-ui";
import { FinishDialog } from "./FinishDialog";
import { ItemsDialog } from "./ItemsDialog";
import { MaintenanceDialog, type MaintenanceTarget } from "./MaintenanceDialog";
import { StartSessionDialog } from "./StartSessionDialog";
import { TransferDialog } from "./TransferDialog";

const REFRESH_MS = 30_000;

export function DeviceGrid() {
  const queryClient = useQueryClient();
  const now = useNow(1000);
  const [starting, setStarting] = useState<Device | null>(null);
  const [transferring, setTransferring] = useState<DeviceSession | null>(null);
  const [itemsFor, setItemsFor] = useState<DeviceSession | null>(null);
  const [finishing, setFinishing] = useState<DeviceSession | null>(null);
  const [maintenanceTarget, setMaintenanceTarget] = useState<MaintenanceTarget | null>(null);

  const devicesQuery = useQuery({
    queryKey: deviceQueryKeys.devices,
    queryFn: listDevices,
    retry: false,
    refetchInterval: REFRESH_MS,
  });
  const activeQuery = useQuery({
    queryKey: deviceQueryKeys.active,
    queryFn: listActiveDeviceSessions,
    retry: false,
    refetchInterval: REFRESH_MS,
  });

  const refresh = () => invalidateDeviceData(queryClient);

  const sessionAction = useMutation({
    mutationFn: async (payload: {
      session: DeviceSession;
      kind: "pause" | "resume" | "extend" | "approve" | "dismiss";
      minutes?: number;
    }) => {
      if (payload.kind === "pause") return pauseDeviceSession(payload.session.id);
      if (payload.kind === "resume") return resumeDeviceSession(payload.session.id);
      if (payload.kind === "approve") return approveDeviceExtension(payload.session.id);
      if (payload.kind === "dismiss") return dismissDeviceExtension(payload.session.id);
      return extendDeviceSession(payload.session.id, payload.minutes ?? 15);
    },
    onSettled: () => void refresh(),
  });

  const sessionsByDevice = useMemo(() => {
    const map = new Map<number, DeviceSession>();
    for (const session of activeQuery.data ?? []) map.set(session.consoleId, session);
    return map;
  }, [activeQuery.data]);

  const devices = useMemo(
    () =>
      [...(devicesQuery.data ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, "tr-TR", { numeric: true, sensitivity: "base" }),
      ),
    [devicesQuery.data],
  );

  // Beep once per session when its planned time runs out while this screen is open.
  const lastRemaining = useRef(new Map<number, number>());
  const fetchedAt = activeQuery.dataUpdatedAt;
  useEffect(() => {
    const seen = lastRemaining.current;
    let fire = false;
    const live = new Set<number>();
    for (const session of activeQuery.data ?? []) {
      live.add(session.id);
      const remaining = remainingSeconds(session.plannedMinutes, liveElapsedSeconds(session, fetchedAt, now));
      if (remaining == null) {
        seen.delete(session.id);
        continue;
      }
      const before = seen.get(session.id);
      if (before != null && before > 0 && remaining <= 0) fire = true;
      seen.set(session.id, remaining);
    }
    for (const id of [...seen.keys()]) if (!live.has(id)) seen.delete(id);
    if (fire) playTimeUpBeep();
  }, [activeQuery.data, fetchedAt, now]);

  const actions: DeviceCardActions = {
    onStart: setStarting,
    onPauseToggle: (session) => sessionAction.mutate({ session, kind: session.paused ? "resume" : "pause" }),
    onExtend: (session, minutes) => sessionAction.mutate({ session, kind: "extend", minutes }),
    onTransfer: setTransferring,
    onItems: setItemsFor,
    onFinish: setFinishing,
    onMaintenance: (device, mode) => setMaintenanceTarget({ device, mode }),
    onExtensionRequest: (session, approve) => sessionAction.mutate({ session, kind: approve ? "approve" : "dismiss" }),
  };

  const pendingSessionId = sessionAction.isPending ? sessionAction.variables?.session.id ?? null : null;
  const isOccupied = (device: Device) => device.busy || sessionsByDevice.has(device.id);
  const maintenanceCount = devices.filter((device) => device.maintenance === true && !isOccupied(device)).length;
  const freeCount = devices.filter((device) => !isOccupied(device) && device.maintenance !== true).length;
  const busyCount = devices.length - freeCount - maintenanceCount;
  const requestCount = (activeQuery.data ?? []).filter((session) => (session.extensionRequestMinutes ?? 0) > 0).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {devices.length > 0
          ? `${freeCount} boş · ${busyCount} dolu${maintenanceCount > 0 ? ` · ${maintenanceCount} bakımda` : ""}`
          : null}
        {requestCount > 0 ? (
          <span className="ml-2 rounded-full bg-sky-600 px-2 py-0.5 text-[11px] font-semibold text-white">
            {requestCount} süre isteği
          </span>
        ) : null}
      </p>

      <ErrorText error={devicesQuery.error ?? activeQuery.error ?? sessionAction.error} />

      {devicesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Cihazlar yükleniyor…</p>
      ) : devices.length === 0 && !devicesQuery.isError ? (
        <p className="text-sm text-muted-foreground">Bu şubede tanımlı cihaz yok. Cihazları yönetim panelinden ekleyin.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => {
            const session = sessionsByDevice.get(device.id) ?? null;
            return (
              <li key={device.id} className="flex">
                <div className="flex w-full flex-col [&>article]:flex-1">
                  <DeviceCard
                    device={device}
                    session={session}
                    fetchedAt={fetchedAt}
                    now={now}
                    pending={session != null && pendingSessionId === session.id}
                    actions={actions}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <StartSessionDialog
        device={starting}
        onOpenChange={(open) => !open && setStarting(null)}
        onStarted={() => {
          setStarting(null);
          void refresh();
        }}
      />
      <TransferDialog
        session={transferring}
        devices={devices.map((device) => ({ ...device, busy: isOccupied(device) || device.maintenance === true }))}
        onOpenChange={(open) => !open && setTransferring(null)}
        onDone={() => {
          setTransferring(null);
          void refresh();
        }}
      />
      <MaintenanceDialog
        target={maintenanceTarget}
        onOpenChange={(open) => !open && setMaintenanceTarget(null)}
        onDone={() => {
          setMaintenanceTarget(null);
          void refresh();
        }}
      />
      <ItemsDialog session={itemsFor} onOpenChange={(open) => !open && setItemsFor(null)} onChanged={() => void refresh()} />
      <FinishDialog
        session={finishing}
        onOpenChange={(open) => !open && setFinishing(null)}
        onFinished={() => void refresh()}
      />
    </div>
  );
}
