"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { formatMenuPrice } from "@/components/menu-templates/types";
import { PaymentMethodPicker } from "@/components/waiter/bill/bill-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuantityStepper } from "@/components/waiter/quantity-stepper";
import type { WaiterBillItem } from "@/lib/waiter-api";

export function BillItemPayDialog({
  open,
  onOpenChange,
  item,
  currency,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WaiterBillItem | null;
  currency: string;
  busy: boolean;
  onConfirm: (payload: {
    quantityToPay: number;
    paymentMethod: "CASH" | "CARD";
  }) => void;
}) {
  const unpaidQty = item
    ? item.unpaidQuantity ?? Math.max(0, item.quantity - (item.paidQuantity ?? 0))
    : 0;
  const [quantityToPay, setQuantityToPay] = useState(unpaidQty);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | null>(null);

  const unitPrice = Number(item?.unitPrice ?? 0);
  const lineAmount = unitPrice * quantityToPay;

  useEffect(() => {
    if (open && item) {
      setQuantityToPay(unpaidQty);
      setPaymentMethod(null);
    }
  }, [open, item, unpaidQty]);

  function resetState() {
    setQuantityToPay(unpaidQty);
    setPaymentMethod(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetState();
        else if (item) setQuantityToPay(unpaidQty);
      }}
    >
      <DialogContent className="border-zinc-200 bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-900">Kısmi ödeme al</DialogTitle>
          <DialogDescription className="text-zinc-500">
            {item?.productName} için ödenecek adedi ve ödeme yöntemini seçin.
          </DialogDescription>
        </DialogHeader>

        {item ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2">
              <span className="text-sm text-zinc-600">Ödenecek adet</span>
              <QuantityStepper
                size="sm"
                value={quantityToPay}
                min={1}
                max={unpaidQty}
                disabled={busy}
                onChange={setQuantityToPay}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Tutar</span>
              <span className="font-semibold tabular-nums text-zinc-900">
                {formatMenuPrice(lineAmount, currency)}
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-700">Ödeme yöntemi</p>
              <PaymentMethodPicker
                value={paymentMethod}
                disabled={busy}
                onChange={setPaymentMethod}
              />
            </div>
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
          <Button
            type="button"
            className="bg-zinc-900 text-white hover:bg-zinc-800"
            disabled={busy || paymentMethod == null || quantityToPay < 1}
            onClick={() => {
              if (paymentMethod == null) return;
              onConfirm({ quantityToPay, paymentMethod });
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ödemeyi kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
