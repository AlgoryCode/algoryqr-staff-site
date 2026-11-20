"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, LockKeyhole, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput, parseMoneyInput } from "@/components/ui/money-input";
import {
  closeDeviceShift,
  deviceQueryKeys,
  getCurrentDeviceShift,
  listDeviceShifts,
  openDeviceShift,
} from "@/lib/device-api";
import {
  cashDifference,
  cashDifferenceLabel,
  formatDeviceMoney,
  formatIstanbulDateTime,
  formatIstanbulTime,
  PAYMENT_METHOD_LABEL,
  sumPaymentTotals,
  type DevicePaymentTotal,
  type DeviceShift,
} from "@/lib/device-rental";
import { cn } from "@/lib/utils";

import { deviceCardClass, ErrorText } from "./device-ui";

const PAGE_SIZE = 10;

/** The caller's open shift (null when none). Shared with the "open a shift" nudge. */
export function useCurrentShift(enabled = true) {
  return useQuery({
    queryKey: deviceQueryKeys.currentShift,
    queryFn: getCurrentDeviceShift,
    enabled,
    retry: false,
    refetchInterval: 60_000,
  });
}

export function ShiftPanel() {
  const currentQuery = useCurrentShift();
  const [closed, setClosed] = useState<DeviceShift | null>(null);

  return (
    <div className="space-y-4">
      {closed ? (
        <ClosedSummary shift={closed} onDone={() => setClosed(null)} />
      ) : currentQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Vardiya yükleniyor…</p>
      ) : currentQuery.isError ? (
        <ErrorText error={currentQuery.error} />
      ) : currentQuery.data ? (
        <OpenShift shift={currentQuery.data} onClosed={setClosed} />
      ) : (
        <OpenShiftForm />
      )}
      <PastShifts />
    </div>
  );
}

function OpenShiftForm() {
  const queryClient = useQueryClient();
  const [cash, setCash] = useState("");
  const value = cash.trim() ? parseMoneyInput(cash) : 0;
  const invalid = !Number.isFinite(value) || value < 0;

  const open = useMutation({
    mutationFn: () => openDeviceShift({ openingCash: value }),
    onSuccess: (shift) => {
      queryClient.setQueryData(deviceQueryKeys.currentShift, shift);
      void queryClient.invalidateQueries({ queryKey: ["staff-devices", "shifts"] });
    },
  });

  return (
    <form
      className={deviceCardClass}
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid) open.mutate();
      }}
    >
      <div>
        <h2 className="text-base font-semibold">Vardiya açık değil</h2>
        <p className="text-sm text-muted-foreground">
          Vardiya açınca kapattığınız oturumlar, yüklemeler, üyelik ve turnuva ücretleri kasanıza yazılır.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="device-shift-opening">Açılış kasası (₺)</Label>
        <MoneyInput id="device-shift-opening" value={cash} onChange={setCash} placeholder="0" />
        {invalid ? <p className="text-xs text-destructive">Geçerli bir tutar girin.</p> : null}
      </div>
      <ErrorText error={open.error} />
      <Button type="submit" className="w-full" disabled={invalid || open.isPending}>
        {open.isPending ? <Loader2 className="animate-spin" /> : <Wallet />}
        Vardiya aç
      </Button>
    </form>
  );
}

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <p className={cn("flex justify-between gap-3 text-sm", strong && "font-semibold", muted && "pl-3 text-xs text-muted-foreground")}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}

function PaymentGroup({ title, rows, unit }: { title: string; rows: DevicePaymentTotal[] | null | undefined; unit: string }) {
  const total = sumPaymentTotals(rows);
  if (total.count === 0 && total.amount === 0) return null;
  return (
    <div className="space-y-0.5">
      <Line label={`${title} · ${total.count} ${unit}`} value={formatDeviceMoney(total.amount)} />
      {(rows ?? []).map((row, index) => (
        <Line
          key={`${row.paymentMethod ?? "x"}-${index}`}
          muted
          label={`${row.paymentMethod ? PAYMENT_METHOD_LABEL[row.paymentMethod] : "Diğer"} (${row.count})`}
          value={formatDeviceMoney(row.amount)}
        />
      ))}
    </div>
  );
}

function ShiftTotals({ shift }: { shift: DeviceShift }) {
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <Line label="Açılış kasası" value={formatDeviceMoney(shift.openingCash)} />
      <PaymentGroup title="Oturumlar" rows={shift.sessionPayments} unit="oturum" />
      <PaymentGroup title="Bakiye yüklemeleri" rows={shift.topUps} unit="işlem" />
      <PaymentGroup title="Üyelik satışları" rows={shift.memberships} unit="satış" />
      <PaymentGroup title="Turnuva ücretleri" rows={shift.tournamentFees} unit="ödeme" />
      {sumPaymentTotals(shift.sessionPayments).count === 0 && (shift.sessions ?? 0) === 0 ? (
        <p className="text-xs text-muted-foreground">Bu vardiyada henüz kapanan oturum yok.</p>
      ) : null}
      <div className="space-y-0.5 border-t border-border pt-2">
        <Line label="Kasaya giren nakit" value={formatDeviceMoney(shift.cashIn)} />
        <Line label="Beklenen kasa" value={formatDeviceMoney(shift.expectedCash)} strong />
      </div>
    </div>
  );
}

function OpenShift({ shift, onClosed }: { shift: DeviceShift; onClosed: (shift: DeviceShift) => void }) {
  const queryClient = useQueryClient();
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const countedValue = counted.trim() ? parseMoneyInput(counted) : Number.NaN;
  const countedValid = Number.isFinite(countedValue) && countedValue >= 0;
  const preview = countedValid ? cashDifferenceLabel(cashDifference(countedValue, shift.expectedCash)) : null;

  const close = useMutation({
    mutationFn: () => closeDeviceShift(shift.id, { countedCash: countedValue, note: note.trim() || undefined }),
    onSuccess: (closedShift) => {
      queryClient.setQueryData(deviceQueryKeys.currentShift, null);
      void queryClient.invalidateQueries({ queryKey: ["staff-devices", "shifts"] });
      onClosed(closedShift);
    },
  });

  return (
    <div className={deviceCardClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Açık vardiya</h2>
          <p className="text-xs text-muted-foreground">
            {shift.staffName ? `${shift.staffName} · ` : ""}Başlangıç {formatIstanbulDateTime(shift.openedAt)}
          </p>
        </div>
        <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-950">Açık</span>
      </div>

      <ShiftTotals shift={shift} />

      <section className="space-y-3 border-t border-border pt-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <LockKeyhole className="h-4 w-4" /> Vardiyayı kapat
        </h3>
        <div className="space-y-1.5">
          <Label htmlFor="device-shift-counted">Sayılan kasa (₺)</Label>
          <MoneyInput id="device-shift-counted" value={counted} onChange={setCounted} placeholder="0" />
        </div>
        {preview ? (
          <p
            className={cn(
              "text-sm font-medium",
              preview.tone === "ok" && "text-emerald-700",
              preview.tone === "over" && "text-sky-700",
              preview.tone === "short" && "text-destructive",
            )}
          >
            {preview.label}
          </p>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="device-shift-note">Not (isteğe bağlı)</Label>
          <Input id="device-shift-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
        </div>
        <ErrorText error={close.error} />
        <Button
          type="button"
          variant="destructive"
          className="w-full"
          disabled={!countedValid || close.isPending}
          onClick={() => close.mutate()}
        >
          {close.isPending ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
          Vardiyayı kapat
        </Button>
      </section>
    </div>
  );
}

function ClosedSummary({ shift, onDone }: { shift: DeviceShift; onDone: () => void }) {
  const diff = cashDifferenceLabel(shift.difference);
  return (
    <div className={cn(deviceCardClass, "text-center")}>
      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
      <h2 className="text-base font-semibold">Vardiya kapandı</h2>
      <div className="text-left">
        <ShiftTotals shift={shift} />
      </div>
      <div className="space-y-0.5 text-left">
        <Line label="Sayılan kasa" value={formatDeviceMoney(shift.countedCash)} />
        <Line label="Fark" value={formatDeviceMoney(shift.difference)} strong />
      </div>
      <p
        className={cn(
          "text-lg font-semibold",
          diff.tone === "ok" && "text-emerald-700",
          diff.tone === "over" && "text-sky-700",
          diff.tone === "short" && "text-destructive",
        )}
      >
        {diff.label}
      </p>
      <Button type="button" className="w-full" onClick={onDone}>
        Tamam
      </Button>
    </div>
  );
}

function PastShifts() {
  const [page, setPage] = useState(0);
  const listQuery = useQuery({
    queryKey: deviceQueryKeys.shifts(page),
    queryFn: () => listDeviceShifts(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const data = listQuery.data;
  const rows = (data?.content ?? []).filter((shift) => shift.closedAt);

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Geçmiş vardiyalarım</h2>
      <ErrorText error={listQuery.error} />
      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Kapanmış vardiya yok.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {rows.map((shift) => {
            const diff = cashDifferenceLabel(shift.difference);
            return (
              <li key={shift.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {formatIstanbulDateTime(shift.openedAt)}–{formatIstanbulTime(shift.closedAt)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {shift.sessions ?? 0} oturum · {formatDeviceMoney(shift.sessionsTotal)} · Beklenen{" "}
                    {formatDeviceMoney(shift.expectedCash)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{formatDeviceMoney(shift.countedCash)}</p>
                  <p
                    className={cn(
                      "text-[11px]",
                      diff.tone === "ok" && "text-emerald-700",
                      diff.tone === "over" && "text-sky-700",
                      diff.tone === "short" && "text-destructive",
                    )}
                  >
                    {diff.label}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {data && (data.totalPages > 1 || page > 0) ? (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page === 0 || listQuery.isFetching}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Önceki
          </Button>
          <span className="text-xs text-muted-foreground">Sayfa {page + 1}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!data.hasNext || listQuery.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Sonraki
          </Button>
        </div>
      ) : null}
    </section>
  );
}
