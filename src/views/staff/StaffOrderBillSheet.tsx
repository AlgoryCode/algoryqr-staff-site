"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, CircleDollarSign, Clock, Loader2, Plus, Printer, X } from "lucide-react";

import { OrderCancelDialog } from "@/components/orders/OrderCancelDialog";
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
import {
  forceOrderFlowStatus,
  orderCancelReasonLabel,
  orderFlowStatusLabel,
  waiterCanCollectOnOrders,
  type OrderCancelRequest,
} from "@/lib/order-flow";
import { orderLocationLabel } from "@/lib/order-management";
import type { OrderResponse } from "@/lib/ordering-api";
import { billToReceipt, kitchenOrderToReceipt, printReceiptInBrowser } from "@/lib/receipt-ticket";
import {
  cancelWaiterBill,
  closeWaiterBill,
  getWaiterBill,
  getWaiterOpenBill,
  getWaiterOrder,
  listWaiterTableTodayOrders,
  markWaiterServiceDelivered,
  payWaiterBillItems,
  payWaiterBillShare,
  reverseWaiterBillPayment,
  type WaiterBill,
  type WaiterBillItem,
  type WaiterTableSummary,
  WaiterApiError,
} from "@/lib/waiter-api";
import { WaiterAddOrderSheet } from "@/views/personel/WaiterAddOrderSheet";

type SheetPanel = "bill" | "process" | "history";

type StaffOrderBillSheetProps = {
  order: OrderResponse | null;
  table?: WaiterTableSummary | null;
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
  table,
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
  const [cancelOpen, setCancelOpen] = useState(false);
  const [payItem, setPayItem] = useState<WaiterBillItem | null>(null);
  const [reversingPaymentId, setReversingPaymentId] = useState<number | null>(null);
  const [billError, setBillError] = useState<string | null>(null);
  const [sheetPanel, setSheetPanel] = useState<SheetPanel>(defaultPanel);
  const [addProductsOpen, setAddProductsOpen] = useState(false);
  const [historyDetailOrderId, setHistoryDetailOrderId] = useState<number | null>(null);

  useEffect(() => {
    if (open) setSheetPanel(defaultPanel);
    if (!open) {
      setAddProductsOpen(false);
      setHistoryDetailOrderId(null);
    }
    // order?.id bilinçli olarak yok: geçmişten sipariş seçince üst başlık güncellenir
    // ama sekme Hesap'a dönmemeli.
  }, [open, defaultPanel, tableId]);

  useEffect(() => {
    if (sheetPanel !== "history") setHistoryDetailOrderId(null);
  }, [sheetPanel]);

  const detailQuery = useQuery({
    queryKey: ["staff-waiter-order", historyDetailOrderId],
    enabled: open && historyDetailOrderId != null && sheetPanel === "history",
    queryFn: () => getWaiterOrder(historyDetailOrderId!),
  });

  const historyQuery = useQuery({
    queryKey: ["staff-waiter-table-today", tableId],
    enabled: open && tableId != null && sheetPanel === "history",
    queryFn: () => listWaiterTableTodayOrders(tableId!),
    staleTime: 30_000,
  });

  const historyOrders = useMemo(() => {
    const rows = historyQuery.data ?? [];
    return [...rows].sort((a, b) => orderHistoryTimestamp(b) - orderHistoryTimestamp(a));
  }, [historyQuery.data]);

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
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-waiter-bill", tableId] }),
      queryClient.invalidateQueries({ queryKey: ["staff-waiter-table-today", tableId] }),
    ]);
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
        | { kind: "reverse"; paymentId: number }
        | { kind: "cancel"; request: OrderCancelRequest },
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
      if (action.kind === "cancel") {
        return cancelWaiterBill(bill.id, action.request);
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
      if (action.kind === "cancel") {
        setCancelOpen(false);
        onBillUpdated?.();
        onOpenChange(false);
        return;
      }
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
  const billTotalAmount = Number(bill?.totalAmount ?? 0);
  const addOrderTable = table ?? tableFromOrder(order);
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
              {historyDetailOrderId != null && detailQuery.data
                ? ` · Sipariş #${detailQuery.data.orderNumber || detailQuery.data.id}`
                : order
                  ? ` · Sipariş #${order.orderNumber || order.id}`
                  : null}
            </SheetDescription>
          </SheetHeader>

          {tableId != null ? (
            <div
              className="mt-3 flex shrink-0 rounded-lg border border-border bg-muted/30 p-0.5"
              role="tablist"
              aria-label="Adisyon panelleri"
            >
              <button
                type="button"
                role="tab"
                aria-selected={sheetPanel === "bill"}
                className={`flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${
                  sheetPanel === "bill"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSheetPanel("bill")}
              >
                Hesap
              </button>
              {processPanel ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={sheetPanel === "process"}
                  className={`flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${
                    sheetPanel === "process"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setSheetPanel("process")}
                >
                  Süreç
                </button>
              ) : null}
              <button
                type="button"
                role="tab"
                aria-selected={sheetPanel === "history"}
                className={`flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${
                  sheetPanel === "history"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSheetPanel("history")}
              >
                Sipariş geçmişi
              </button>
            </div>
          ) : null}

          {sheetPanel === "process" && processPanel ? (
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-6">{processPanel}</div>
          ) : null}

          {sheetPanel === "history" && tableId != null ? (
            <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden pb-2">
              {historyDetailOrderId != null ? (
                <>
                  <div className="relative flex shrink-0 items-center justify-center pb-2">
                    <button
                      type="button"
                      className="absolute left-0 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Geçmiş listesine dön"
                      onClick={() => setHistoryDetailOrderId(null)}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <p className="text-sm font-semibold">Sipariş detayı</p>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {detailQuery.isLoading ? (
                      <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Yükleniyor…
                      </p>
                    ) : detailQuery.isError ? (
                      <p className="py-4 text-center text-sm text-destructive">
                        {detailQuery.error instanceof WaiterApiError
                          ? detailQuery.error.message
                          : "Sipariş alınamadı"}
                      </p>
                    ) : detailQuery.data ? (
                      <BillOrderDetail order={detailQuery.data} currency={currency} />
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <p className="shrink-0 text-center text-xs text-muted-foreground">Bugün · {tableLabel}</p>
                  <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {historyQuery.isLoading ? (
                      <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Yükleniyor…
                      </p>
                    ) : historyQuery.isError ? (
                      <p className="py-4 text-center text-sm text-destructive">
                        {historyQuery.error instanceof WaiterApiError
                          ? historyQuery.error.message
                          : "Siparişler alınamadı"}
                      </p>
                    ) : historyOrders.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">Bugün sipariş yok.</p>
                    ) : (
                      <ul className="space-y-2 pb-2">
                        {historyOrders.map((historyOrder) => (
                          <li key={historyOrder.id}>
                            <button
                              type="button"
                              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left shadow-sm transition-colors hover:bg-muted/50"
                              onClick={() => setHistoryDetailOrderId(historyOrder.id)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold">
                                  #{historyOrder.orderNumber || historyOrder.id}
                                </p>
                                <p className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
                                  <Clock className="h-3.5 w-3.5" aria-hidden />
                                  {formatOrderHistoryTime(historyOrder)}
                                </p>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {orderFlowStatusLabel(historyOrder.status)}
                                {historyOrder.totalAmount != null
                                  ? ` · ${formatMenuPrice(
                                      historyOrder.totalAmount,
                                      historyOrder.currency || currency,
                                    )}`
                                  : null}
                              </p>
                              <BillHistoryOrderItems order={historyOrder} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
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
            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pb-2">
              <div className="shrink-0 space-y-3">
                <BillSummaryBar
                  total={bill.totalAmount}
                  paid={bill.paidTotal}
                  remaining={bill.remainingTotal}
                  currency={currency}
                />

                <div className="flex flex-wrap items-start justify-center gap-x-3 gap-y-2">
                  {!closed && tableId != null ? (
                    <BillIconAction label="Ürün ekle" onClick={() => setAddProductsOpen(true)}>
                      <Plus className="h-5 w-5" />
                    </BillIconAction>
                  ) : null}
                  {canClose ? (
                    <BillIconAction
                      label="Ödeme al"
                      disabled={busy}
                      variant="default"
                      onClick={() => setCloseOpen(true)}
                    >
                      <CircleDollarSign className="h-5 w-5" />
                    </BillIconAction>
                  ) : null}
                  <BillIconAction label="Fiş yazdır" variant="outline" onClick={printBill}>
                    <Printer className="h-5 w-5" />
                  </BillIconAction>
                  {!closed ? (
                    <BillIconAction
                      label="İptal"
                      variant="outline"
                      tone="destructive"
                      disabled={busy}
                      onClick={() => setCancelOpen(true)}
                    >
                      <X className="h-5 w-5" />
                    </BillIconAction>
                  ) : null}
                </div>

                {!canCollect && !closed ? (
                  <p className="text-center text-xs text-amber-700">
                    Garson siparişi teslim aldıktan sonra ödeme alınabilir.
                  </p>
                ) : closed ? (
                  <p className="text-center text-xs font-medium text-emerald-700">Adisyon kapatıldı</p>
                ) : !canClose && !closed && remaining <= 0.009 ? (
                  <p className="text-center text-xs text-muted-foreground">
                    Kalan tutar: {formatMenuPrice(0, currency)}
                  </p>
                ) : null}

                {billError ? <p className="text-sm text-destructive">{billError}</p> : null}
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-0.5">
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
              </div>
            </div>
          ) : tableId != null && !billQuery.isLoading && !billQuery.isError ? (
            <div className="mt-4 flex min-h-0 flex-1 flex-col items-center justify-center gap-4 pb-6">
              <p className="text-center text-sm text-muted-foreground">Bu masada henüz açık adisyon yok.</p>
              <BillIconAction label="Ürün ekle" onClick={() => setAddProductsOpen(true)}>
                <Plus className="h-5 w-5" />
              </BillIconAction>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <WaiterAddOrderSheet
        table={addOrderTable}
        billId={bill?.status === "OPEN" ? bill.id : null}
        baseTotal={billTotalAmount}
        currency={currency}
        open={addProductsOpen}
        onOpenChange={setAddProductsOpen}
        onCreated={() => {
          setAddProductsOpen(false);
          void invalidateBill();
        }}
      />

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
          <OrderCancelDialog
            open={cancelOpen}
            title="Adisyonu iptal et"
            confirmLabel="Adisyonu iptal et"
            subject={tableLabel || bill.tableName || "Adisyon"}
            description="Açık adisyon ve bağlı siparişler iptal edilir. Ödeme alınmışsa iptal edilmez."
            error={billError}
            busy={busy}
            onOpenChange={setCancelOpen}
            onConfirm={(request) => billMutation.mutate({ kind: "cancel", request })}
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

function BillIconAction({
  label,
  onClick,
  disabled = false,
  variant = "secondary",
  tone = "default",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "secondary" | "outline";
  tone?: "default" | "destructive";
  children: ReactNode;
}) {
  return (
    <div className="flex w-[4.25rem] flex-col items-center gap-1">
      <Button
        type="button"
        size="icon"
        variant={variant}
        className={`h-11 w-11 shrink-0 ${
          tone === "destructive"
            ? "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            : ""
        }`}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </Button>
      <span className="max-w-[4.25rem] text-center text-[10px] leading-tight text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function BillOrderDetail({ order, currency }: { order: OrderResponse; currency: string }) {
  const items = order.items ?? [];
  const orderCurrency = order.currency || currency;
  const cancelNote = orderCancelReasonLabel(order);
  return (
    <div className="relative space-y-4 pb-4 pt-1">
      <button
        type="button"
        className="absolute right-0 top-0 inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
        aria-label="Fiş yazdır"
        title="Fiş yazdır"
        onClick={() => printOrderReceipt(order)}
      >
        <Printer className="h-4 w-4" />
      </button>
      <div className="rounded-lg border border-border bg-card px-3 py-3 pr-12">
        <p className="text-lg font-semibold">#{order.orderNumber || order.id}</p>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
          {formatOrderHistoryDateTime(order)}
        </p>
        <p className="mt-2 text-sm font-medium">{orderFlowStatusLabel(order.status)}</p>
        {cancelNote ? <p className="mt-1 text-sm text-destructive">{cancelNote}</p> : null}
        {order.totalAmount != null ? (
          <p className="mt-2 text-base font-semibold tabular-nums">
            {formatMenuPrice(order.totalAmount, orderCurrency)}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ürünler</p>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Kalem yok.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li
                key={`${order.id}-${item.productId}-${index}`}
                className="flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.productName || "Ürün"}</p>
                  {item.note?.trim() ? (
                    <p className="text-xs text-muted-foreground">{item.note.trim()}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {item.quantity}×
                  {item.lineTotal != null
                    ? ` · ${formatMenuPrice(item.lineTotal, orderCurrency)}`
                    : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {order.kitchenNote?.trim() ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-medium text-amber-900">Mutfak notu</p>
          <p className="text-sm text-amber-950">{order.kitchenNote.trim()}</p>
        </div>
      ) : null}
      {order.note?.trim() ? (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">Not</p>
          <p className="text-sm">{order.note.trim()}</p>
        </div>
      ) : null}
    </div>
  );
}

function printOrderReceipt(order: OrderResponse) {
  printReceiptInBrowser(
    kitchenOrderToReceipt({
      ...order,
      note: [order.note, order.kitchenNote, order.waiterNote].filter(Boolean).join(" | ") || null,
    }),
  );
}

function BillHistoryOrderItems({ order }: { order: OrderResponse }) {
  const items = order.items ?? [];
  if (items.length === 0 && !order.kitchenNote && !order.note) return null;
  const visible = items.slice(0, 6);
  const rest = items.length - visible.length;
  return (
    <div className="mt-2 space-y-1">
      {visible.length > 0 ? (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {visible.map((item, index) => (
            <li key={`${order.id}-${item.productId}-${index}`}>
              {item.quantity}× {item.productName || "Ürün"}
            </li>
          ))}
          {rest > 0 ? <li>+{rest} ürün</li> : null}
        </ul>
      ) : null}
      {order.kitchenNote?.trim() || order.note?.trim() ? (
        <p className="text-xs text-amber-800">{order.kitchenNote?.trim() || order.note?.trim()}</p>
      ) : null}
    </div>
  );
}

function orderHistoryTimestamp(order: OrderResponse): number {
  const raw = order.submittedAt || order.createdAt || order.readyAt;
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function formatOrderHistoryTime(order: OrderResponse): string {
  const raw = order.submittedAt || order.createdAt;
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function formatOrderHistoryDateTime(order: OrderResponse): string {
  const raw = order.submittedAt || order.createdAt;
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tableFromOrder(order: OrderResponse | null): WaiterTableSummary | null {
  if (order?.tableId == null) return null;
  return {
    tableId: order.tableId,
    tableName: order.tableName ?? null,
    tableNumber: null,
    areaId: null,
    areaName: null,
    active: true,
    pendingOrderCount: 0,
    openBillId: order.billId ?? null,
  };
}
