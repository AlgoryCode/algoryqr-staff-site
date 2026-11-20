"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deviceQueryKeys,
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
    mutationFn: async (payload: { session: DeviceSession; kind: "pause" | "resume" | "extend"; minutes?: number }) => {
      if (payload.kind === "pause") return pauseDeviceSession(payload.session.id);
      if (payload.kind === "resume") return resumeDeviceSession(payload.session.id);
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
  };

  const pendingSessionId = sessionAction.isPending ? sessionAction.variables?.session.id ?? null : null;
  const freeCount = devices.filter((device) => !device.busy && !sessionsByDevice.has(device.id)).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {devices.length > 0 ? `${freeCount} boş · ${devices.length - freeCount} dolu` : null}
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
        devices={devices.map((device) => ({ ...device, busy: device.busy || sessionsByDevice.has(device.id) }))}
        onOpenChange={(open) => !open && setTransferring(null)}
        onDone={() => {
          setTransferring(null);
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
