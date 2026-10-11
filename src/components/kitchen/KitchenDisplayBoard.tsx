"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Bike,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  LayoutGrid,
  List,
  Loader2,
  MapPin,
  Search,
  Timer,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";

import { formatMenuPrice } from "@/components/menu-templates/types";
import { OrderCancelDialog } from "@/components/orders/OrderCancelDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  groupKitchenOrders,
  isKitchenTicketDelayed,
  kitchenAllowsCancel,
  kitchenAllowsNote,
  kitchenColumnFor,
  kitchenColumnTitle,
  kitchenCourierHandover,
  kitchenElapsedMinutes,
  kitchenHandoverTarget,
  kitchenKanbanColumnTitle,
  kitchenOrderKey,
  kitchenOrderOrigin,
  kitchenOrderOriginLabel,
  kitchenPrepProgress,
  kitchenReadyHandoverLabel,
  kitchenSkipsPreparing,
  kitchenTableLabel,
  kitchenTicketElapsedLabel,
  kitchenUsesCourier,
  KITCHEN_COLUMNS,
  KITCHEN_KANBAN_SLA_MINUTES,
  matchesKitchenKanbanQuery,
  type KitchenBoardMode,
  type KitchenColumnId,
  type KitchenHandoverTarget,
  type KitchenOrderOrigin,
} from "@/lib/kitchen-queue";
import {
  isOrderCancellable,
  kitchenOrderActions,
  orderCancelReasonLabel,
  orderIsDelivery,
  type KitchenRevertTarget,
  type OrderCancelRequest,
  type OrderFlowAction,
  type OrderFlowStep,
} from "@/lib/order-flow";
import type { OrderResponse } from "@/lib/ordering-api";
import type { KitchenCourierOption } from "@/lib/store-kitchen";
import { cn } from "@/lib/utils";

export type { KitchenBoardMode };

type KitchenDisplayBoardProps = {
  orders: OrderResponse[];
  loading?: boolean;
  error?: string | null;
  mode: KitchenBoardMode;
  busyOrderId?: number | null;
  busyOrderKey?: string | null;
  kitchenEnabled?: boolean;
  courierEnabled?: boolean;
  onStartPreparing?: (orderId: number, orderSource?: string | null) => void;
  onMarkReady?: (orderId: number, orderSource?: string | null) => void;
  onMarkServed?: (orderId: number) => void;
  onFlowAction?: (orderId: number, action: OrderFlowAction, orderSource?: string | null) => void;
  onRevert?: (orderId: number, to: KitchenRevertTarget, orderSource?: string | null) => void;
  onCancel?: (orderId: number, request: OrderCancelRequest, orderSource?: string | null) => void;
  /** Courier accounts for online/phone delivery orders; undefined while loading. */
  couriers?: KitchenCourierOption[];
  onCourierHandover?: (order: OrderResponse, courierStaffId: number) => void;
  onSaveKitchenNote?: (orderId: number, note: string) => void;
};

type KitchenDrop =
  | { kind: "flow"; action: OrderFlowAction }
  | { kind: "revert"; to: KitchenRevertTarget }
  | { kind: "handover" }
  | { kind: "cancel" };

const BOARD_COLUMN_ORDER: KitchenColumnId[] = ["CONFIRMED", "PREPARING", "READY", "SERVED"];

const HANDOVER_ACTIONS = new Set<OrderFlowAction>([
  "markKitchenDeliveredToWaiter",
  "markKitchenDeliveredToCourier",
]);

const HANDOVER_ACTION: Record<KitchenHandoverTarget, OrderFlowAction> = {
  WAITER: "markKitchenDeliveredToWaiter",
  COURIER: "markKitchenDeliveredToCourier",
};

const HANDOVER_LABEL: Record<KitchenHandoverTarget, string> = {
  WAITER: "Garsona teslim",
  COURIER: "Kuryeye teslim",
};

const CANCELLABLE_COLUMNS = new Set<KitchenColumnId>(["CONFIRMED", "PREPARING", "READY"]);

function kitchenBoardColumn(order: OrderResponse): KitchenColumnId {
  return kitchenColumnFor(order) ?? "CONFIRMED";
}

function kitchenTicketActions(
  order: OrderResponse,
  kitchenEnabled: boolean,
  courierEnabled: boolean,
): OrderFlowStep[] {
  const usesCourier = kitchenUsesCourier(kitchenOrderOrigin(order), order.deliveryType);
  return kitchenOrderActions(order.status, {
    kitchenEnabled,
    courierEnabled: courierEnabled && usesCourier,
    delivery: usesCourier,
  });
}

/** Forward steps shown as buttons; kitchen handovers are collapsed into one "Teslim et" choice. */
function kitchenForwardActions(
  order: OrderResponse,
  kitchenEnabled: boolean,
  courierEnabled: boolean,
): OrderFlowStep[] {
  return kitchenTicketActions(order, kitchenEnabled, courierEnabled).filter(
    (step) => !HANDOVER_ACTIONS.has(step.action),
  );
}

function kitchenCanHandover(order: OrderResponse, kitchenEnabled: boolean, courierEnabled: boolean): boolean {
  return kitchenTicketActions(order, kitchenEnabled, courierEnabled).some((step) =>
    HANDOVER_ACTIONS.has(step.action),
  );
}

function kitchenCanCancel(order: OrderResponse): boolean {
  const column = kitchenColumnFor(order);
  return (
    column != null &&
    CANCELLABLE_COLUMNS.has(column) &&
    kitchenAllowsCancel(kitchenOrderOrigin(order)) &&
    isOrderCancellable(order.status, orderIsDelivery(order))
  );
}

function suggestedHandover(order: OrderResponse, courierEnabled: boolean): KitchenHandoverTarget {
  const usesCourier = kitchenUsesCourier(kitchenOrderOrigin(order), order.deliveryType);
  return courierEnabled && usesCourier ? "COURIER" : "WAITER";
}

function kitchenDropAction(
  order: OrderResponse,
  target: KitchenColumnId,
  kitchenEnabled: boolean,
  courierEnabled: boolean,
): OrderFlowAction | null {
  const step = kitchenForwardActions(order, kitchenEnabled, courierEnabled).find(
    (item) => kitchenColumnFor({ status: item.status, deliveryType: order.deliveryType }) === target,
  );
  return step?.action ?? null;
}

/** Handed-off (SERVED) and marketplace tickets cannot move back; their state already left the kitchen. */
function kitchenRevertTarget(order: OrderResponse, target: KitchenColumnId): KitchenRevertTarget | null {
  if (target !== "CONFIRMED" && target !== "PREPARING") return null;
  if (kitchenSkipsPreparing(kitchenOrderOrigin(order))) return null;
  const current = kitchenColumnFor(order);
  if (current !== "PREPARING" && current !== "READY") return null;
  return BOARD_COLUMN_ORDER.indexOf(target) < BOARD_COLUMN_ORDER.indexOf(current) ? target : null;
}

function kitchenDropFor(
  order: OrderResponse,
  target: KitchenColumnId,
  options: {
    kitchenEnabled: boolean;
    courierEnabled: boolean;
    canFlow: boolean;
    canRevert: boolean;
    canCancel: boolean;
  },
): KitchenDrop | null {
  if (target === "CANCELLED") {
    return options.canCancel && kitchenCanCancel(order) ? { kind: "cancel" } : null;
  }
  if (options.canFlow) {
    if (target === "SERVED" && kitchenCanHandover(order, options.kitchenEnabled, options.courierEnabled)) {
      return { kind: "handover" };
    }
    const action = kitchenDropAction(order, target, options.kitchenEnabled, options.courierEnabled);
    if (action) return { kind: "flow", action };
  }
  if (options.canRevert) {
    const to = kitchenRevertTarget(order, target);
    if (to) return { kind: "revert", to };
  }
  return null;
}

function kitchenActionLabel(step: OrderFlowStep): string {
  return step.action === "markKitchenPreparing" ? "Hazırlamaya başla" : step.label;
}

function isTicketBusy(
  order: OrderResponse,
  busyOrderId?: number | null,
  busyOrderKey?: string | null,
): boolean {
  return busyOrderKey ? busyOrderKey === kitchenOrderKey(order) : busyOrderId === order.id;
}

const HIDE_SCROLLBAR =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

type ColumnTone = {
  dot: string;
  badge: string;
};

const COLUMN_TONE: Record<KitchenColumnId, ColumnTone> = {
  CONFIRMED: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
  PREPARING: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
  READY: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  SERVED: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  CANCELLED: { dot: "bg-red-500", badge: "bg-red-50 text-red-700" },
};

const ORIGIN_BADGE_CLASS: Record<KitchenOrderOrigin, string> = {
  YEMEKSEPETI: "bg-amber-50 text-amber-800 border-amber-200/60",
  UBER_EATS: "bg-emerald-50 text-emerald-800 border-emerald-200/60",
  ONLINE: "bg-emerald-50/80 text-emerald-700 border-emerald-100",
  PHONE: "bg-amber-50 text-amber-800 border-amber-200/70",
  TABLE: "bg-slate-100 text-slate-700 border-slate-200/60",
};

function formatWhen(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function orderTicketNo(order: OrderResponse): string {
  const reference = order.orderNumber?.trim() || order.externalOrderId?.trim();
  return `#${reference || order.id}`;
}

function orderItemSummary(order: OrderResponse): string {
  const items = order.items ?? [];
  if (items.length === 0) return "Ürün yok";
  return items
    .map((item) => `${item.quantity}x ${item.productName || `#${item.productId}`}`)
    .join(", ");
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

function locationLine(order: OrderResponse): string {
  const origin = kitchenOrderOrigin(order);
  if (origin === "TABLE") return kitchenTableLabel(order);
  const address = order.deliveryAddress?.trim();
  if (address) return address;
  const phone = order.customerPhone?.trim();
  if (phone) return phone;
  return kitchenOrderOriginLabel(origin);
}

function findOrderByKey(orders: OrderResponse[], key: string | null): OrderResponse | null {
  return key ? orders.find((order) => kitchenOrderKey(order) === key) ?? null : null;
}

function cancelledLine(order: OrderResponse): string {
  const at = order.cancelledAt || order.rejectedAt || order.updatedAt;
  const reason = orderCancelReasonLabel(order);
  return [at ? `${formatWhen(at)}'de iptal edildi` : "İptal edildi", reason].filter(Boolean).join(" · ");
}

function handedTo(order: OrderResponse, target: KitchenHandoverTarget): string | null {
  const who = target === "COURIER" ? order.courierStaffName : order.waiterName;
  return who?.trim() || null;
}

function handedLine(order: OrderResponse): string {
  const target = kitchenHandoverTarget(order.status) ?? "WAITER";
  return [
    order.servedAt ? `${formatWhen(order.servedAt)}'de teslim edildi` : "Teslim edildi",
    HANDOVER_LABEL[target],
    handedTo(order, target),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function KitchenDisplayBoard({
  orders,
  loading,
  error,
  mode,
  busyOrderId,
  busyOrderKey,
  kitchenEnabled = true,
  courierEnabled = false,
  onStartPreparing,
  onMarkReady,
  onMarkServed,
  onFlowAction,
  onRevert,
  onCancel,
  couriers,
  onCourierHandover,
  onSaveKitchenNote,
}: KitchenDisplayBoardProps) {
  const isWaiter = mode === "waiter";
  const isKitchen = mode === "kitchen";
  const columns = isWaiter ? KITCHEN_COLUMNS.filter((column) => column.id !== "SERVED") : KITCHEN_COLUMNS;
  const fillHeight = isKitchen;
  const now = useTickingNow(10_000) ?? Date.now();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"board" | "list">("board");
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [handoverKey, setHandoverKey] = useState<string | null>(null);
  const [cancelKey, setCancelKey] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedOrder = useMemo(() => findOrderByKey(orders, selectedKey), [orders, selectedKey]);
  const draggingOrder = useMemo(() => findOrderByKey(orders, draggingKey), [orders, draggingKey]);
  const handoverOrder = useMemo(() => findOrderByKey(orders, handoverKey), [orders, handoverKey]);
  const cancelOrder = useMemo(() => findOrderByKey(orders, cancelKey), [orders, cancelKey]);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const dropOptions = {
    kitchenEnabled,
    courierEnabled,
    canFlow: Boolean(onFlowAction),
    canRevert: Boolean(onRevert),
    canCancel: Boolean(onCancel),
  };
  const handleDragStart = (event: DragStartEvent) => setDraggingKey(String(event.active.id));
  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingKey(null);
    const order = orders.find((item) => kitchenOrderKey(item) === event.active.id);
    const target = event.over?.id as KitchenColumnId | undefined;
    if (!order || !target) return;
    const drop = kitchenDropFor(order, target, dropOptions);
    if (drop?.kind === "flow") onFlowAction?.(order.id, drop.action, order.orderSource);
    if (drop?.kind === "revert") onRevert?.(order.id, drop.to, order.orderSource);
    if (drop?.kind === "handover") setHandoverKey(kitchenOrderKey(order));
    if (drop?.kind === "cancel") setCancelKey(kitchenOrderKey(order));
  };
  const requestHandover = (order: OrderResponse) => {
    setSelectedKey(null);
    setHandoverKey(kitchenOrderKey(order));
  };
  const requestCancel = onCancel
    ? (order: OrderResponse) => {
        setSelectedKey(null);
        setCancelKey(kitchenOrderKey(order));
      }
    : undefined;

  useEffect(() => {
    if (isWaiter) return;
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
  }, [isWaiter]);

  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      if (!matchesKitchenKanbanQuery(order, query)) return false;
      if (delayedOnly && !isKitchenTicketDelayed(order, now)) return false;
      return true;
    });
  }, [orders, query, delayedOnly, now]);

  const grouped = useMemo(() => groupKitchenOrders(visibleOrders), [visibleOrders]);
  const delayedOrders = useMemo(
    () => visibleOrders.filter((order) => isKitchenTicketDelayed(order, now)),
    [visibleOrders, now],
  );
  const waitMinutes = useMemo(
    () =>
      visibleOrders
        .map((order) => kitchenElapsedMinutes(order, now))
        .filter((value): value is number => value != null),
    [visibleOrders, now],
  );
  const avgWait = waitMinutes.length
    ? Math.round((waitMinutes.reduce((sum, value) => sum + value, 0) / waitMinutes.length) * 10) / 10
    : null;
  const activeCount = grouped.CONFIRMED.length + grouped.PREPARING.length + grouped.READY.length;

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const cardProps = {
    mode,
    now,
    busyOrderId,
    busyOrderKey,
    kitchenEnabled,
    courierEnabled,
    onStartPreparing,
    onMarkReady,
    onMarkServed,
    onFlowAction,
    onRevert,
    onSaveKitchenNote,
    onRequestHandover: requestHandover,
    onRequestCancel: requestCancel,
    onOpen: (order: OrderResponse) => setSelectedKey(kitchenOrderKey(order)),
  };

  const detailDialog = (
    <>
      <KitchenOrderDetailDialog
        order={selectedOrder}
        mode={mode}
        now={now}
        busy={selectedOrder ? isTicketBusy(selectedOrder, busyOrderId, busyOrderKey) : false}
        kitchenEnabled={kitchenEnabled}
        courierEnabled={courierEnabled}
        onFlowAction={onFlowAction}
        onRequestHandover={requestHandover}
        onRequestCancel={requestCancel}
        onClose={() => setSelectedKey(null)}
      />
      <KitchenHandoverDialog
        order={handoverOrder}
        courierEnabled={courierEnabled}
        couriers={couriers}
        onClose={() => setHandoverKey(null)}
        onSelect={(order, target) => {
          setHandoverKey(null);
          onFlowAction?.(order.id, HANDOVER_ACTION[target], order.orderSource);
        }}
        onSelectCourier={
          onCourierHandover
            ? (order, courierStaffId) => {
                setHandoverKey(null);
                onCourierHandover(order, courierStaffId);
              }
            : undefined
        }
      />
      <OrderCancelDialog
        open={cancelOrder != null}
        subject={cancelOrder ? `${kitchenTableLabel(cancelOrder)} ${orderTicketNo(cancelOrder)}` : null}
        onOpenChange={(open) => (open ? undefined : setCancelKey(null))}
        onConfirm={(request) => {
          if (cancelOrder) onCancel?.(cancelOrder.id, request, cancelOrder.orderSource);
          setCancelKey(null);
        }}
      />
    </>
  );

  if (isWaiter) {
    return (
      <div className="flex flex-col gap-4">
        {detailDialog}
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {columns.map((column) => {
          const columnOrders = grouped[column.id];
          return (
            <section key={column.id} className="flex min-h-[8rem] flex-col gap-3">
              <header className="flex items-center justify-between border-b border-slate-200 pb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", COLUMN_TONE[column.id].dot)} />
                  <h2 className="text-sm font-semibold text-slate-900">
                    {kitchenColumnTitle(column.id, mode)}
                  </h2>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {columnOrders.length} ürün
                </span>
              </header>
              {columnOrders.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-slate-400">Bu grupta sipariş yok.</p>
              ) : (
                columnOrders.map((order) => (
                  <KitchenOrderCard key={kitchenOrderKey(order)} order={order} columnId={column.id} {...cardProps} />
                ))
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", fillHeight && "min-h-0 flex-1 overflow-hidden")}>
      {detailDialog}
      {error ? <p className="px-1 text-sm text-red-500">{error}</p> : null}

      {/* Top Filter & Metrics Section */}
      <section className="shrink-0 rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
        <div className={cn("flex items-center justify-between gap-2 overflow-x-auto pb-2 text-xs", HIDE_SCROLLBAR)}>
          <div className="flex shrink-0 items-center gap-2">
            <MetricChip label="Aktif Sipariş" value={String(activeCount)} />
            <MetricChip
              label="Hazırlanan"
              value={String(grouped.PREPARING.length)}
              dotClassName="bg-amber-500"
            />
            <MetricChip
              label="Hazır bekleyen"
              value={String(grouped.READY.length)}
              dotClassName="bg-emerald-500"
            />
            <MetricChip
              delayed={delayedOrders.length > 0}
              label="Gecikme Uyarısı"
              value={String(delayedOrders.length)}
            />
            <MetricChip
              label="İptal"
              value={String(grouped.CANCELLED.length)}
              dotClassName="bg-red-500"
            />
            <MetricChip
              label="Ort. SLA"
              value={avgWait == null ? "—" : `${avgWait} dk`}
              valueClassName="text-emerald-600"
            />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            <span>Otomatik Senkron (6s)</span>
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Sipariş no, müşteri adı veya masa ile filtrele..."
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-xs text-slate-800 placeholder:text-slate-400 transition-all focus:border-slate-400 focus:outline-none focus:ring-0"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px] text-slate-400">
              Ctrl K
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDelayedOnly((value) => !value)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors",
                delayedOnly
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Filtreler
            </button>
            <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setView("board")}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2.5 py-1 transition-all",
                  view === "board" ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:text-slate-700",
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Pano
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2.5 py-1 transition-all",
                  view === "list" ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:text-slate-700",
                )}
              >
                <List className="h-3.5 w-3.5" />
                Liste
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Board / List Content */}
      {view === "list" ? (
        <div className={cn("flex flex-col gap-3", fillHeight && "min-h-0 flex-1 overflow-y-auto")}>
          {visibleOrders.length === 0 ? (
            <p className="py-12 text-center text-xs text-slate-400">Eşleşen sipariş yok.</p>
          ) : (
            visibleOrders.map((order) => (
              <KitchenOrderCard
                key={kitchenOrderKey(order)}
                order={order}
                columnId={kitchenBoardColumn(order)}
                {...cardProps}
              />
            ))
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingKey(null)}
        >
          <div
            className={cn(
              "flex snap-x snap-mandatory items-start gap-4 overflow-x-auto pb-2",
              HIDE_SCROLLBAR,
              fillHeight && "min-h-0 flex-1",
            )}
          >
            {columns.map((column) => {
              const columnOrders = grouped[column.id];
              const canDrop =
                draggingOrder != null && kitchenDropFor(draggingOrder, column.id, dropOptions) != null;
              return (
                <KanbanColumn
                  key={column.id}
                  id={column.id}
                  canDrop={canDrop}
                  className={cn(fillHeight && "max-h-full min-h-0")}
                >
                  <div className="flex items-center justify-between pb-1">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {kitchenKanbanColumnTitle(column.id)}
                    </h3>
                    <span className="text-xs text-slate-500">
                      <strong className="font-semibold text-slate-800">{columnOrders.length}</strong> ürün
                    </span>
                  </div>
                  <div className={cn("flex flex-col gap-3", fillHeight && "min-h-0 flex-1 overflow-y-auto")}>
                    {columnOrders.length === 0 ? (
                      <p className="py-12 text-center text-xs text-slate-400">Bu grupta sipariş yok.</p>
                    ) : (
                      columnOrders.map((order) => (
                        <DraggableKitchenOrderCard
                          key={kitchenOrderKey(order)}
                          order={order}
                          columnId={column.id}
                          {...cardProps}
                        />
                      ))
                    )}
                  </div>
                </KanbanColumn>
              );
            })}
          </div>
          <DragOverlay dropAnimation={null}>
            {draggingOrder ? (
              <KitchenOrderCard
                order={draggingOrder}
                columnId={kitchenBoardColumn(draggingOrder)}
                overlay
                {...cardProps}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
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
        "flex shrink-0 items-center gap-1.5 rounded-xl border bg-white px-3 py-1 text-xs",
        delayed ? "border-red-200 text-red-600" : "border-slate-200/60 text-slate-600",
      )}
    >
      {delayed ? (
        <span className="h-2 w-2 rounded-full bg-red-500" />
      ) : dotClassName ? (
        <span className={cn("h-2 w-2 rounded-full", dotClassName)} />
      ) : null}
      <span className="text-slate-500">{label}:</span>
      <span className={cn("font-semibold text-slate-800", valueClassName)}>{value}</span>
    </div>
  );
}

function KanbanColumn({
  id,
  canDrop,
  className,
  children,
}: {
  id: KitchenColumnId;
  canDrop: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !canDrop });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[330px] shrink-0 snap-start flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-colors lg:min-h-[28rem] lg:flex-1 lg:basis-0",
        canDrop && "border-dashed border-slate-300",
        canDrop && isOver && "border-slate-400 bg-slate-100/70",
        className,
      )}
    >
      {children}
    </section>
  );
}

type KitchenOrderCardProps = {
  order: OrderResponse;
  mode: KitchenBoardMode;
  columnId: KitchenColumnId;
  now: number;
  busyOrderId?: number | null;
  busyOrderKey?: string | null;
  kitchenEnabled?: boolean;
  courierEnabled?: boolean;
  onStartPreparing?: (orderId: number, orderSource?: string | null) => void;
  onMarkReady?: (orderId: number, orderSource?: string | null) => void;
  onMarkServed?: (orderId: number) => void;
  onFlowAction?: (orderId: number, action: OrderFlowAction, orderSource?: string | null) => void;
  onRevert?: (orderId: number, to: KitchenRevertTarget, orderSource?: string | null) => void;
  onSaveKitchenNote?: (orderId: number, note: string) => void;
  onRequestHandover?: (order: OrderResponse) => void;
  onRequestCancel?: (order: OrderResponse) => void;
  onOpen: (order: OrderResponse) => void;
  dragRef?: (element: HTMLElement | null) => void;
  dragListeners?: ReturnType<typeof useDraggable>["listeners"];
  dragging?: boolean;
  overlay?: boolean;
};

function DraggableKitchenOrderCard(props: KitchenOrderCardProps) {
  const {
    order,
    onFlowAction,
    onRevert,
    onRequestCancel,
    kitchenEnabled = true,
    courierEnabled = false,
    busyOrderId,
    busyOrderKey,
  } = props;
  const canMoveForward =
    Boolean(onFlowAction) && kitchenTicketActions(order, kitchenEnabled, courierEnabled).length > 0;
  const canMoveBack = Boolean(onRevert) && kitchenRevertTarget(order, "CONFIRMED") != null;
  const canMoveToCancelled = Boolean(onRequestCancel) && kitchenCanCancel(order);
  const canDrag =
    !isTicketBusy(order, busyOrderId, busyOrderKey) && (canMoveForward || canMoveBack || canMoveToCancelled);
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: kitchenOrderKey(order),
    disabled: !canDrag,
  });
  return (
    <KitchenOrderCard
      {...props}
      dragRef={setNodeRef}
      dragListeners={canDrag ? listeners : undefined}
      dragging={isDragging}
    />
  );
}

function stopDragStart(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function KitchenOrderCard({
  order,
  mode,
  columnId,
  now,
  busyOrderId,
  busyOrderKey,
  kitchenEnabled = true,
  courierEnabled = false,
  onStartPreparing,
  onMarkReady,
  onMarkServed,
  onFlowAction,
  onSaveKitchenNote,
  onRequestHandover,
  onRequestCancel,
  onOpen,
  dragRef,
  dragListeners,
  dragging,
  overlay,
}: KitchenOrderCardProps) {
  const [note, setNote] = useState(order.kitchenNote || "");
  const isWaiter = mode === "waiter";
  const origin = kitchenOrderOrigin(order);
  const originLabel = kitchenOrderOriginLabel(origin);
  const usesCourier = kitchenUsesCourier(origin, order.deliveryType);
  const skipsPreparing = kitchenSkipsPreparing(origin);
  const delayed = isKitchenTicketDelayed(order, now);
  const minutes = kitchenElapsedMinutes(order, now);
  const busy = isTicketBusy(order, busyOrderId, busyOrderKey);
  const prep = columnId === "PREPARING" ? kitchenPrepProgress(order, now) : null;
  const flowActions = kitchenForwardActions(order, kitchenEnabled, courierEnabled);
  const canHandover = Boolean(onFlowAction && onRequestHandover) && kitchenCanHandover(order, kitchenEnabled, courierEnabled);
  const canCancel = Boolean(onRequestCancel) && kitchenCanCancel(order);
  const cancelled = columnId === "CANCELLED";
  const handoverTarget = columnId === "SERVED" ? kitchenHandoverTarget(order.status) ?? "WAITER" : null;
  const canEditNote =
    Boolean(onSaveKitchenNote) &&
    kitchenAllowsNote(origin) &&
    columnId === "PREPARING";

  useEffect(() => {
    setNote(order.kitchenNote || "");
  }, [order.kitchenNote, order.id]);

  return (
    <article
      ref={dragRef}
      {...dragListeners}
      role="button"
      tabIndex={0}
      aria-label={`${kitchenTableLabel(order)} ${orderTicketNo(order)} detayını aç`}
      onClick={() => onOpen(order)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpen(order);
      }}
      className={cn(
        "flex cursor-pointer flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300",
        dragListeners && "cursor-grab select-none active:cursor-grabbing",
        dragging && "opacity-40",
        overlay && "cursor-grabbing border-slate-300 shadow-lg",
      )}
    >
      {/* Header Info */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{kitchenTableLabel(order)}</h4>
          <span className="text-xs text-slate-400 font-mono">{orderTicketNo(order)} · f</span>
        </div>
        {cancelled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
            <Ban className="h-3 w-3" /> İptal edildi
          </span>
        ) : handoverTarget ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            {handoverTarget === "COURIER" ? <Bike className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
            {HANDOVER_LABEL[handoverTarget]}
          </span>
        ) : delayed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
            <AlertTriangle className="h-3 w-3" /> SLA Riski
          </span>
        ) : (
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium",
              ORIGIN_BADGE_CLASS[origin],
            )}
          >
            {originLabel}
          </span>
        )}
      </div>

      {/* Sub Info & Location */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {cancelled ? (
          <Ban className="h-3.5 w-3.5 shrink-0 text-red-500" />
        ) : columnId === "SERVED" ? (
          <CheckCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        ) : origin === "TABLE" ? (
          <UtensilsCrossed className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        ) : (
          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
        <span className="truncate">
          {cancelled
            ? cancelledLine(order)
            : columnId === "SERVED"
            ? handedLine(order)
            : origin === "TABLE"
              ? locationLine(order)
              : [locationLine(order), order.customerPhone?.trim()]
                  .filter((part, index, parts) => part && parts.indexOf(part) === index)
                  .join(" · ")}
        </span>
      </div>

      {/* Preparation Progress Bar */}
      {prep ? (
        <div className="rounded-xl bg-slate-50 p-2.5 text-xs">
          <div className="mb-1 flex items-center justify-between font-medium text-slate-700">
            <span>Mutfak İlerlemesi</span>
            <span className="text-slate-500">%{prep.percent} · {prep.remainingMinutes} dk kaldı</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${prep.percent}%` }} />
          </div>
        </div>
      ) : null}

      {/* Product List Section */}
      <KitchenOrderItemList order={order} />

      {/* Customer / Waiter / Kitchen Notes */}
      {order.note ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <strong className="font-semibold text-slate-700">Müşteri:</strong> {order.note}
        </p>
      ) : null}
      {order.waiterNote ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <strong className="font-semibold text-slate-700">Garson:</strong> {order.waiterNote}
        </p>
      ) : null}

      {canEditNote ? (
        <div
          className="space-y-1.5"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={stopDragStart}
          onTouchStart={stopDragStart}
        >
          <label className="text-[11px] font-medium text-slate-500" htmlFor={`kitchen-note-${kitchenOrderKey(order)}`}>
            Mutfak notu
          </label>
          <div className="flex gap-1.5">
            <Input
              id={`kitchen-note-${kitchenOrderKey(order)}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Not ekle…"
              className="h-8 rounded-xl border-slate-200 bg-white text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-xl border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
              disabled={busy}
              onClick={() => onSaveKitchenNote?.(order.id, note)}
            >
              Kaydet
            </Button>
          </div>
        </div>
      ) : order.kitchenNote ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <strong className="font-semibold text-slate-700">Mutfak:</strong> {order.kitchenNote}
        </p>
      ) : null}

      {columnId === "SERVED" || cancelled ? (
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-400">
          <span>{formatWhen(order.createdAt)}</span>
          <span className="text-xs font-medium text-slate-600">Detay Gör</span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            {columnId === "READY"
              ? kitchenReadyHandoverLabel(origin, order.deliveryType)
              : delayed
                ? "SLA aşıldı"
                : `${Math.max(1, KITCHEN_KANBAN_SLA_MINUTES - (minutes ?? 0))} dk kaldı`}
          </span>
          <div
            className="flex flex-wrap justify-end gap-1.5"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={stopDragStart}
            onTouchStart={stopDragStart}
          >
            {onFlowAction
              ? flowActions.map((step) => (
                  <KanbanAction
                    key={step.action}
                    busy={busy}
                    tone="emerald"
                    onClick={() => onFlowAction(order.id, step.action, order.orderSource)}
                  >
                    {kitchenActionLabel(step)}
                    <ArrowRight className="h-3 w-3" />
                  </KanbanAction>
                ))
              : null}
            {canHandover ? (
              <KanbanAction busy={busy} tone="emerald" onClick={() => onRequestHandover?.(order)}>
                Teslim et
                <ArrowRight className="h-3 w-3" />
              </KanbanAction>
            ) : null}
            {canCancel ? (
              <KanbanAction busy={busy} tone="danger" onClick={() => onRequestCancel?.(order)}>
                İptal
              </KanbanAction>
            ) : null}
            {!onFlowAction && columnId === "PREPARING" && onMarkReady ? (
              <KanbanAction busy={busy} tone="emerald" onClick={() => onMarkReady(order.id, order.orderSource)}>
                Hazır
              </KanbanAction>
            ) : null}
            {!onFlowAction && columnId === "READY" && isWaiter && onMarkServed && !usesCourier ? (
              <KanbanAction busy={busy} tone="emerald" onClick={() => onMarkServed(order.id)}>
                Teslim Et
              </KanbanAction>
            ) : null}
            {!onFlowAction && columnId === "CONFIRMED" && onStartPreparing && !skipsPreparing ? (
              <KanbanAction busy={busy} tone="emerald" onClick={() => onStartPreparing(order.id, order.orderSource)}>
                Hazırla
                <ArrowRight className="h-3 w-3" />
              </KanbanAction>
            ) : null}
          </div>
        </div>
      )}
    </article>
  );
}

function KitchenOrderItemList({ order }: { order: OrderResponse }) {
  const items = order.items ?? [];
  return (
    <div className="flex flex-col gap-2 pt-1">
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">Ürün yok</p>
      ) : (
        <ul className="space-y-1.5" aria-label={orderItemSummary(order)}>
          {items.map((item, index) => {
            const options = item.selectedOptions
              ?.map((option) => option.optionName)
              .filter(Boolean)
              .join(", ");
            return (
              <li
                key={`${order.id}-${item.id ?? item.productId}-${index}`}
                className="text-xs text-slate-700 leading-normal"
              >
                <span className="font-semibold text-slate-900">{item.quantity}×</span>{" "}
                <span className="font-medium text-slate-800">{item.productName || `#${item.productId}`}</span>
                {options ? (
                  <span className="block text-[11px] text-slate-400 font-normal">{options}</span>
                ) : null}
                {item.note ? (
                  <span className="block text-[11px] text-slate-400 font-normal">Not: {item.note}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100/80">
        <span className="rounded-full bg-emerald-50/80 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          {kitchenOrderOriginLabel(kitchenOrderOrigin(order))}
        </span>
        <span className="font-semibold text-slate-900">
          {formatMenuPrice(order.totalAmount ?? undefined, order.currency || "TRY")}
        </span>
      </div>
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
  tone: "emerald" | "amber" | "danger";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1 rounded-xl px-3 text-xs font-medium transition-all disabled:opacity-50",
        tone === "emerald" && "bg-slate-900 text-white hover:bg-slate-800",
        tone === "amber" && "bg-amber-500 text-white hover:bg-amber-600",
        tone === "danger" && "border border-red-200 bg-white text-red-600 hover:bg-red-50",
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}

function formatDateTime(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deliveryTypeLabel(deliveryType?: string | null): string | null {
  const value = (deliveryType ?? "").trim().toUpperCase();
  if (!value) return null;
  if (value === "DELIVERY") return "Adrese teslim";
  if (value === "PICKUP" || value === "STORE") return "Gel-al";
  if (value === "DINE_IN" || value === "TABLE") return "Masada";
  return deliveryType ?? null;
}

function KitchenOrderDetailDialog({
  order,
  onClose,
  ...rest
}: {
  order: OrderResponse | null;
  mode: KitchenBoardMode;
  now: number;
  busy: boolean;
  kitchenEnabled: boolean;
  courierEnabled: boolean;
  onFlowAction?: (orderId: number, action: OrderFlowAction, orderSource?: string | null) => void;
  onRequestHandover?: (order: OrderResponse) => void;
  onRequestCancel?: (order: OrderResponse) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={order != null} onOpenChange={(open) => (open ? undefined : onClose())}>
      {order ? <KitchenOrderDetailContent order={order} {...rest} /> : null}
    </Dialog>
  );
}

function KitchenOrderDetailContent({
  order,
  mode,
  now,
  busy,
  kitchenEnabled,
  courierEnabled,
  onFlowAction,
  onRequestHandover,
  onRequestCancel,
}: {
  order: OrderResponse;
  mode: KitchenBoardMode;
  now: number;
  busy: boolean;
  kitchenEnabled: boolean;
  courierEnabled: boolean;
  onFlowAction?: (orderId: number, action: OrderFlowAction, orderSource?: string | null) => void;
  onRequestHandover?: (order: OrderResponse) => void;
  onRequestCancel?: (order: OrderResponse) => void;
}) {
  const origin = kitchenOrderOrigin(order);
  const columnId = kitchenBoardColumn(order);
  const cancelled = columnId === "CANCELLED";
  const delayed = columnId !== "SERVED" && !cancelled && isKitchenTicketDelayed(order, now);
  const elapsed = kitchenTicketElapsedLabel(order, now);
  const currency = order.currency || "TRY";
  const items = order.items ?? [];
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const flowActions = onFlowAction ? kitchenForwardActions(order, kitchenEnabled, courierEnabled) : [];
  const canHandover =
    Boolean(onFlowAction && onRequestHandover) && kitchenCanHandover(order, kitchenEnabled, courierEnabled);
  const canCancel = Boolean(onRequestCancel) && kitchenCanCancel(order);
  const handoverTarget = columnId === "SERVED" ? kitchenHandoverTarget(order.status) ?? "WAITER" : null;
  const statusLabel = cancelled
    ? "İptal edildi"
    : handoverTarget
      ? HANDOVER_LABEL[handoverTarget]
      : mode === "kitchen"
        ? kitchenKanbanColumnTitle(columnId)
        : kitchenColumnTitle(columnId, mode);

  const fields: Array<{ label: string; value: string | null | undefined }> = [
    { label: "Kaynak", value: kitchenOrderOriginLabel(origin) },
    { label: "Masa", value: origin === "TABLE" ? kitchenTableLabel(order) : null },
    { label: "Teslimat", value: origin === "TABLE" ? null : deliveryTypeLabel(order.deliveryType) },
    { label: "Müşteri", value: order.customerName?.trim() },
    { label: "Telefon", value: order.customerPhone?.trim() },
    { label: "Garson", value: order.waiterName?.trim() },
    {
      label: "Teslim alan",
      value: handoverTarget
        ? [handoverTarget === "COURIER" ? "Kurye" : "Garson", handedTo(order, handoverTarget)].filter(Boolean).join(" · ")
        : null,
    },    { label: "İptal nedeni", value: cancelled ? orderCancelReasonLabel(order) : null },
    { label: "Geçen süre", value: cancelled ? null : elapsed },
  ];
  const timeline: Array<{ label: string; at: string | null }> = [
    { label: "Sipariş alındı", at: formatDateTime(order.submittedAt || order.createdAt) },
    { label: "Mutfağa düştü", at: formatDateTime(order.confirmedAt) },
    { label: "Hazırlanmaya başladı", at: formatDateTime(order.preparedAt) },
    { label: "Hazır", at: formatDateTime(order.readyAt) },
    { label: "Teslim edildi", at: formatDateTime(order.servedAt) },
    { label: "İptal edildi", at: cancelled ? formatDateTime(order.cancelledAt || order.rejectedAt) : null },
  ];
  const notes: Array<{ label: string; value: string | null | undefined }> = [
    { label: "Müşteri notu", value: order.note },
    { label: "Garson notu", value: order.waiterNote },
    { label: "Mutfak notu", value: order.kitchenNote },
  ];

  return (
    <DialogContent
      className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white p-0"
      overlayClassName="bg-slate-900/40 backdrop-blur-[2px]"
    >
      <DialogHeader className="space-y-2 border-b border-slate-100 px-6 py-5 text-left">
        <div className="flex flex-wrap items-center gap-2 pr-8">
          <DialogTitle className="text-lg font-semibold text-slate-900">{kitchenTableLabel(order)}</DialogTitle>
          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", ORIGIN_BADGE_CLASS[origin])}>
            {kitchenOrderOriginLabel(origin)}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
              COLUMN_TONE[columnId].badge,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", COLUMN_TONE[columnId].dot)} />
            {statusLabel}
          </span>
          {delayed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
              <AlertTriangle className="h-3 w-3" /> SLA Riski
            </span>
          ) : null}
        </div>
        <DialogDescription className="font-mono text-xs text-slate-400">
          {orderTicketNo(order)}
          {formatDateTime(order.submittedAt || order.createdAt)
            ? ` · ${formatDateTime(order.submittedAt || order.createdAt)}`
            : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {fields
            .filter((field) => field.value)
            .map((field) => (
              <div key={field.label} className="min-w-0">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{field.label}</dt>
                <dd className="truncate text-sm text-slate-800">{field.value}</dd>
              </div>
            ))}
        </dl>

        {origin !== "TABLE" && order.deliveryAddress?.trim() ? (
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>{order.deliveryAddress}</span>
          </div>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <ClipboardList className="h-4 w-4 text-slate-400" />
              Ürünler
            </h3>
            <span className="text-xs text-slate-500">{itemCount} adet</span>
          </div>
          {items.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">Ürün yok</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
              {items.map((item, index) => {
                const optionGroups = (item.selectedOptions ?? [])
                  .filter((option) => option.optionName)
                  .reduce<Array<{ groupName: string | null; optionNames: string[] }>>((groups, option) => {
                    const optionName = option.optionName;
                    if (!optionName) return groups;
                    const groupName = option.groupName?.trim() || null;
                    const existing = groups.find((group) => group.groupName === groupName);
                    if (existing) {
                      existing.optionNames.push(optionName);
                    } else {
                      groups.push({ groupName, optionNames: [optionName] });
                    }
                    return groups;
                  }, []);
                return (
                  <li
                    key={`${order.id}-${item.id ?? item.productId}-${index}`}
                    className="flex items-start justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800">
                        <span className="font-semibold text-slate-900">{item.quantity}×</span>{" "}
                        <span className="font-medium">{item.productName || `#${item.productId}`}</span>
                      </p>
                      {optionGroups.length > 0 ? (
                        <div className="mt-1 space-y-1.5 text-xs text-slate-600">
                          {optionGroups.map((group, groupIndex) => (
                            <div
                              key={`${group.groupName ?? "option"}-${groupIndex}`}
                              className="flex flex-wrap items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1"
                            >
                              {group.groupName ? (
                                <span className="font-semibold text-slate-700">{group.groupName}:</span>
                              ) : null}
                              <span className="flex flex-wrap gap-1">
                                {group.optionNames.map((optionName, optionIndex) => (
                                  <span
                                    key={`${optionName}-${optionIndex}`}
                                    className="rounded bg-white px-1.5 py-0.5 text-slate-600 ring-1 ring-slate-200"
                                  >
                                    {optionName}
                                  </span>
                                ))}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {item.note ? (
                        <p className="mt-0.5 text-xs font-medium text-amber-700">Not: {item.note}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs font-medium text-slate-600">
                      {formatMenuPrice(item.lineTotal ?? undefined, currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 flex items-center justify-between px-1 text-sm">
            <span className="text-slate-500">Toplam</span>
            <span className="font-semibold text-slate-900">
              {formatMenuPrice(order.totalAmount ?? undefined, currency) || "—"}
            </span>
          </div>
        </section>

        {notes.some((item) => item.value?.trim()) ? (
          <section className="space-y-2">
            {notes
              .filter((item) => item.value?.trim())
              .map((item) => (
                <p key={item.label} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <strong className="font-semibold text-slate-800">{item.label}:</strong> {item.value}
                </p>
              ))}
          </section>
        ) : null}

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Timer className="h-4 w-4 text-slate-400" />
            Zaman çizelgesi
          </h3>
          <ol className="space-y-1.5">
            {timeline
              .filter((step) => step.at)
              .map((step) => (
                <li key={step.label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {step.label}
                  </span>
                  <span className="font-mono text-slate-400">{step.at}</span>
                </li>
              ))}
          </ol>
        </section>
      </div>

      {(onFlowAction && flowActions.length > 0) || canHandover || canCancel ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          {canCancel ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onRequestCancel?.(order)}
              className="mr-auto h-9 gap-1.5 rounded-xl border-red-200 px-4 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Ban className="h-4 w-4" />
              Siparişi iptal et
            </Button>
          ) : null}
          {onFlowAction
            ? flowActions.map((step) => (
                <Button
                  key={step.action}
                  type="button"
                  disabled={busy}
                  onClick={() => onFlowAction(order.id, step.action, order.orderSource)}
                  className="h-9 gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {kitchenActionLabel(step)}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              ))
            : null}
          {canHandover ? (
            <Button
              type="button"
              disabled={busy}
              onClick={() => onRequestHandover?.(order)}
              className="h-9 gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Teslim et
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          ) : null}
        </div>
      ) : null}
    </DialogContent>
  );
}

function KitchenHandoverDialog({
  order,
  courierEnabled,
  couriers,
  onClose,
  onSelect,
  onSelectCourier,
}: {
  order: OrderResponse | null;
  courierEnabled: boolean;
  couriers?: KitchenCourierOption[];
  onClose: () => void;
  onSelect: (order: OrderResponse, target: KitchenHandoverTarget) => void;
  onSelectCourier?: (order: OrderResponse, courierStaffId: number) => void;
}) {
  return (
    <Dialog open={order != null} onOpenChange={(open) => (open ? undefined : onClose())}>
      {order ? (
        <DialogContent
          className="max-w-md rounded-2xl border-slate-200 bg-white"
          overlayClassName="bg-slate-900/40 backdrop-blur-[2px]"
        >
          <KitchenHandoverContent
            key={kitchenOrderKey(order)}
            order={order}
            courierEnabled={courierEnabled}
            couriers={couriers}
            onSelect={onSelect}
            onSelectCourier={onSelectCourier}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function KitchenHandoverContent({
  order,
  courierEnabled,
  couriers,
  onSelect,
  onSelectCourier,
}: {
  order: OrderResponse;
  courierEnabled: boolean;
  couriers?: KitchenCourierOption[];
  onSelect: (order: OrderResponse, target: KitchenHandoverTarget) => void;
  onSelectCourier?: (order: OrderResponse, courierStaffId: number) => void;
}) {
  const courier = kitchenCourierHandover(order, courierEnabled);
  const picksStaff = courier.kind === "staff" && Boolean(onSelectCourier);
  const [pickingCourier, setPickingCourier] = useState(picksStaff);
  const availableCouriers = (couriers ?? []).filter((item) => item.available);
  const [pickedCourierId, setCourierId] = useState<number | null>(null);
  const courierId = availableCouriers.some((item) => item.id === pickedCourierId)
    ? pickedCourierId
    : (availableCouriers[0]?.id ?? null);
  const courierBlocked =
    courier.kind === "unavailable"
      ? courier.reason
      : picksStaff && couriers != null && availableCouriers.length === 0
        ? "Müsait kurye yok"
        : null;
  const suggested = courierBlocked ? "WAITER" : suggestedHandover(order, courierEnabled);
  const subject = `${kitchenTableLabel(order)} ${orderTicketNo(order)}`;

  if (pickingCourier) {
    return (
      <>
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-semibold text-slate-900">Hangi kuryeye?</DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {subject} seçilen kuryenin ekranına adresiyle birlikte düşecek.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <span className="min-w-0 break-words">{order.deliveryAddress || "Adres girilmemiş"}</span>
        </div>
        {couriers == null ? (
          <div className="flex justify-center py-6 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto" role="radiogroup" aria-label="Kurye">
            {couriers.map((item) => {
              const selected = item.id === courierId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!item.available}
                    onClick={() => setCourierId(item.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      selected ? "border-slate-900 bg-slate-50" : "border-slate-200 enabled:hover:border-slate-400",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Bike className="h-4 w-4 shrink-0 text-slate-600" />
                      <span className="truncate text-sm font-medium text-slate-900">{item.displayName}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs">
                      {item.waitingCount > 0 ? (
                        <span className="text-slate-500">{item.waitingCount} bekleyen</span>
                      ) : null}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-medium",
                          item.available ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                        )}
                      >
                        {item.available ? "Müsait" : "Teslimatta"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => setPickingCourier(false)}>
            Geri
          </Button>
          <Button
            className="rounded-xl"
            disabled={courierId == null}
            onClick={() => (courierId != null ? onSelectCourier?.(order, courierId) : undefined)}
          >
            Kuryeye teslim et
          </Button>
        </div>
      </>
    );
  }

  const options: Array<{
    target: KitchenHandoverTarget;
    title: string;
    hint: string;
    icon: ReactNode;
    disabled: boolean;
  }> = [
    {
      target: "COURIER",
      title: "Kurye",
      hint: courierBlocked ?? (picksStaff ? "Müsait kuryeyi seç" : "Sipariş kuryeye teslim edildi"),
      icon: <Bike className="h-6 w-6" />,
      disabled: courierBlocked != null,
    },
  ];

  const choose = (target: KitchenHandoverTarget) => {
    if (target === "COURIER" && picksStaff) {
      setPickingCourier(true);
      return;
    }
    onSelect(order, target);
  };

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle className="text-lg font-semibold text-slate-900">Kime teslim edildi?</DialogTitle>
        <DialogDescription className="text-sm text-slate-500">
          {subject} &quot;Teslim Edildi&quot; olarak işaretlenecek.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        {options.map((option) => (
          <button
            key={option.target}
            type="button"
            disabled={option.disabled}
            onClick={() => choose(option.target)}
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-2xl border p-5 text-center transition-all",
              "disabled:cursor-not-allowed disabled:opacity-50",
              option.target === suggested && !option.disabled
                ? "border-slate-900 bg-slate-50"
                : "border-slate-200 bg-white enabled:hover:border-slate-400 enabled:hover:bg-slate-50",
            )}
          >
            {option.target === suggested && !option.disabled ? (
              <span className="absolute right-2 top-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-white">
                Önerilen
              </span>
            ) : null}
            <span className="text-slate-700">{option.icon}</span>
            <span className="text-sm font-semibold text-slate-900">{option.title}</span>
            <span className="text-xs text-slate-500">{option.hint}</span>
          </button>
        ))}
      </div>
    </>
  );
}
