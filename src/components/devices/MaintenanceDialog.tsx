"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MoneyInput, parseMoneyInput } from "@/components/ui/money-input";
import { Textarea } from "@/components/ui/textarea";
import { endDeviceMaintenance, startDeviceMaintenance } from "@/lib/device-api";
import { formatIstanbulDateTime, type Device } from "@/lib/device-rental";

import { ErrorText } from "./device-ui";

export type MaintenanceTarget = { device: Device; mode: "start" | "end" };

/** "Bakıma al" with an optional note, or "Bakımı bitir" with an optional cost. */
export function MaintenanceDialog({
  target,
  onOpenChange,
  onDone,
}: {
  target: MaintenanceTarget | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  return (
    <Dialog open={target != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {target ? <MaintenanceForm key={`${target.device.id}-${target.mode}`} target={target} onDone={onDone} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function MaintenanceForm({ target, onDone }: { target: MaintenanceTarget; onDone: () => void }) {
  const { device, mode } = target;
  const [note, setNote] = useState("");
  const [cost, setCost] = useState("");
  const costValue = cost.trim() ? parseMoneyInput(cost) : 0;
  const costInvalid = !Number.isFinite(costValue) || costValue < 0;

  const save = useMutation({
    mutationFn: () =>
      mode === "start"
        ? startDeviceMaintenance(device.id, { note: note.trim() || undefined })
        : endDeviceMaintenance(device.id, {
            cost: costValue > 0 ? costValue : undefined,
            note: note.trim() || undefined,
          }),
    onSuccess: onDone,
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!costInvalid) save.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {device.name} · {mode === "start" ? "Bakıma al" : "Bakımı bitir"}
        </DialogTitle>
        <DialogDescription>
          {mode === "start"
            ? "Bakım bitene kadar bu cihazda oturum başlatılamaz."
            : `Bakımda${device.maintenanceSince ? ` · başlangıç ${formatIstanbulDateTime(device.maintenanceSince)}` : ""}${
                device.maintenanceNote?.trim() ? ` · ${device.maintenanceNote.trim()}` : ""
              }`}
        </DialogDescription>
      </DialogHeader>

      {mode === "end" ? (
        <div className="space-y-1.5">
          <Label htmlFor="device-maintenance-cost">Bakım masrafı (₺, isteğe bağlı)</Label>
          <MoneyInput id="device-maintenance-cost" value={cost} onChange={setCost} placeholder="0" />
          {costInvalid ? <p className="text-xs text-destructive">Geçerli bir tutar girin.</p> : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="device-maintenance-note">Not (isteğe bağlı)</Label>
        <Textarea
          id="device-maintenance-note"
          rows={2}
          maxLength={255}
          placeholder={mode === "start" ? "Örn. kol arızalı" : "Örn. kol değiştirildi"}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <ErrorText error={save.error} />

      <Button type="submit" className="w-full" disabled={save.isPending || costInvalid}>
        {save.isPending ? <Loader2 className="animate-spin" /> : <Wrench />}
        {mode === "start" ? "Bakıma al" : "Bakımı bitir"}
      </Button>
    </form>
  );
}
