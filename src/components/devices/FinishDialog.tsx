"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
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
  type DeviceQuoteOptions,
  type DeviceSession,
  type DiscountMode,
} from "@/lib/device-rental";

import { ChoiceButton, ErrorText, useDebounced } from "./device-ui";

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

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <p className={`flex justify-between gap-3 text-sm ${strong ? "font-semibold" : ""} ${accent ? "text-emerald-700" : ""}`}>
      <span className={strong || accent ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}

function OptionCheck({
  checked,
  disabled,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  detail: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}

function minus(value: Parameters<typeof toAmount>[0]): string {
  return `−${formatDeviceMoney(value)}`;
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
  const [useMembership, setUseMembership] = useState(false);
  const [useBonus, setUseBonus] = useState(false);
  const [result, setResult] = useState<DeviceSession | null>(null);

  const discountValue = discount.trim() ? parseMoneyInput(discount) : 0;
  const discountInvalid =
    !Number.isFinite(discountValue) || discountValue < 0 || (discountMode === "percent" && discountValue > 100);

  const options: DeviceQuoteOptions = {
    useLoyaltyMinutes: useLoyalty || undefined,
    useMembershipMinutes: useMembership || undefined,
    useBonusBalance: useBonus || undefined,
    discountAmount: !discountInvalid && discountMode === "amount" && discountValue > 0 ? discountValue : undefined,
    discountPercent: !discountInvalid && discountMode === "percent" && discountValue > 0 ? discountValue : undefined,
  };
  const optionsKey = JSON.stringify(options);
  const debouncedKey = useDebounced(optionsKey, 350);

  // The server prices the chosen options (membership → loyalty → level → bonus → manual discount).
  const quoteQuery = useQuery({
    queryKey: deviceQueryKeys.quote(session.id, debouncedKey),
    queryFn: () => quoteDeviceSession(session.id, JSON.parse(debouncedKey) as DeviceQuoteOptions),
    placeholderData: keepPreviousData,
    gcTime: 0,
    retry: false,
  });
  const quoteSettled = debouncedKey === optionsKey && !quoteQuery.isPlaceholderData && !quoteQuery.isFetching && !quoteQuery.isError;

  const finish = useMutation({
    mutationFn: () => finishDeviceSession(session.id, { paymentMethod: method, ...options }),
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
          {result.packageName ? <Row label="Paket" value={result.packageName} /> : null}
          {result.membershipMinutesUsed ? <Row label="Üyelik dakikası" value={formatMinutes(result.membershipMinutesUsed)} /> : null}
          {result.loyaltyMinutesUsed ? <Row label="Ücretsiz dakika" value={formatMinutes(result.loyaltyMinutesUsed)} /> : null}
          {toAmount(result.tierDiscountAmount) > 0 ? <Row label="Seviye indirimi" value={minus(result.tierDiscountAmount)} /> : null}
          {toAmount(result.bonusUsed) > 0 ? <Row label="Bonus" value={minus(result.bonusUsed)} /> : null}
          {toAmount(result.discountAmount) > 0 ? <Row label="İndirim" value={minus(result.discountAmount)} /> : null}
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
  const membershipAvailable = quote?.membershipMinutesAvailable ?? 0;
  const bonusBalance = toAmount(quote?.bonusBalance);
  // An older backend has no `amount`; fall back to the local preview.
  const finalAmount = quote
    ? quote.amount != null
      ? toAmount(quote.amount)
      : previewFinalAmount({
          gross: toAmount(quote.grossAmount),
          loyaltyValue: useLoyalty ? toAmount(quote.loyaltyValue) : 0,
          discountMode,
          discount: discountInvalid ? 0 : discountValue,
        })
    : null;
  const balance = toAmount(quote?.customerBalance);
  const balanceShort = method === "BALANCE" && finalAmount != null && balance < finalAmount;
  const tierPercent = toAmount(quote?.tierDiscountPercent);

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
      ) : quoteQuery.isError && !quote ? (
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
            {quote.packageName || session.packageName ? (
              <Row label="Paket" value={quote.packageName ?? session.packageName ?? ""} />
            ) : null}
            <Row label="Süre tutarı" value={formatDeviceMoney(quote.timeAmount)} />
            {(session.items ?? []).map((item) => (
              <Row key={item.id} label={`${item.quantity}× ${item.name}`} value={formatDeviceMoney(item.lineTotal)} />
            ))}
            <Row label="Ürünler" value={formatDeviceMoney(quote.itemsAmount)} />
            <div className="border-t border-border pt-1">
              <Row label="Toplam" value={formatDeviceMoney(quote.grossAmount)} strong />
            </div>
            {quote.membershipMinutesUsed ? (
              <Row
                accent
                label={`Üyelik (${formatMinutes(quote.membershipMinutesUsed)})`}
                value={minus(quote.membershipValue)}
              />
            ) : null}
            {quote.loyaltyMinutesUsed ? (
              <Row
                accent
                label={`Ücretsiz dakika (${formatMinutes(quote.loyaltyMinutesUsed)})`}
                value={minus(quote.loyaltyDiscount)}
              />
            ) : null}
            {toAmount(quote.tierDiscountAmount) > 0 ? (
              <Row
                accent
                label={`Seviye indirimi${quote.tierName ? ` · ${quote.tierName}` : ""}${tierPercent > 0 ? ` (%${tierPercent})` : ""}`}
                value={minus(quote.tierDiscountAmount)}
              />
            ) : null}
            {toAmount(quote.bonusUsed) > 0 ? <Row accent label="Bonus bakiye" value={minus(quote.bonusUsed)} /> : null}
            {toAmount(quote.manualDiscount) > 0 ? <Row accent label="İndirim" value={minus(quote.manualDiscount)} /> : null}
          </div>

          {quote.tierName && toAmount(quote.tierDiscountAmount) <= 0 && tierPercent > 0 ? (
            <p className="text-xs text-muted-foreground">
              Seviye: {quote.tierName} (%{tierPercent}) · indirim yalnız paketsiz süre tutarına uygulanır.
            </p>
          ) : null}

          {membershipAvailable > 0 ? (
            <OptionCheck
              checked={useMembership}
              onChange={setUseMembership}
              title="Üyelik dakikalarını kullan"
              detail={`${formatMinutes(membershipAvailable)} üyelik dakikası var`}
            />
          ) : null}

          {quote.loyaltyMinutesAvailable > 0 ? (
            <OptionCheck
              checked={useLoyalty}
              disabled={usableLoyalty <= 0}
              onChange={setUseLoyalty}
              title="Ücretsiz dakikaları kullan"
              detail={`${formatMinutes(quote.loyaltyMinutesAvailable)} birikmiş${
                usableLoyalty > 0 ? ` · ${formatMinutes(usableLoyalty)} kullanılabilir` : " · bu oturumda kullanılamaz"
              }`}
            />
          ) : null}

          {bonusBalance > 0 ? (
            <OptionCheck
              checked={useBonus}
              onChange={setUseBonus}
              title="Bonus bakiyeyi kullan"
              detail={`${formatDeviceMoney(bonusBalance)} hediye / davet bonusu`}
            />
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

          {quoteQuery.isError ? <ErrorText error={quoteQuery.error} /> : null}

          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              Ödenecek
              {!quoteSettled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            </span>
            <span className="text-xl font-semibold tabular-nums">{formatDeviceMoney(finalAmount)}</span>
          </div>

          <ErrorText error={finish.error} />

          <Button
            type="button"
            variant="destructive"
            className="w-full"
            disabled={finish.isPending || discountInvalid || balanceShort || !quoteSettled}
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
