"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  ClipboardList,
  LayoutGrid,
  List,
  Loader2,
  MapPin,
  Phone,
  Search,
  Timer,
} from "lucide-react";

import { formatMenuPrice } from "@/components/menu-templates/types";
import {
  COURIER_COLUMNS,
  COURIER_KANBAN_SLA_MINUTES,
  courierColumnFor,
  courierElapsedMinutes,
  courierKanbanColumnTitle,
  courierOrderKey,
  courierCanAct,
  courierTicketElapsedLabel,
  groupCourierOrders,
  isCourierTicketDelayed,
  matchesCourierKanbanQuery,
  type CourierColumnId,
} from "@/lib/courier-queue";
import type { CourierTicket } from "@/lib/store-courier";
import { STORE_PAYMENT_METHOD_LABEL, type StorePaymentMethod } from "@/lib/store-ui";
import { cn } from "@/lib/utils";

type CourierDisplayBoardProps = {
  orders: CourierTicket[];
  loading?: boolean;
  error?: string | null;
  busyOrderId?: number | null;
  /** Logged-in courier; tickets the kitchen assigned to this account are highlighted. */
  currentStaffId?: number | null;
  onDispatch?: (orderId: number) => void;
  onDeliver?: (orderId: number) => void;
};

const HIDE_SCROLLBAR =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

type ColumnTone = {
  dot: string;
  count: string;
};

const COLUMN_TONE: Record<CourierColumnId, ColumnTone> = {
  HANDOFF: { dot: "bg-emerald-600", count: "bg-emerald-600 text-white" },
  TAKEN: { dot: "bg-sky-600", count: "bg-sky-600 text-white" },
  DELIVERED: { dot: "bg-emerald-700", count: "bg-emerald-700 text-white" },
};

function formatWhen(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function orderTicketNo(order: CourierTicket): string {
  return `#${order.orderNo || order.id}`;
}

function paymentLabel(method?: string | null): string | null {
  if (!method) return null;
  return STORE_PAYMENT_METHOD_LABEL[method as StorePaymentMethod] ?? method;
}

function useTickingNow(intervalMs = 15_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function CourierDisplayBoard({
  orders,
  loading,
  error,
  busyOrderId,
  currentStaffId,
  onDispatch,
  onDeliver,
}: CourierDisplayBoardProps) {
  const now = useTickingNow(10_000) ?? Date.now();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"board" | "list">("board");
  const [delayedOnly, setDelayedOnly] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      if (!matchesCourierKanbanQuery(order, query)) return false;
      if (delayedOnly && !isCourierTicketDelayed(order, now)) return false;
      return true;
    });
  }, [orders, query, delayedOnly, now]);

  const grouped = useMemo(() => groupCourierOrders(visibleOrders), [visibleOrders]);
  const delayedOrders = useMemo(
    () => visibleOrders.filter((order) => isCourierTicketDelayed(order, now)),
    [visibleOrders, now],
  );
  const waitMinutes = useMemo(
    () =>
      visibleOrders
        .map((order) => courierElapsedMinutes(order, now))
        .filter((value): value is number => value != null),
    [visibleOrders, now],
  );
  const avgWait = waitMinutes.length
    ? Math.round((waitMinutes.reduce((sum, value) => sum + value, 0) / waitMinutes.length) * 10) / 10
    : null;
  const activeCount = grouped.HANDOFF.length + grouped.TAKEN.length;

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const cardProps = { now, busyOrderId, currentStaffId, onDispatch, onDeliver };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {error ? <p className="px-1 pb-2 text-sm text-destructive">{error}</p> : null}

      <section className="shrink-0 border-b border-black/10 bg-[#f2f3ff]/60 px-1 py-2.5">
        <div className={cn("flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs", HIDE_SCROLLBAR)}>
          <div className="flex shrink-0 items-center gap-2">
            <MetricChip label="Aktif teslimat" value={String(activeCount)} />
            <MetricChip label="Alınacak" value={String(grouped.HANDOFF.length)} dotClassName="bg-emerald-600" />
            <MetricChip label="Yolda" value={String(grouped.TAKEN.length)} dotClassName="bg-sky-600" />
            <MetricChip
              delayed={delayedOrders.length > 0}
              label="Gecikme Uyarısı"
              value={String(delayedOrders.length)}
            />
            <MetricChip
              label="Ort. SLA"
              value={avgWait == null ? "—" : `${avgWait} dk`}
              valueClassName="text-emerald-700"
            />
          </div>
          <div className="flex shrink-0 items-center gap-1 text-[11px] text-[#737688]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            <span>Otomatik Senkron (6s)</span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737688]" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Sipariş no, müşteri veya adres ile filtrele..."
              className="w-full rounded-lg border border-black/20 bg-white py-1.5 pl-8 pr-10 text-xs text-[#131b2e] placeholder:text-[#737688] transition-all focus:border-[#0045cc] focus:outline-none focus:ring-1 focus:ring-[#0045cc]"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-black/20 px-1 font-mono text-[10px] text-[#737688]">
              /
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDelayedOnly((value) => !value)}
              className={cn(
                "flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-colors",
                delayedOnly
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-black/20 bg-white text-[#131b2e] hover:bg-[#eaedff]",
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Filtreler
            </button>
            <div className="flex items-center gap-1 rounded-lg border border-black/20 bg-white p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setView("board")}
                className={cn(
                  "flex items-center gap-1 rounded px-2.5 py-1",
                  view === "board" ? "bg-[#eaedff] font-semibold text-[#131b2e]" : "text-[#737688] hover:bg-[#f2f3ff]",
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Pano
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "flex items-center gap-1 rounded px-2.5 py-1",
                  view === "list" ? "bg-[#eaedff] font-semibold text-[#131b2e]" : "text-[#737688] hover:bg-[#f2f3ff]",
                )}
              >
                <List className="h-3.5 w-3.5" />
                Liste
              </button>
            </div>
          </div>
        </div>
      </section>

      {view === "list" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-3">
          {visibleOrders.length === 0 ? (
            <p className="py-12 text-center text-sm font-medium text-slate-400">Eşleşen sipariş yok.</p>
          ) : (
            visibleOrders.map((order) => (
              <CourierOrderCard
                key={courierOrderKey(order)}
                order={order}
                columnId={courierColumnFor(order.status) ?? "HANDOFF"}
                {...cardProps}
              />
            ))
          )}
        </div>
      ) : (
        <div className={cn("flex min-h-0 flex-1 snap-x snap-mandatory items-start gap-4 overflow-x-auto py-3", HIDE_SCROLLBAR)}>
          {COURIER_COLUMNS.map((column) => {
            const columnOrders = grouped[column.id];
            const tone = COLUMN_TONE[column.id];
            return (
              <section
                key={column.id}
                className="flex w-[320px] max-h-full min-h-0 shrink-0 snap-start flex-col gap-3 rounded-xl border-2 border-black bg-[#f2f3ff] p-3 shadow-[3px_3px_0px_#000] lg:min-h-[28rem] lg:flex-1 lg:basis-0"
              >
                <div className="flex items-center justify-between border-b-2 border-black px-1 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-3 w-3 rounded-full border border-black", tone.dot)} />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-black">
                      {courierKanbanColumnTitle(column.id)}
                    </h3>
                  </div>
                  <span
                    className={cn(
                      "rounded-md border border-black px-2 py-0.5 text-xs font-extrabold shadow-[1px_1px_0px_#000]",
                      tone.count,
                    )}
                  >
                    {columnOrders.length}
                  </span>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
                  {columnOrders.length === 0 ? (
                    <p className="px-1 py-8 text-center text-sm font-medium text-slate-400">Boş</p>
                  ) : (
                    columnOrders.map((order) => (
                      <CourierOrderCard
                        key={courierOrderKey(order)}
                        order={order}
                        columnId={column.id}
                        {...cardProps}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricChip({
  label,
  value,
  dotClassName,
  delayed,
  valueClassName,
}: {
  label: string;
  value: string;
  dotClassName?: string;
  delayed?: boolean;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded border bg-white px-2.5 py-1",
        delayed ? "border-red-300 text-red-700" : "border-black/20",
      )}
    >
      {delayed ? (
        <span className="pulse-dot-red h-2 w-2 rounded-full bg-red-600" />
      ) : dotClassName ? (
        <span className={cn("h-2 w-2 rounded-full", dotClassName)} />
      ) : null}
      <span className={cn("font-medium", delayed ? "font-semibold text-red-700" : "text-[#737688]")}>{label}:</span>
      <span className={cn("font-bold", delayed ? "text-red-700" : "text-[#131b2e]", valueClassName)}>{value}</span>
    </div>
  );
}

function CourierOrderCard({
  order,
  columnId,
  now,
  busyOrderId,
  currentStaffId,
  onDispatch,
  onDeliver,
}: {
  order: CourierTicket;
  columnId: CourierColumnId;
  now: number;
  busyOrderId?: number | null;
  currentStaffId?: number | null;
  onDispatch?: (orderId: number) => void;
  onDeliver?: (orderId: number) => void;
}) {
  const assignedToMe = currentStaffId != null && order.courierStaffId === currentStaffId;
  const delayed = isCourierTicketDelayed(order, now);
  const elapsed = courierTicketElapsedLabel(order, now);
  const minutes = courierElapsedMinutes(order, now);
  const busy = busyOrderId === order.id;
  const action = courierCanAct(order, currentStaffId);
  const pay = paymentLabel(order.paymentMethod);
  const phone = order.customerPhone.trim();

  const elapsedTone =
    delayed
      ? "font-bold text-red-600"
      : columnId === "HANDOFF" || columnId === "TAKEN"
        ? "font-bold text-amber-700"
        : "font-bold text-[#434656]";

  return (
    <article className="flex flex-col gap-2.5 rounded-xl border-2 border-black bg-white p-3.5 shadow-[2px_2px_0px_#000] transition-all hover:-translate-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="rounded border border-black bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-black">
            {orderTicketNo(order)}
          </span>
          {columnId === "DELIVERED" && minutes != null ? (
            <span className="rounded border border-emerald-400 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-extrabold text-emerald-700">
              • {minutes} dk SLA{minutes < COURIER_KANBAN_SLA_MINUTES ? " (Başarılı)" : ""}
            </span>
          ) : elapsed ? (
            <span className={cn("truncate text-[11px]", elapsedTone)}>• {elapsed} önce</span>
          ) : null}
        </div>
        {columnId === "DELIVERED" ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : delayed ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-black bg-amber-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
            <AlertTriangle className="h-3 w-3" /> SLA Riski
          </span>
        ) : assignedToMe && columnId === "HANDOFF" ? (
          <span className="rounded-full border border-black bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
            Size verildi
          </span>
        ) : (
          <span className="rounded-full border border-black bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-900">
            Teslimat
          </span>
        )}
      </div>

      <div>
        <div className="text-sm font-bold text-black">{order.customerName || "Müşteri"}</div>
        <div
          className={cn(
            "mt-1 flex items-start gap-1",
            columnId === "DELIVERED" ? "text-xs font-medium text-[#434656]" : "text-sm font-semibold text-black",
          )}
        >
          {columnId === "DELIVERED" ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
          ) : columnId === "TAKEN" ? (
            <Bike className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black" />
          ) : (
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black" />
          )}
          <span className="min-w-0 break-words">
            {columnId === "DELIVERED"
              ? `${formatWhen(order.deliveredAt)}'de teslim edildi`
              : order.deliveryAddress || "Adres yok"}
          </span>
        </div>
      </div>

      <CourierOrderItemList order={order} />

      {order.note ? (
        <p className="rounded-md border border-black/20 bg-slate-50 px-2 py-1.5 text-xs font-medium text-black">
          Müşteri: {order.note}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {phone ? (
          <a
            href={`tel:${phone}`}
            className="inline-flex h-7 items-center gap-1 rounded-lg border-2 border-black bg-white px-2 text-[11px] font-bold text-black shadow-[1px_1px_0px_#000] hover:bg-slate-100"
          >
            <Phone className="h-3 w-3" />
            {phone}
          </a>
        ) : null}
        {pay ? (
          <span className="rounded border border-black/20 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-black">
            {pay}
          </span>
        ) : null}
      </div>

      {columnId === "DELIVERED" ? (
        <div className="flex items-center justify-end border-t border-black/20 pt-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
            <ClipboardList className="h-3.5 w-3.5" />
            Tamamlandı
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 border-t border-black/20 pt-2">
          <span className="inline-flex items-center gap-1 rounded border border-amber-500 bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
            <Timer className="h-3 w-3" />
            {delayed ? "SLA aşıldı" : `SLA: ${Math.max(1, COURIER_KANBAN_SLA_MINUTES - (minutes ?? 0))} dk`}
          </span>
          {action?.action === "dispatch" && onDispatch ? (
            <KanbanAction busy={busy} tone="emerald" onClick={() => onDispatch(order.id)}>
              {action.label}
            </KanbanAction>
          ) : null}
          {action?.action === "deliver" && onDeliver ? (
            <KanbanAction busy={busy} tone="amber" onClick={() => onDeliver(order.id)}>
              {action.label}
            </KanbanAction>
          ) : null}
        </div>
      )}
    </article>
  );
}

function CourierOrderItemList({ order }: { order: CourierTicket }) {
  const items = order.items ?? [];
  return (
    <div className="flex flex-col gap-1.5 border-t-2 border-dashed border-black/30 pt-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-bold text-black">Sipariş detayı</span>
        <span className="shrink-0 rounded border border-emerald-600 bg-emerald-100 px-1.5 py-0.5 font-extrabold text-emerald-700">
          {formatMenuPrice(order.totalAmount, order.currency || "TRY")}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs font-medium text-[#434656]">Ürün yok</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, index) => (
            <li key={`${order.id}-${item.productId}-${index}`} className="text-sm leading-snug text-black">
              <span className="font-extrabold">{item.quantity}×</span>{" "}
              <span className="font-semibold">{item.productName || `#${item.productId}`}</span>
              {item.options.length > 0 ? (
                <span className="mt-0.5 block text-xs font-medium text-[#434656]">{item.options.join(", ")}</span>
              ) : null}
              {item.note ? (
                <span className="mt-0.5 block text-xs font-medium text-[#434656]">Not: {item.note}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KanbanAction({
  busy,
  tone,
  onClick,
  children,
}: {
  busy: boolean;
  tone: "emerald" | "amber";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1 rounded-lg border-2 border-black px-3 text-xs font-bold text-white shadow-[1.5px_1.5px_0px_#000] transition-colors disabled:opacity-50",
        tone === "emerald" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-500 hover:bg-amber-600",
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}
