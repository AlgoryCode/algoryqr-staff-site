"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeftRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { transferDeviceSession } from "@/lib/device-api";
import { deviceTypeLabel, deviceUsesControllers, type Device, type DeviceSession } from "@/lib/device-rental";
import { cn } from "@/lib/utils";

import { ControllerToggle, DeviceTypeIcon, ErrorText } from "./device-ui";

export function TransferDialog({
  session,
  devices,
  onOpenChange,
  onDone,
}: {
  session: DeviceSession | null;
  devices: Device[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  return (
    <Dialog open={session != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {session ? <TransferForm key={session.id} session={session} devices={devices} onDone={onDone} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TransferForm({
  session,
  devices,
  onDone,
}: {
  session: DeviceSession;
  devices: Device[];
  onDone: () => void;
}) {
  const [targetId, setTargetId] = useState<number>(session.consoleId);
  const [controllers, setControllers] = useState(session.controllerCount >= 3 ? 4 : 2);
  const freeDevices = devices.filter((device) => !device.busy && device.id !== session.consoleId);
  const current = devices.find((device) => device.id === session.consoleId) ?? null;
  const target = devices.find((device) => device.id === targetId) ?? current;
  const usesControllers = deviceUsesControllers(target?.deviceType ?? session.deviceType);
  const moving = targetId !== session.consoleId;
  const controllersChanged = usesControllers && controllers !== (session.controllerCount >= 3 ? 4 : 2);

  const transfer = useMutation({
    mutationFn: () =>
      transferDeviceSession(session.id, {
        consoleId: moving ? targetId : undefined,
        controllerCount: usesControllers ? controllers : undefined,
      }),
    onSuccess: onDone,
  });

  const option = (device: Device, hint: string) => (
    <li key={device.id}>
      <button
        type="button"
        aria-pressed={targetId === device.id}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
          targetId === device.id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:bg-muted/60",
        )}
        onClick={() => setTargetId(device.id)}
      >
        <DeviceTypeIcon type={device.deviceType} />
        <span className="min-w-0 flex-1 truncate font-medium">{device.name}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </button>
    </li>
  );

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Cihaz değiştir</DialogTitle>
        <DialogDescription>
          {session.consoleName ?? current?.name ?? "Cihaz"} · {session.customerName?.trim() || "Misafir"}. Süre yeni
          cihazda kaldığı yerden devam eder.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label>Cihaz</Label>
        <ul className="max-h-64 space-y-1.5 overflow-y-auto">
          {current ? option(current, "Şu anki") : null}
          {freeDevices.map((device) => option(device, deviceTypeLabel(device.deviceType)))}
        </ul>
        {freeDevices.length === 0 ? <p className="text-xs text-muted-foreground">Boş cihaz yok.</p> : null}
      </div>

      {usesControllers ? (
        <div className="space-y-1.5">
          <Label>Kol sayısı</Label>
          <ControllerToggle value={controllers} onChange={setControllers} />
        </div>
      ) : null}

      <ErrorText error={transfer.error} />

      <Button
        type="button"
        className="w-full"
        disabled={transfer.isPending || (!moving && !controllersChanged)}
        onClick={() => transfer.mutate()}
      >
        {transfer.isPending ? <Loader2 className="animate-spin" /> : <ArrowLeftRight />}
        Kaydet
      </Button>
    </div>
  );
}
