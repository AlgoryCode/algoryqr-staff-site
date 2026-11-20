"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Package, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deviceQueryKeys, listDeviceGames, listDevicePackages, startDeviceSession } from "@/lib/device-api";
import {
  deviceTypeLabel,
  deviceUsesControllers,
  formatDeviceMoney,
  formatMinutes,
  packagesForDevice,
  packageWindowLabel,
  splitGamesForDevice,
  type Device,
  type DeviceCustomer,
  type DevicePackage,
} from "@/lib/device-rental";
import { cn } from "@/lib/utils";

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
  const [pkg, setPkg] = useState<DevicePackage | null>(null);
  const [gameId, setGameId] = useState("");
  const usesControllers = deviceUsesControllers(device.deviceType);

  // Optional extras: an older backend without these endpoints just hides the sections.
  const packagesQuery = useQuery({
    queryKey: deviceQueryKeys.packages,
    queryFn: listDevicePackages,
    retry: false,
    staleTime: 60_000,
  });
  const gamesQuery = useQuery({
    queryKey: deviceQueryKeys.games,
    queryFn: listDeviceGames,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const packages = packagesForDevice(packagesQuery.data ?? [], device.deviceType);
  const games = splitGamesForDevice(gamesQuery.data ?? [], device);

  const choosePackage = (next: DevicePackage | null) => {
    setPkg(next);
    if (next) {
      setPreset("custom");
      setCustomMinutes(String(next.minutes));
    } else {
      setPreset("free");
      setCustomMinutes("");
    }
  };

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
        packageId: pkg?.id,
        gameId: gameId ? Number(gameId) : undefined,
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

      {packages.length > 0 ? (
        <div className="space-y-1.5">
          <Label>Paket</Label>
          <div className="grid gap-2">
            <ChoiceButton className="text-left" active={pkg == null} onClick={() => choosePackage(null)}>
              Paketsiz (saatlik)
            </ChoiceButton>
            {packages.map((item) => {
              const available = item.availableNow !== false;
              const window = packageWindowLabel(item);
              return (
                <ChoiceButton
                  key={item.id}
                  className="text-left"
                  active={pkg?.id === item.id}
                  disabled={!available}
                  onClick={() => choosePackage(item)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatMinutes(item.minutes)} · {formatDeviceMoney(item.price)}
                    </span>
                  </span>
                  {window || !available ? (
                    <span className={cn("block text-[11px] font-normal", pkg?.id === item.id ? "" : "text-muted-foreground")}>
                      {window}
                      {!available ? `${window ? " · " : ""}Şu an geçerli değil` : ""}
                    </span>
                  ) : null}
                </ChoiceButton>
              );
            })}
          </div>
        </div>
      ) : null}

      {games.installed.length + games.others.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor="device-start-game">Oyun</Label>
          <select
            id="device-start-game"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
            value={gameId}
            onChange={(event) => setGameId(event.target.value)}
          >
            <option value="">Seçilmedi</option>
            {games.installed.length > 0 ? (
              <optgroup label="Bu cihazda yüklü">
                {games.installed.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {games.others.length > 0 ? (
              <optgroup label={games.installed.length > 0 ? "Diğer oyunlar" : "Oyunlar"}>
                {games.others.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </div>
      ) : null}

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

      {pkg ? (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Paket: {pkg.name} · {formatMinutes(pkg.minutes)} sabit {formatDeviceMoney(pkg.price)}. Süre aşılırsa fazlası
          saatlik ücretlenir.
        </p>
      ) : null}

      <ErrorText error={start.error} />

      <Button type="submit" className="w-full" disabled={start.isPending || customInvalid}>
        {start.isPending ? <Loader2 className="animate-spin" /> : <Play />}
        Oturumu başlat
      </Button>
    </form>
  );
}
