"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MoneyInput, parseMoneyInput } from "@/components/ui/money-input";
import { deviceQueryKeys, finishDeviceSession, quoteDeviceSession } from "@/lib/device-api";
import {
  formatClock,
  formatDeviceMoney,
  formatMinutes,
  PAYMENT_METHOD_LABEL,
  previewFinalAmount,
  toAmount,
  type DevicePaymentMethod,
  type DeviceSession,
  type DiscountMode,
} from "@/lib/device-rental";

import { ChoiceButton, ErrorText } from "./device-ui";

const METHODS: DevicePaymentMethod[] = ["CASH", "CARD", "TRANSFER", "BALANCE"];

export function FinishDialog({
  session,
  onOpenChange,
  onFinished,
}: {
  session: DeviceSession | null;
  onOpenChange: (open: boolean) => void;
  onFinished: () => void;
}) {
  return (
    <Dialog open={session != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {session ? (
          <FinishPanel key={session.id} session={session} onFinished={onFinished} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <p className={`flex justify-between gap-3 text-sm ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}

function FinishPanel({
  session,
  onFinished,
  onClose,
}: {
  session: DeviceSession;
  onFinished: () => void;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<DevicePaymentMethod>("CASH");
  const [discountMode, setDiscountMode] = useState<DiscountMode>("amount");
  const [discount, setDiscount] = useState("");
  const [useLoyalty, setUseLoyalty] = useState(false);
  const [result, setResult] = useState<DeviceSession | null>(null);

  const quoteQuery = useQuery({
    queryKey: deviceQueryKeys.quote(session.id),
    queryFn: () => quoteDeviceSession(session.id),
    gcTime: 0,
    retry: false,
  });

  const discountValue = discount.trim() ? parseMoneyInput(discount) : 0;
  const discountInvalid =
    !Number.isFinite(discountValue) || discountValue < 0 || (discountMode === "percent" && discountValue > 100);

  const finish = useMutation({
    mutationFn: () =>
      finishDeviceSession(session.id, {
        paymentMethod: method,
        discountAmount: discountMode === "amount" && discountValue > 0 ? discountValue : undefined,
        discountPercent: discountMode === "percent" && discountValue > 0 ? discountValue : undefined,
        useLoyaltyMinutes: useLoyalty || undefined,
      }),
    onSuccess: (finished) => {
      setResult(finished);
      onFinished();
    },
  });

  if (result) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <DialogHeader className="sm:text-center">
          <DialogTitle>Oturum kapandı</DialogTitle>
          <DialogDescription>
            {result.consoleName ?? session.consoleName} · {result.customerName?.trim() || "Misafir"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 rounded-xl border border-border p-4 text-left">
          <Row label="Süre" value={formatMinutes(result.durationMinutes)} />
          {toAmount(result.discountAmount) > 0 ? <Row label="İndirim" value={`-${formatDeviceMoney(result.discountAmount)}`} /> : null}
          {result.loyaltyMinutesUsed ? <Row label="Ücretsiz dakika" value={formatMinutes(result.loyaltyMinutesUsed)} /> : null}
          <Row label="Ödeme" value={result.paymentMethod ? PAYMENT_METHOD_LABEL[result.paymentMethod] : PAYMENT_METHOD_LABEL[method]} />
        </div>
        <p className="text-3xl font-semibold tabular-nums">{formatDeviceMoney(result.amount)}</p>
        <Button type="button" className="w-full" onClick={onClose}>
          Tamam
        </Button>
      </div>
    );
  }

  const quote = quoteQuery.data;
  const hasCustomer = quote?.customerId != null || session.customerId != null;
  const usableLoyalty = quote?.loyaltyMinutesUsable ?? 0;
  const preview = quote
    ? previewFinalAmount({
        gross: toAmount(quote.grossAmount),
        loyaltyValue: useLoyalty ? toAmount(quote.loyaltyValue) : 0,
        discountMode,
        discount: discountInvalid ? 0 : discountValue,
      })
    : null;
  const balance = toAmount(quote?.customerBalance);
  const balanceShort = method === "BALANCE" && preview != null && balance < preview;

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Bitir · {session.consoleName ?? "Cihaz"}</DialogTitle>
        <DialogDescription>{quote?.customerName?.trim() || session.customerName?.trim() || "Misafir"}</DialogDescription>
      </DialogHeader>

      {quoteQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Hesap alınıyor…
        </p>
      ) : quoteQuery.isError ? (
        <div className="space-y-2">
          <ErrorText error={quoteQuery.error} />
          <Button type="button" size="sm" variant="outline" onClick={() => void quoteQuery.refetch()}>
            Tekrar dene
          </Button>
        </div>
      ) : quote ? (
        <>
          <div className="space-y-1 rounded-xl border border-border p-3">
            <Row label="Oynanan süre" value={formatClock(quote.playedSeconds)} />
            <Row label="Ücretlenen" value={formatMinutes(quote.durationMinutes)} />
            <Row label="Süre tutarı" value={formatDeviceMoney(quote.timeAmount)} />
            {(session.items ?? []).map((item) => (
              <Row key={item.id} label={`${item.quantity}× ${item.name}`} value={formatDeviceMoney(item.lineTotal)} />
            ))}
            <Row label="Ürünler" value={formatDeviceMoney(quote.itemsAmount)} />
            <div className="border-t border-border pt-1">
              <Row label="Toplam" value={formatDeviceMoney(quote.grossAmount)} strong />
            </div>
          </div>

          {quote.loyaltyMinutesAvailable > 0 ? (
            <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={useLoyalty}
                disabled={usableLoyalty <= 0}
                onChange={(event) => setUseLoyalty(event.target.checked)}
              />
              <span>
                <span className="font-medium">Ücretsiz dakikaları kullan</span>
                <span className="block text-xs text-muted-foreground">
                  {formatMinutes(quote.loyaltyMinutesAvailable)} birikmiş
                  {usableLoyalty > 0
                    ? ` · ${formatMinutes(usableLoyalty)} kullanılır (−${formatDeviceMoney(quote.loyaltyValue)})`
                    : " · bu oturumda kullanılamaz"}
                </span>
              </span>
            </label>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="device-discount">İndirim</Label>
            <div className="flex gap-2">
              <div className="grid w-28 shrink-0 grid-cols-2 gap-1">
                <ChoiceButton className="px-2" active={discountMode === "amount"} onClick={() => setDiscountMode("amount")}>
                  ₺
                </ChoiceButton>
                <ChoiceButton className="px-2" active={discountMode === "percent"} onClick={() => setDiscountMode("percent")}>
                  %
                </ChoiceButton>
              </div>
              <MoneyInput id="device-discount" value={discount} onChange={setDiscount} placeholder="0" />
            </div>
            {discountInvalid ? <p className="text-xs text-destructive">Geçerli bir indirim girin.</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>Ödeme yöntemi</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {METHODS.map((item) => (
                <ChoiceButton
                  key={item}
                  active={method === item}
                  disabled={item === "BALANCE" && !hasCustomer}
                  onClick={() => setMethod(item)}
                >
                  {PAYMENT_METHOD_LABEL[item]}
                </ChoiceButton>
              ))}
            </div>
            {hasCustomer ? (
              <p className={`text-xs ${balanceShort ? "text-destructive" : "text-muted-foreground"}`}>
                Müşteri bakiyesi {formatDeviceMoney(quote.customerBalance)}
                {balanceShort ? " · yetersiz" : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Bakiye ile ödeme için oturuma müşteri kartı bağlı olmalı.</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
            <span className="text-sm text-muted-foreground">Ödenecek (tahmini)</span>
            <span className="text-xl font-semibold tabular-nums">{formatDeviceMoney(preview)}</span>
          </div>

          <ErrorText error={finish.error} />

          <Button
            type="button"
            variant="destructive"
            className="w-full"
            disabled={finish.isPending || discountInvalid || balanceShort}
            onClick={() => finish.mutate()}
          >
            {finish.isPending ? <Loader2 className="animate-spin" /> : null}
            Onayla ve bitir
          </Button>
        </>
      ) : null}
    </div>
  );
}
