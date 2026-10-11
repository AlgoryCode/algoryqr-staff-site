"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { formatMenuPrice } from "@/components/menu-templates/types";
import { PaymentMethodPicker } from "@/components/waiter/bill/bill-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getWaiterBillSplitPreview,
  type WaiterSplitPreview,
  WaiterApiError,
} from "@/lib/waiter-api";

export function BillSplitPanel({
  billId,
  currency,
  busy,
  initialPersonCount,
  tipReceived,
  tipAmount,
  onPayShare,
}: {
  billId: number;
  currency: string;
  busy: boolean;
  initialPersonCount?: number | null;
  tipReceived?: boolean;
  tipAmount?: number;
  onPayShare: (payload: {
    personCount: number;
    shareNumber: number;
    paymentMethod: "CASH" | "CARD";
    tipReceived?: boolean;
    tipAmount?: number;
  }) => void;
}) {
  const [personCountInput, setPersonCountInput] = useState(
    String(initialPersonCount ?? 2),
  );
  const [activeShare, setActiveShare] = useState<number | null>(null);
  const [sharePaymentMethod, setSharePaymentMethod] = useState<"CASH" | "CARD" | null>(
    null,
  );

  const personCount = Number.parseInt(personCountInput, 10);
  const validPersonCount =
    Number.isFinite(personCount) && personCount >= 2 && personCount <= 20;

  const previewQuery = useQuery({
    queryKey: ["waiter-bill-split-preview", billId, personCount],
    queryFn: () => getWaiterBillSplitPreview(billId, personCount),
    enabled: validPersonCount,
  });

  useEffect(() => {
    if (initialPersonCount && initialPersonCount >= 2) {
      setPersonCountInput(String(initialPersonCount));
    }
  }, [initialPersonCount]);

  const preview = previewQuery.data;
  const nextUnpaidShare = preview?.shares?.find((s) => !s.paid);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-700" htmlFor="person-count">
          Kişi adedi
        </label>
        <Input
          id="person-count"
          type="number"
          min={2}
          max={20}
          className="border-zinc-200 bg-white"
          value={personCountInput}
          disabled={busy || Boolean(initialPersonCount && preview?.shares?.some((s) => s.paid))}
          onChange={(e) => setPersonCountInput(e.target.value)}
        />
        <p className="text-xs text-zinc-500">2 ile 20 arasında kişi sayısı girin.</p>
      </div>

      {previewQuery.isLoading && validPersonCount ? (
        <div className="flex justify-center py-4 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : null}

      {previewQuery.isError ? (
        <p className="text-sm text-red-600">
          {previewQuery.error instanceof WaiterApiError
            ? previewQuery.error.message
            : "Bölme hesaplanamadı."}
        </p>
      ) : null}

      {preview ? (
        <SplitShareList
          preview={preview}
          currency={currency}
          busy={busy}
          activeShare={activeShare}
          onSelectShare={(shareNumber) => {
            setActiveShare(shareNumber);
            setSharePaymentMethod(null);
          }}
        />
      ) : null}

      {activeShare != null && preview ? (
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
          <p className="text-sm font-medium text-zinc-900">
            Kişi {activeShare} ·{" "}
            {formatMenuPrice(
              preview.shares?.find((s) => s.shareNumber === activeShare)?.amount ?? undefined,
              currency,
            )}
          </p>
          <p className="text-xs text-zinc-500">Ödeme yöntemini seçin</p>
          <PaymentMethodPicker
            value={sharePaymentMethod}
            disabled={busy}
            onChange={setSharePaymentMethod}
          />
          <Button
            type="button"
            className="w-full bg-zinc-900 text-white hover:bg-zinc-800"
            disabled={busy || sharePaymentMethod == null}
            onClick={() => {
              if (sharePaymentMethod == null || !preview) return;
              const unpaidShares = preview.shares?.filter((s) => !s.paid) ?? [];
              const isLastShare = unpaidShares.length === 1;
              onPayShare({
                personCount: preview.personCount,
                shareNumber: activeShare,
                paymentMethod: sharePaymentMethod,
                tipReceived: isLastShare && tipReceived ? true : undefined,
                tipAmount:
                  isLastShare && tipReceived && tipAmount != null && tipAmount >= 0.01
                    ? tipAmount
                    : undefined,
              });
              setActiveShare(null);
              setSharePaymentMethod(null);
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay ödemesini al"}
          </Button>
        </div>
      ) : nextUnpaidShare && !busy ? (
        <p className="text-xs text-zinc-500">
          Sıradaki: Kişi {nextUnpaidShare.shareNumber} (
          {formatMenuPrice(nextUnpaidShare.amount ?? undefined, currency)})
        </p>
      ) : null}
    </div>
  );
}

function SplitShareList({
  preview,
  currency,
  busy,
  activeShare,
  onSelectShare,
}: {
  preview: WaiterSplitPreview;
  currency: string;
  busy: boolean;
  activeShare: number | null;
  onSelectShare: (shareNumber: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-500">Kalan tutar</span>
        <span className="font-semibold tabular-nums text-zinc-900">
          {formatMenuPrice(preview.remainingTotal ?? undefined, currency)}
        </span>
      </div>
      <ul className="max-h-48 space-y-1.5 overflow-y-auto">
        {preview.shares?.map((share) => (
          <li key={share.shareNumber}>
            <button
              type="button"
              disabled={busy || share.paid}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                share.paid
                  ? "border-emerald-100 bg-emerald-50/80 text-emerald-800"
                  : activeShare === share.shareNumber
                    ? "border-zinc-900 bg-zinc-50"
                    : "border-zinc-100 bg-white hover:border-zinc-300"
              }`}
              onClick={() => {
                if (!share.paid) onSelectShare(share.shareNumber);
              }}
            >
              <span>Kişi {share.shareNumber}</span>
              <span className="font-semibold tabular-nums">
                {share.paid ? "Ödendi" : formatMenuPrice(share.amount ?? undefined, currency)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
