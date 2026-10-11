"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { formatMenuPrice } from "@/components/menu-templates/types";
import { BillSplitPanel } from "@/components/waiter/bill/BillSplitPanel";
import { PaymentMethodPicker } from "@/components/waiter/bill/bill-utils";
import { Button } from "@/components/ui/button";
import { MoneyInput, parseMoneyInput } from "@/components/ui/money-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WaiterBill } from "@/lib/waiter-api";

type CloseMode = "full" | "split";

export function BillCloseDialog({
  open,
  onOpenChange,
  bill,
  tableLabel,
  currency,
  busy,
  onCloseFull,
  onPayShare,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: WaiterBill;
  tableLabel: string;
  currency: string;
  busy: boolean;
  onCloseFull: (payload: {
    paymentMethod: "CASH" | "CARD";
    tipReceived?: boolean;
    tipAmount?: number;
  }) => void;
  onPayShare: (payload: {
    personCount: number;
    shareNumber: number;
    paymentMethod: "CASH" | "CARD";
    tipReceived?: boolean;
    tipAmount?: number;
  }) => void;
}) {
  const [mode, setMode] = useState<CloseMode>("full");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | null>(null);
  const [tipReceived, setTipReceived] = useState(false);
  const [tipAmount, setTipAmount] = useState("");

  const remainingLabel = formatMenuPrice(
    bill.remainingTotal ?? bill.totalAmount ?? undefined,
    currency,
  );
  const hasSplitInProgress = Boolean(
    bill.splitPersonCount && bill.payments?.some((p) => p.splitShareNumber),
  );

  function resetState() {
    setMode(hasSplitInProgress ? "split" : "full");
    setPaymentMethod(null);
    setTipReceived(false);
    setTipAmount("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetState();
        else if (hasSplitInProgress) setMode("split");
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto border-zinc-200 bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-zinc-900">Masayı kapat</DialogTitle>
          <DialogDescription className="text-zinc-500">
            <span className="font-medium text-zinc-800">{tableLabel}</span> · Kalan{" "}
            <span className="font-semibold text-zinc-900">{remainingLabel}</span>
          </DialogDescription>
        </DialogHeader>

        {!hasSplitInProgress ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                mode === "full"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-600"
              }`}
              onClick={() => setMode("full")}
            >
              Tam kapat
            </button>
            <button
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                mode === "split"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-600"
              }`}
              onClick={() => setMode("split")}
            >
              Hesabı böl
            </button>
          </div>
        ) : null}

        {mode === "full" && !hasSplitInProgress ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-700">Ödeme yöntemi</p>
              <PaymentMethodPicker
                value={paymentMethod}
                disabled={busy}
                onChange={setPaymentMethod}
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={tipReceived}
                  onChange={(e) => setTipReceived(e.target.checked)}
                />
                Bahşiş alındı
              </label>
              {tipReceived ? (
                <MoneyInput
                  placeholder="Bahşiş tutarı"
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
                  value={tipAmount}
                  onChange={setTipAmount}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <BillSplitPanel
            billId={bill.id}
            currency={currency}
            busy={busy}
            initialPersonCount={bill.splitPersonCount}
            tipReceived={tipReceived}
            tipAmount={
              tipReceived
                ? parseMoneyInput(tipAmount)
                : undefined
            }
            onPayShare={onPayShare}
          />
        )}

        {mode === "split" ? (
          <div className="space-y-2 border-t border-zinc-100 pt-3">
            <label className="flex items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={tipReceived}
                onChange={(e) => setTipReceived(e.target.checked)}
              />
              Son payda bahşiş alındı
            </label>
            {tipReceived ? (
              <MoneyInput
                placeholder="Bahşiş tutarı"
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
                value={tipAmount}
                onChange={setTipAmount}
              />
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="border-zinc-200"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Vazgeç
          </Button>
          {mode === "full" && !hasSplitInProgress ? (
            <Button
              type="button"
              className="bg-zinc-900 text-white hover:bg-zinc-800"
              disabled={busy || paymentMethod == null}
              onClick={() => {
                if (paymentMethod == null) return;
                const parsedTip = parseMoneyInput(tipAmount);
                if (tipReceived && (!Number.isFinite(parsedTip) || parsedTip < 0.01)) {
                  return;
                }
                onCloseFull({
                  paymentMethod,
                  tipReceived: tipReceived || undefined,
                  tipAmount: tipReceived ? parsedTip : undefined,
                });
              }}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Masayı kapat
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
