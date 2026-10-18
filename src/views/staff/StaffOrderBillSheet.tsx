"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Printer } from "lucide-react";

import { formatMenuPrice } from "@/components/menu-templates/types";
import { paymentMethodLabel } from "@/components/waiter/bill/bill-utils";
import { BillCloseDialog } from "@/components/waiter/bill/BillCloseDialog";
import { BillItemPayDialog } from "@/components/waiter/bill/BillItemPayDialog";
import { BillPaymentsList } from "@/components/waiter/bill/BillPaymentsList";
import { BillSummaryBar } from "@/components/waiter/bill/BillSummaryBar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ordersToDeliverOnBillClose, ordersToMarkPaidOnBillClose, ordersToRestoreOnPaymentReverse } from "@/lib/bill-auto-serve";
import { forceOrderFlowStatus, waiterCanCollectOnOrders } from "@/lib/order-flow";
import { orderLocationLabel } from "@/lib/order-management";
import type { OrderResponse } from "@/lib/ordering-api";
import { billToReceipt, printReceiptInBrowser } from "@/lib/receipt-ticket";
import {
  closeWaiterBill,
  getWaiterBill,
  getWaiterOpenBill,
  markWaiterServiceDelivered,
  payWaiterBillItems,
  payWaiterBillShare,
  reverseWaiterBillPayment,
  type WaiterBill,
  type WaiterBillItem,
  WaiterApiError,
} from "@/lib/waiter-api";

type SheetPanel = "bill" | "process";

type StaffOrderBillSheetProps = {
  order: OrderResponse | null;
  tableOrders?: OrderResponse[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBillUpdated?: () => void;
  processPanel?: ReactNode;
  defaultPanel?: SheetPanel;
  kitchenEnabled?: boolean;
};

export function StaffOrderBillSheet({
  order,
  tableOrders,
  open,
  onOpenChange,
  onBillUpdated,
  processPanel,
  defaultPanel = "bill",
  kitchenEnabled = true,
}: StaffOrderBillSheetProps) {
  const queryClient = useQueryClient();
  const tableId = order?.tableId ?? null;
  const tableLabel = order ? orderLocationLabel(order) : "";
  const fallbackBillIdRef = useRef<number | null>(order?.billId ?? null);
  const trackedOrderIdRef = useRef<number | null>(order?.id ?? null);
  const closedBillByTableRef = useRef(new Map<number, number>());
  const orderId = order?.id ?? null;
  const orderBillId = order?.billId ?? null;
  const rememberedBillId = tableId != null ? closedBillByTableRef.current.get(tableId) ?? null : null;
  if (trackedOrderIdRef.current !== orderId) {
    trackedOrderIdRef.current = orderId;
    fallbackBillIdRef.current = rememberedBillId ?? orderBillId;
  } else if (rememberedBillId != null) {
    fallbackBillIdRef.current = rememberedBillId;
  } else if (orderBillId != null && fallbackBillIdRef.current == null) {
    fallbackBillIdRef.current = orderBillId;
  }

  const [closeOpen, setCloseOpen] = useState(false);
  const [payItem, setPayItem] = useState<WaiterBillItem | null>(null);
  const [reversingPaymentId, setReversingPaymentId] = useState<number | null>(null);
  const [billError, setBillError] = useState<string | null>(null);
  const [sheetPanel, setSheetPanel] = useState<SheetPanel>(defaultPanel);

  useEffect(() => {
    if (open) setSheetPanel(defaultPanel);
  }, [open, defaultPanel, order?.id]);

  const billQuery = useQuery({
    queryKey: ["staff-waiter-bill", tableId, order?.id ?? null],
    enabled: open && tableId != null,
    queryFn: async () => {
      const openBill = await getWaiterOpenBill(tableId!);
      if (openBill) return openBill;
      const billId = fallbackBillIdRef.current;
      return billId != null ? getWaiterBill(billId) : null;
    },
  });

  const bill = billQuery.data;
  const currency = bill?.currency || order?.currency || "TRY";

  const billQueryKey = ["staff-waiter-bill", tableId, order?.id ?? null] as const;

  const invalidateBill = async () => {
    await queryClient.invalidateQueries({ queryKey: ["staff-waiter-bill", tableId] });
    onBillUpdated?.();
  };

  const billMutation = useMutation({
    mutationFn: async (
      action:
        | {
            kind: "payItem";
            payload: {
              quantityToPay: number;
              paymentMethod: "CASH" | "CARD";
            };
          }
        | {
            kind: "closeFull";
            payload: {
              paymentMethod: "CASH" | "CARD";
              tipReceived?: boolean;
              tipAmount?: number;
            };
          }
        | {
            kind: "payShare";
            payload: {
              personCount: number;
              shareNumber: number;
              paymentMethod: "CASH" | "CARD";
              tipReceived?: boolean;
              tipAmount?: number;
            };
          }
        | { kind: "reverse"; paymentId: number },
    ) => {
      if (!bill) throw new Error("Adisyon yüklenmedi.");
      if (action.kind === "payItem") {
        if (!payItem) throw new Error("Kalem seçilmedi.");
        return payWaiterBillItems(bill.id, {
          paymentMethod: action.payload.paymentMethod,
          items: [{ itemId: payItem.id, quantityToPay: action.payload.quantityToPay }],
        });
      }
      if (action.kind === "closeFull") {
        return closeWaiterBill(bill.id, action.payload);
      }
      if (action.kind === "payShare") {
        return payWaiterBillShare(bill.id, action.payload);
      }
      return reverseWaiterBillPayment(bill.id, action.paymentId);
    },
    onMutate: (action) => {
      setBillError(null);
      if (action.kind === "reverse") setReversingPaymentId(action.paymentId);
      return { wasClosed: bill?.status === "CLOSED" };
    },
    onSuccess: async (updated, action, context) => {
      if (updated.id) {
        fallbackBillIdRef.current = updated.id;
        if (updated.status === "CLOSED" && tableId != null) {
          closedBillByTableRef.current.set(tableId, updated.id);
        }
      }
      queryClient.setQueryData(billQueryKey, updated);
      setPayItem(null);
      setReversingPaymentId(null);
      setCloseOpen(false);
      const liveOrders = tableOrders?.length ? tableOrders : order ? [order] : [];
      if (action.kind === "closeFull" && updated.status === "CLOSED" && kitchenEnabled) {
        const failures = await Promise.all(
          ordersToDeliverOnBillClose(liveOrders, kitchenEnabled).map(async (item) => {
            try {
              await markWaiterServiceDelivered(item.id);
              return null;
            } catch (err) {
              return err instanceof Error ? err.message : "Sipariş teslim edilemedi";
            }
          }),
        );
        const failed = failures.find((item) => item != null);
        if (failed) setBillError(failed);
      }
      if (action.kind === "closeFull" && updated.status === "CLOSED") {
        for (const item of ordersToMarkPaidOnBillClose(liveOrders, kitchenEnabled)) {
          forceOrderFlowStatus(item.id, "PAID");
        }
      }
      if (action.kind === "reverse" && context?.wasClosed && updated.status !== "CLOSED") {
        for (const item of ordersToRestoreOnPaymentReverse(liveOrders, kitchenEnabled)) {
          forceOrderFlowStatus(item.id, item.status);
        }
      }
      if (updated.status === "CLOSED") {
        onBillUpdated?.();
        return;
      }
      await invalidateBill();
    },
    onError: (err) => {
      setReversingPaymentId(null);
      setBillError(
        err instanceof WaiterApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "İşlem başarısız",
      );
    },
  });

  const busy = billMutation.isPending;
  const remaining = Number(bill?.remainingTotal ?? bill?.totalAmount ?? 0);
  const closed = bill?.status === "CLOSED";
  const paymentOrders = tableOrders?.length ? tableOrders : order ? [order] : [];
  const canCollect = waiterCanCollectOnOrders(paymentOrders, kitchenEnabled);
  const canClose = canCollect && bill?.status === "OPEN" && remaining > 0.009;
  const payments = bill?.payments ?? [];

  function printBill() {
    if (!bill) return;
    printReceiptInBrowser(
      billToReceipt({
        tableLabel: tableLabel || bill.tableName || "Adisyon",
        orderNumber: String(order?.orderNumber || order?.id || bill.id),
        closedAt: bill.closedAt || bill.openedAt,
        currency,
        totalAmount: bill.totalAmount,
        paidTotal: bill.paidTotal,
        items: (bill.items ?? []).map((item) => ({
          quantity: item.quantity,
          productName: item.productName,
          note: item.note,
        })),
        payments,
      }),
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col overflow-hidden sm:max-w-md">
          <SheetHeader className="shrink-0">
            <SheetTitle>Adisyon</SheetTitle>
            <SheetDescription>
              {tableLabel}
              {order ? ` · Sipariş #${order.orderNumber || order.id}` : null}
            </SheetDescription>
          </SheetHeader>

          {processPanel ? (
            <div
              className="mt-3 flex shrink-0 rounded-lg border border-border bg-muted/30 p-0.5"
              role="tablist"
              aria-label="Adisyon panelleri"
            >
              <button
                type="button"
                role="tab"
                aria-selected={sheetPanel === "bill"}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  sheetPanel === "bill"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSheetPanel("bill")}
              >
                Hesap
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sheetPanel === "process"}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  sheetPanel === "process"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSheetPanel("process")}
              >
                Süreç
              </button>
            </div>
          ) : null}

          {sheetPanel === "process" && processPanel ? (
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-6">{processPanel}</div>
          ) : null}

          {sheetPanel === "bill" && tableId == null ? (
            <p className="text-sm text-muted-foreground">
              Bu sipariş masa adisyonuna bağlı değil.
            </p>
          ) : sheetPanel !== "bill" ? null : billQuery.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Adisyon yükleniyor…
            </p>
          ) : billQuery.isError ? (
            <p className="text-sm text-destructive">
              {billQuery.error instanceof WaiterApiError
                ? billQuery.error.message
                : "Adisyon alınamadı"}
            </p>
          ) : bill ? (
            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-6">
              <BillSummaryBar
                total={bill.totalAmount}
                paid={bill.paidTotal}
                remaining={bill.remainingTotal}
                currency={currency}
              />

              {billError ? <p className="text-sm text-destructive">{billError}</p> : null}

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Kalemler
                </p>
                <ul className="space-y-2">
                  {(bill.items ?? []).map((item) => {
                    const paidQty = item.paidQuantity ?? 0;
                    const unpaidQty =
                      item.unpaidQuantity ?? Math.max(0, item.quantity - paidQty);
                    const fullyPaid = unpaidQty <= 0;
                    return (
                      <li
                        key={item.id}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${
                          fullyPaid
                            ? "border-emerald-100 bg-emerald-50/60"
                            : "border-border bg-card"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity}× ·{" "}
                            {formatMenuPrice(item.lineTotal ?? undefined, currency)}
                            {paidQty > 0 ? ` · ${unpaidQty} kalan` : null}
                          </p>
                        </div>
                        {unpaidQty > 0 && canCollect ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setPayItem(item)}
                          >
                            Kısmi öde
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {(bill.items ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Henüz kalem yok.</p>
                ) : null}
              </div>

              <BillPaymentsList
                payments={payments}
                currency={currency}
                busy={busy}
                reversingPaymentId={reversingPaymentId}
                includeTips
                title={closed ? "Ödeme detayı" : "Alınan ödemeler"}
                onReverse={
                  closed
                    ? undefined
                    : (payment) => billMutation.mutate({ kind: "reverse", paymentId: payment.id })
                }
              />

              {closed && payments.length === 0 ? (
                <div className="space-y-1 rounded-lg border border-border px-3 py-2.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Ödeme detayı
                  </p>
                  <p className="text-sm font-medium">
                    {bill.paymentMethod ? paymentMethodLabel(bill.paymentMethod) : "Ödeme alındı"}
                    {" · "}
                    {formatMenuPrice(bill.paidTotal ?? bill.totalAmount ?? undefined, currency)}
                  </p>
                </div>
              ) : null}

              <div className="mt-auto flex flex-col gap-2">
                <Button type="button" variant="outline" className="w-full" onClick={printBill}>
                  <Printer />
                  Fiş yazdır
                </Button>
                {!canCollect && !closed ? (
                  <p className="text-center text-sm text-amber-700">
                    Garson siparişi teslim aldıktan sonra ödeme alınabilir.
                  </p>
                ) : canClose ? (
                  <Button type="button" className="w-full" disabled={busy} onClick={() => setCloseOpen(true)}>
                    Ödeme al · Tam kapat veya hesabı böl
                  </Button>
                ) : closed ? (
                  <p className="text-center text-sm font-medium text-emerald-700">Adisyon kapatıldı</p>
                ) : remaining <= 0.009 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    Kalan tutar: {formatMenuPrice(0, currency)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {bill ? (
        <>
          <BillCloseDialog
            open={closeOpen}
            onOpenChange={setCloseOpen}
            bill={bill}
            tableLabel={tableLabel}
            currency={currency}
            busy={busy}
            onCloseFull={(payload) => billMutation.mutate({ kind: "closeFull", payload })}
            onPayShare={(payload) => billMutation.mutate({ kind: "payShare", payload })}
          />
          <BillItemPayDialog
            open={payItem != null}
            onOpenChange={(next) => {
              if (!next) setPayItem(null);
            }}
            item={payItem}
            currency={currency}
            busy={busy}
            onConfirm={(payload) => billMutation.mutate({ kind: "payItem", payload })}
          />
        </>
      ) : null}
    </>
  );
}
