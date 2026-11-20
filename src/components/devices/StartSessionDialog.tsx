"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { startDeviceSession } from "@/lib/device-api";
import {
  deviceTypeLabel,
  deviceUsesControllers,
  formatDeviceMoney,
  type Device,
  type DeviceCustomer,
} from "@/lib/device-rental";

import { CustomerPicker } from "./CustomerPicker";
import { ChoiceButton, ControllerToggle, ErrorText } from "./device-ui";

type PlanPreset = "free" | "30" | "60" | "120" | "custom";

const PRESETS: { key: PlanPreset; label: string }[] = [
  { key: "free", label: "Serbest" },
  { key: "30", label: "30 dk" },
  { key: "60", label: "1 saat" },
  { key: "120", label: "2 saat" },
  { key: "custom", label: "Özel" },
];

export function StartSessionDialog({
  device,
  onOpenChange,
  onStarted,
}: {
  device: Device | null;
  onOpenChange: (open: boolean) => void;
  onStarted: () => void;
}) {
  return (
    <Dialog open={device != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {device ? <StartSessionForm key={device.id} device={device} onStarted={onStarted} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function StartSessionForm({ device, onStarted }: { device: Device; onStarted: () => void }) {
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState<DeviceCustomer | null>(null);
  const [note, setNote] = useState("");
  const [preset, setPreset] = useState<PlanPreset>("free");
  const [customMinutes, setCustomMinutes] = useState("");
  const [controllers, setControllers] = useState(2);
  const usesControllers = deviceUsesControllers(device.deviceType);

  const plannedMinutes =
    preset === "free"
      ? undefined
      : preset === "custom"
        ? Number.parseInt(customMinutes, 10) || undefined
        : Number(preset);
  const customInvalid = preset === "custom" && (plannedMinutes == null || plannedMinutes < 1 || plannedMinutes > 1440);

  const start = useMutation({
    mutationFn: () =>
      startDeviceSession(device.id, {
        customerName: name.trim() || undefined,
        customerId: customer?.id,
        note: note.trim() || undefined,
        plannedMinutes,
        controllerCount: usesControllers ? controllers : undefined,
      }),
    onSuccess: onStarted,
  });

  const rate = usesControllers && controllers >= 3 ? device.effectiveMultiHourlyRate : device.effectiveHourlyRate;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!customInvalid) start.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>{device.name} · Başlat</DialogTitle>
        <DialogDescription>
          {deviceTypeLabel(device.deviceType)}
          {rate != null ? ` · Saatlik ${formatDeviceMoney(rate)}` : ""}
        </DialogDescription>
      </DialogHeader>

      <CustomerPicker name={name} onNameChange={setName} selected={customer} onSelect={setCustomer} />

      <div className="space-y-1.5">
        <Label htmlFor="device-start-note">Not</Label>
        <Textarea id="device-start-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>Planlanan süre</Label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {PRESETS.map((item) => (
            <ChoiceButton key={item.key} active={preset === item.key} onClick={() => setPreset(item.key)}>
              {item.label}
            </ChoiceButton>
          ))}
        </div>
        {preset === "custom" ? (
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            placeholder="Dakika"
            value={customMinutes}
            onChange={(event) => setCustomMinutes(event.target.value)}
          />
        ) : null}
      </div>

      {usesControllers ? (
        <div className="space-y-1.5">
          <Label>Kol sayısı</Label>
          <ControllerToggle value={controllers} onChange={setControllers} />
        </div>
      ) : null}

      <ErrorText error={start.error} />

      <Button type="submit" className="w-full" disabled={start.isPending || customInvalid}>
        {start.isPending ? <Loader2 className="animate-spin" /> : <Play />}
        Oturumu başlat
      </Button>
    </form>
  );
}
