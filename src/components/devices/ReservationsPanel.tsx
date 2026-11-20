"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2, Play, UserX, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelDeviceReservation,
  createDeviceReservation,
  deviceQueryKeys,
  invalidateDeviceData,
  listDeviceReservations,
  listDevices,
  noShowDeviceReservation,
  startDeviceReservation,
} from "@/lib/device-api";
import {
  formatIstanbulDateTime,
  formatIstanbulTime,
  formatMinutes,
  istanbulDateKey,
  istanbulLocalInputValue,
  localInputToBackend,
  parseIstanbulDateTime,
  RESERVATION_STATUS_LABEL,
  type DeviceCustomer,
  type DeviceReservation,
} from "@/lib/device-rental";
import { cn } from "@/lib/utils";

import { CustomerPicker } from "./CustomerPicker";
import { ChoiceButton, ErrorText } from "./device-ui";

const UPCOMING_DAYS = 14;
const LENGTHS = [30, 60, 90, 120];

function rangeFromToday(): { from: string; to: string } {
  const now = new Date();
  return {
    from: istanbulDateKey(now),
    to: istanbulDateKey(new Date(now.getTime() + UPCOMING_DAYS * 86_400_000)),
  };
}

export function ReservationsPanel() {
  const queryClient = useQueryClient();
  const [range] = useState(rangeFromToday);
  const [creating, setCreating] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const reservationsQuery = useQuery({
    queryKey: deviceQueryKeys.reservations(range.from, range.to),
    queryFn: () => listDeviceReservations(range.from, range.to),
    retry: false,
    refetchInterval: 60_000,
  });

  const action = useMutation({
    mutationFn: async (payload: { reservation: DeviceReservation; kind: "start" | "cancel" | "noShow" }) => {
      const id = payload.reservation.id;
      if (payload.kind === "start") return startDeviceReservation(id);
      if (payload.kind === "cancel") return cancelDeviceReservation(id);
      return noShowDeviceReservation(id);
    },
    onSettled: () => void invalidateDeviceData(queryClient),
  });

  const groups = useMemo(() => {
    const rows = (reservationsQuery.data ?? [])
      .filter((row) => showClosed || row.status === "BOOKED")
      .sort((a, b) => (parseIstanbulDateTime(a.startsAt)?.getTime() ?? 0) - (parseIstanbulDateTime(b.startsAt)?.getTime() ?? 0));
    const byDay = new Map<string, DeviceReservation[]>();
    for (const row of rows) {
      const date = parseIstanbulDateTime(row.startsAt);
      const key = date ? istanbulDateKey(date) : "?";
      byDay.set(key, [...(byDay.get(key) ?? []), row]);
    }
    return [...byDay.entries()];
  }, [reservationsQuery.data, showClosed]);

  const busyId = action.isPending ? action.variables?.reservation.id ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={showClosed}
            onChange={(event) => setShowClosed(event.target.checked)}
          />
          Kapananları da göster
        </label>
        <Button type="button" size="sm" onClick={() => setCreating(true)}>
          <CalendarPlus />
          Yeni rezervasyon
        </Button>
      </div>

      <ErrorText error={reservationsQuery.error ?? action.error} />

      {reservationsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Rezervasyonlar yükleniyor…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bugün ve önümüzdeki {UPCOMING_DAYS} gün için rezervasyon yok.</p>
      ) : (
        <div className="space-y-5">
          {groups.map(([day, rows]) => (
            <section key={day} className="space-y-2">
              <h3 className="text-sm font-semibold">{dayHeading(day, range.from)}</h3>
              <ul className="space-y-2">
                {rows.map((row) => (
                  <ReservationRow
                    key={row.id}
                    reservation={row}
                    busy={busyId === row.id}
                    onAction={(kind) => action.mutate({ reservation: row, kind })}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {creating ? (
            <ReservationForm
              onCreated={() => {
                setCreating(false);
                void invalidateDeviceData(queryClient);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function dayHeading(day: string, today: string): string {
  if (day === today) return "Bugün";
  const date = parseIstanbulDateTime(`${day}T12:00:00`);
  if (!date) return day;
  return new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", weekday: "long", day: "numeric", month: "long" }).format(date);
}

function ReservationRow({
  reservation,
  busy,
  onAction,
}: {
  reservation: DeviceReservation;
  busy: boolean;
  onAction: (kind: "start" | "cancel" | "noShow") => void;
}) {
  const open = reservation.status === "BOOKED";
  return (
    <li className={cn("rounded-2xl border border-border bg-card p-3 shadow-sm", !open && "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {formatIstanbulTime(reservation.startsAt)}
            {reservation.endsAt ? `–${formatIstanbulTime(reservation.endsAt)}` : ""} · {reservation.consoleName ?? "Cihaz"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {reservation.customerName?.trim() || "İsimsiz"}
            {reservation.phone ? ` · ${reservation.phone}` : ""}
          </p>
          {reservation.note?.trim() ? <p className="truncate text-xs text-amber-800">{reservation.note.trim()}</p> : null}
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {RESERVATION_STATUS_LABEL[reservation.status] ?? reservation.status}
        </span>
      </div>
      {open ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={() => onAction("start")}>
            {busy ? <Loader2 className="animate-spin" /> : <Play />}
            Başlat
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAction("noShow")}>
            <UserX />
            Gelmedi
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
            disabled={busy}
            onClick={() => onAction("cancel")}
          >
            <X />
            İptal
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function ReservationForm({ onCreated }: { onCreated: () => void }) {
  const [consoleId, setConsoleId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState<DeviceCustomer | null>(null);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [startsAt, setStartsAt] = useState(() => istanbulLocalInputValue(new Date(Date.now() + 60 * 60_000)).slice(0, 14) + "00");
  const [length, setLength] = useState(60);

  const devicesQuery = useQuery({ queryKey: deviceQueryKeys.devices, queryFn: listDevices, retry: false });
  const devices = devicesQuery.data ?? [];

  const create = useMutation({
    mutationFn: () =>
      createDeviceReservation({
        consoleId: consoleId!,
        customerId: customer?.id,
        customerName: name.trim() || customer?.name || undefined,
        phone: phone.trim() || customer?.phone || undefined,
        note: note.trim() || undefined,
        startsAt: localInputToBackend(startsAt),
        durationMinutes: length,
      }),
    onSuccess: onCreated,
  });

  const valid = consoleId != null && startsAt.length >= 16 && length >= 5 && length <= 1440 && (name.trim() || customer);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) create.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>Yeni rezervasyon</DialogTitle>
        <DialogDescription>Saatler İstanbul saatidir.</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="device-reservation-device">Cihaz</Label>
        <select
          id="device-reservation-device"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={consoleId ?? ""}
          onChange={(event) => setConsoleId(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="">Cihaz seçin</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name}
            </option>
          ))}
        </select>
      </div>

      <CustomerPicker name={name} onNameChange={setName} selected={customer} onSelect={setCustomer} />

      {customer == null ? (
        <div className="space-y-1.5">
          <Label htmlFor="device-reservation-phone">Telefon</Label>
          <Input
            id="device-reservation-phone"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="device-reservation-start">Tarih ve saat</Label>
        <Input
          id="device-reservation-start"
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Süre</Label>
        <div className="grid grid-cols-4 gap-2">
          {LENGTHS.map((minutes) => (
            <ChoiceButton key={minutes} active={length === minutes} onClick={() => setLength(minutes)}>
              {formatMinutes(minutes)}
            </ChoiceButton>
          ))}
        </div>
        <Input
          type="number"
          inputMode="numeric"
          min={5}
          max={1440}
          value={length}
          aria-label="Süre (dakika)"
          onChange={(event) => setLength(Number.parseInt(event.target.value, 10) || 0)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="device-reservation-note">Not</Label>
        <Textarea id="device-reservation-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>

      <ErrorText error={create.error} />

      <Button type="submit" className="w-full" disabled={!valid || create.isPending}>
        {create.isPending ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
        Rezervasyonu kaydet
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {startsAt ? `${formatIstanbulDateTime(localInputToBackend(startsAt))} · ${formatMinutes(length)}` : ""}
      </p>
    </form>
  );
}
