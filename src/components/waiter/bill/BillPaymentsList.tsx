"use client";

import { Loader2, RotateCcw } from "lucide-react";

import { formatMenuPrice } from "@/components/menu-templates/types";
import { paymentMethodLabel } from "@/components/waiter/bill/bill-utils";
import { Button } from "@/components/ui/button";
import type { WaiterBillPayment } from "@/lib/waiter-api";

function formatWhen(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

export function BillPaymentsList({
  payments,
  currency,
  busy = false,
  reversingPaymentId = null,
  onReverse,
  includeTips = false,
  title = "Alınan ödemeler",
}: {
  payments: WaiterBillPayment[];
  currency: string;
  busy?: boolean;
  reversingPaymentId?: number | null;
  onReverse?: (payment: WaiterBillPayment) => void;
  includeTips?: boolean;
  title?: string;
}) {
  const visible = includeTips ? payments : payments.filter((p) => !p.tip);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 border-t border-zinc-100 pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      <ul className="space-y-1.5">
        {visible.map((payment) => {
          const reversing = reversingPaymentId === payment.id;
          return (
            <li
              key={payment.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50/50 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-800">
                  {payment.tip
                    ? "Bahşiş"
                    : (payment.itemSummary ??
                      (payment.splitShareNumber && payment.splitPersonCount
                        ? `Pay ${payment.splitShareNumber}/${payment.splitPersonCount}`
                        : "Ödeme"))}
                </p>
                <p className="text-xs text-zinc-500">
                  {payment.paymentMethod
                    ? paymentMethodLabel(payment.paymentMethod)
                    : "—"}{" "}
                  · {formatWhen(payment.paidAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold tabular-nums text-zinc-900">
                  {formatMenuPrice(payment.amount ?? undefined, currency)}
                </span>
                {onReverse ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 border-zinc-200 px-2 text-zinc-700"
                    disabled={busy || reversing}
                    onClick={() => onReverse(payment)}
                  >
                    {reversing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    Geri al
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
