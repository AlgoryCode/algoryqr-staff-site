"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, LayoutGrid, List, LogOut, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";

import { BrandLogo } from "@/components/BrandLogo";
import { OrderCancelDialog } from "@/components/orders/OrderCancelDialog";
import { Button } from "@/components/ui/button";
import { ordersForStaffBranch } from "@/lib/branch-scope";
import { formatBranchCode, isBranchCourierEnabled } from "@/lib/branch";
import { formatKitchenElapsed, kitchenOrderOrigin } from "@/lib/kitchen-queue";
import {
  isOrderCancellable,
  orderCancelReasonLabel,
  orderFlowStatusLabel,
  orderIsDelivery,
  orderFlowContextFor,
  waiterModeActions,
  waiterServiceStatusLabel,
  type OrderCancelRequest,
  type OrderFlowAction,
  type WaiterServiceAction,
} from "@/lib/order-flow";
import { orderLocationLabel } from "@/lib/order-management";
import type { OrderResponse } from "@/lib/ordering-api";
import { deliverStoreKitchenOrder, isOnlineKitchenSource, type KitchenCourierOption } from "@/lib/store-kitchen";
import {
  filterOffTableBoard,
  filterWaiterShiftBoard,
  groupWaiterShift,
  rememberWaiterDelivery,
  tableIdsAwaitingPayment,
  type WaiterShiftBoard,
} from "@/lib/waiter-board";
import {
  cancelWaiterOrder,
  confirmWaiterOrder,
  handoverKitchenOrderToCourier,
  listKitchenQueue,
  listWaiterKitchenCouriers,
  listWaiterPendingOrders,
  listWaiterReadyOrders,
  listWaiterTables,
  listWaiterTodayOrders,
  markWaiterServiceDelivered,
  markWaiterServicePreparing,
  rejectWaiterOrder,
  runWaiterFlowAction,
  STAFF_ROLE_LABEL,
  isStaffProfileComplete,
  isStaffUpstreamUnavailableError,
  waiterLogout,
  WaiterApiError,
  type WaiterMe,
  type WaiterTableSummary,
} from "@/lib/waiter-api";

import { StaffOrderBillSheet } from "@/views/staff/StaffOrderBillSheet";

type WaiterTab = "tables" | "reservations";
type TableLayout = "grid" | "list";

const shell = {
  page: "flex min-h-screen flex-col bg-background",
  header:
    "sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
  headerInner: "mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4",
  main: "mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-28",
  bottomNav:
    "fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90",
  bottomNavInner: "mx-auto grid max-w-6xl grid-cols-2 gap-1 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
  navBtn:
    "flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition-colors",
  navBtnActive: "bg-primary/10 text-primary",
  card: "space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm",
  cardEmphasis: "space-y-3 rounded-2xl border border-primary/35 bg-card p-4 shadow-sm ring-1 ring-primary/10",
  stepRow: "flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 shadow-sm",
  stepRowEmphasis:
    "flex items-center gap-3 rounded-2xl border border-primary/35 bg-primary/5 px-3 py-3 shadow-sm ring-1 ring-primary/10",
  orderCard: "rounded-xl border border-border bg-background/80 p-3",
  tableTile:
    "flex h-12 w-full items-center justify-center rounded-lg border px-1 text-[10px] font-semibold leading-tight shadow-sm transition-colors min-[400px]:h-14 min-[400px]:px-1.5 min-[400px]:text-[11px] sm:h-16 sm:px-2 sm:text-xs md:h-[4.5rem] md:rounded-xl md:border-2 md:px-3 md:text-sm",
  tableTileUnpaid:
    "animate-pulse border-red-800/80 bg-red-500 text-white enabled:hover:bg-red-600",
  tableTilePaid: "border-emerald-800/50 bg-emerald-200 text-emerald-950 enabled:hover:bg-emerald-300",
  tableTileIdle: "border-border bg-muted/40 text-foreground enabled:hover:bg-muted/70",
  areaBadge:
    "shrink-0 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors",
  areaBadgeActive: "border-primary bg-primary text-primary-foreground shadow-sm",
  areaHeading: "text-sm font-semibold tracking-tight text-foreground",
} as const;

type TableAreaGroup = {
  key: string;
  name: string;
  tables: WaiterTableSummary[];
};

function tableAreaKey(table: WaiterTableSummary): string {
  return table.areaId != null ? String(table.areaId) : "none";
}

function groupTablesByArea(tables: WaiterTableSummary[]): TableAreaGroup[] {
  const groups = new Map<string, TableAreaGroup>();
  for (const table of tables) {
    const key = tableAreaKey(table);
    const existing = groups.get(key);
    if (existing) {
      existing.tables.push(table);
      continue;
    }
    groups.set(key, {
      key,
      name: table.areaName?.trim() || "Alan tanımsız",
      tables: [table],
    });
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
}

export function PersonelWaiterScreen({ me }: { me: WaiterMe }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<WaiterTab>("tables");
  const [tableLayout, setTableLayout] = useState<TableLayout>("grid");
  const [selectedAreaKey, setSelectedAreaKey] = useState<"all" | string>("all");
  const [billOrder, setBillOrder] = useState<OrderResponse | null>(null);
  const [servedNow, setServedNow] = useState<OrderResponse[]>([]);
  const [cancelledNow, setCancelledNow] = useState<OrderResponse[]>([]);
  const kitchenEnabled = me.kitchenEnabled === true;
  const courierEnabled = isBranchCourierEnabled(me);
  const profileReady = isStaffProfileComplete(me);

  function isStaffAuthError(error: unknown): boolean {
    return (
      error instanceof WaiterApiError &&
      (error.message.includes("Oturum gerekli") ||
        error.message.includes("Garson bulunamadı") ||
        error.message.includes("Personel bulunamadı") ||
        error.message.includes("Personel oturumu gerekli"))
    );
  }

  function shouldPauseStaffPolling(error: unknown): boolean {
    return isStaffAuthError(error) || isStaffUpstreamUnavailableError(error);
  }

  const merchantId = me.merchantId;
  const branchId = me.branchId;
  const tablesProfileReady =
    profileReady && merchantId != null && merchantId > 0 && branchId != null && branchId > 0;
  const [secondaryQueries, setSecondaryQueries] = useState(false);
  useEffect(() => {
    if (!profileReady) {
      setSecondaryQueries(false);
      return;
    }
    if (tablesProfileReady && !kitchenEnabled) {
      const afterTables = window.setTimeout(() => setSecondaryQueries(true), 700);
      return () => window.clearTimeout(afterTables);
    }
    const t = window.setTimeout(() => setSecondaryQueries(true), 250);
    return () => window.clearTimeout(t);
  }, [profileReady, tablesProfileReady, kitchenEnabled]);

  const pendingQuery = useQuery({
    queryKey: ["staff-waiter-pending"],
    enabled: profileReady && secondaryQueries && !kitchenEnabled,
    queryFn: listWaiterPendingOrders,
    retry: false,
    refetchInterval: (query) => (shouldPauseStaffPolling(query.state.error) ? false : 6_000),
  });
  const readyQuery = useQuery({
    queryKey: ["staff-waiter-ready"],
    enabled: profileReady && secondaryQueries && !kitchenEnabled,
    queryFn: listWaiterReadyOrders,
    retry: false,
    refetchInterval: (query) => (shouldPauseStaffPolling(query.state.error) ? false : 6_000),
  });
  const todayQuery = useQuery({
    queryKey: ["staff-waiter-today"],
    enabled: profileReady && secondaryQueries,
    queryFn: listWaiterTodayOrders,
    retry: false,
    refetchInterval: (query) => (shouldPauseStaffPolling(query.state.error) ? false : 6_000),
  });
  const kitchenQuery = useQuery({
    queryKey: ["staff-kitchen-queue"],
    enabled: profileReady && secondaryQueries,
    queryFn: async () => {
      try {
        return await listKitchenQueue();
      } catch {
        return [] as OrderResponse[];
      }
    },
    retry: false,
    refetchInterval: (query) => (shouldPauseStaffPolling(query.state.error) ? false : 6_000),
  });
  const couriersQuery = useQuery({
    queryKey: ["staff-waiter-couriers", me.branchId],
    enabled: profileReady && courierEnabled && !kitchenEnabled,
    queryFn: () => listWaiterKitchenCouriers(me.branchId),
  });
  const tablesQuery = useQuery({
    queryKey: ["staff-waiter-tables", merchantId, branchId],
    enabled: !kitchenEnabled && tablesProfileReady,
    queryFn: () => listWaiterTables(merchantId!, branchId!),
    retry: false,
    refetchInterval: (query) => (shouldPauseStaffPolling(query.state.error) ? false : 6_000),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-waiter-pending"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-waiter-ready"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-waiter-today"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-kitchen-queue"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-waiter-tables"] }),
    ]);
  };

  const action = useMutation({
    mutationFn: async (payload: {
      orderId: number;
      kind: "confirm" | "reject" | "cancel" | OrderFlowAction | WaiterServiceAction;
      order?: OrderResponse;
      cancel?: OrderCancelRequest;
      courierStaffId?: number;
    }) => {
      if (payload.kind === "confirm") return confirmWaiterOrder(payload.orderId, kitchenEnabled);
      if (payload.kind === "reject") return rejectWaiterOrder(payload.orderId, payload.cancel);
      if (payload.kind === "cancel") return cancelWaiterOrder(payload.orderId, payload.cancel);
      if (payload.kind === "markServicePreparing") return markWaiterServicePreparing(payload.orderId);
      if (payload.kind === "markServiceDelivered") return markWaiterServiceDelivered(payload.orderId);
      if (payload.kind === "markWaiterDeliveredToCustomer" && isOnlineKitchenSource(payload.order?.orderSource)) {
        return deliverStoreKitchenOrder(payload.orderId);
      }
      if (payload.kind === "markKitchenDeliveredToCourier") {
        if (payload.courierStaffId == null) throw new Error("Kurye seçilmedi");
        return handoverKitchenOrderToCourier(payload.orderId, payload.courierStaffId, payload.order?.orderSource);
      }
      return runWaiterFlowAction(payload.orderId, payload.kind, payload.order?.orderSource, true);
    },
    onSuccess: (updated, payload) => {
      if (payload.kind === "reject" || payload.kind === "cancel") {
        const closed: OrderResponse = {
          ...(payload.order ?? { id: payload.orderId }),
          ...updated,
          id: payload.orderId,
          status: updated?.status || (payload.kind === "reject" ? "REJECTED" : "CANCELLED"),
        };
        setCancelledNow((current) => [closed, ...current.filter((order) => order.id !== closed.id)]);
      }
      if (
        payload.kind === "markWaiterTaken" ||
        payload.kind === "markWaiterDeliveredToCustomer" ||
        payload.kind === "markWaiterDeliveredToCourier" ||
        payload.kind === "markServiceDelivered"
      ) {
        const ready = queryClient.getQueryData<OrderResponse[]>(["staff-waiter-ready"]) ?? [];
        const previous = payload.order ?? ready.find((order) => order.id === payload.orderId);
        const carried = rememberWaiterDelivery(previous, updated, payload.orderId);
        setServedNow((current) => [carried, ...current.filter((order) => order.id !== carried.id)]);
      }
      void refresh();
    },
  });

  const board = useMemo(() => {
    const branchId = me.branchId;
    return groupWaiterShift({
      pending: ordersForStaffBranch(pendingQuery.data ?? [], branchId),
      ready: ordersForStaffBranch(readyQuery.data ?? [], branchId),
      kitchen: ordersForStaffBranch(kitchenQuery.data ?? [], branchId),
      today: ordersForStaffBranch(todayQuery.data ?? [], branchId),
      servedNow,
      cancelledNow,
      kitchenEnabled,
      courierEnabled,
    });
  }, [
    cancelledNow,
    courierEnabled,
    kitchenEnabled,
    kitchenQuery.data,
    me.branchId,
    pendingQuery.data,
    readyQuery.data,
    servedNow,
    todayQuery.data,
  ]);

  const awaitingPaymentIds = useMemo(
    () => tableIdsAwaitingPayment(tablesQuery.data ?? []),
    [tablesQuery.data],
  );

  const branchTables = useMemo(() => {
    const rows = tablesQuery.data ?? [];
    return [...rows].sort((a, b) => {
      const areaCmp = (a.areaName ?? "").localeCompare(b.areaName ?? "", "tr-TR");
      if (areaCmp !== 0) return areaCmp;
      const an = a.tableNumber ?? 0;
      const bn = b.tableNumber ?? 0;
      if (an !== bn) return an - bn;
      return (a.tableName ?? "").localeCompare(b.tableName ?? "", "tr-TR");
    });
  }, [tablesQuery.data]);

  const tableAreaFilters = useMemo(() => groupTablesByArea(branchTables), [branchTables]);

  const visibleTableGroups = useMemo(() => {
    if (selectedAreaKey === "all") return tableAreaFilters;
    const match = tableAreaFilters.find((group) => group.key === selectedAreaKey);
    return match ? [match] : [];
  }, [selectedAreaKey, tableAreaFilters]);

  const error =
    (tablesQuery.error instanceof WaiterApiError && tablesQuery.error.message) ||
    (kitchenQuery.error instanceof WaiterApiError && kitchenQuery.error.message) ||
    (pendingQuery.error instanceof WaiterApiError && pendingQuery.error.message) ||
    (readyQuery.error instanceof WaiterApiError && readyQuery.error.message) ||
    (todayQuery.error instanceof WaiterApiError && todayQuery.error.message) ||
    (action.error instanceof Error ? action.error.message : null);
  const upstreamUnavailable =
    isStaffUpstreamUnavailableError(tablesQuery.error) ||
    isStaffUpstreamUnavailableError(kitchenQuery.error) ||
    isStaffUpstreamUnavailableError(pendingQuery.error) ||
    isStaffUpstreamUnavailableError(readyQuery.error) ||
    isStaffUpstreamUnavailableError(todayQuery.error);
  const busyOrderId = action.isPending ? action.variables?.orderId ?? null : null;

  const signOut = async () => {
    await waiterLogout();
    router.replace("/");
    router.refresh();
  };

  const openBillForTable = (table: WaiterTableSummary) => {
    setBillOrder(orderFromTable(table));
  };

  const processBoard = useMemo(
    () => filterWaiterShiftBoard(board, billOrder?.tableId),
    [board, billOrder?.tableId],
  );
  const counterBoard = useMemo(() => filterOffTableBoard(board), [board]);
  const counterOpen =
    counterBoard.approve.length + counterBoard.cooking.length + counterBoard.deliver.length > 0;

  const processPanelProps = {
    error,
    pendingLoading: pendingQuery.isLoading,
    readyLoading: readyQuery.isLoading,
    busyOrderId,
    confirmKind: action.variables?.kind === "confirm" ? action.variables.orderId : null,
    onConfirm: (order: OrderResponse) => action.mutate({ orderId: order.id, kind: "confirm", order }),
    onReject: (order: OrderResponse, cancel: OrderCancelRequest) =>
      action.mutate({ orderId: order.id, kind: "reject", order, cancel }),
    onCancel: (order: OrderResponse, cancel: OrderCancelRequest) =>
      action.mutate({ orderId: order.id, kind: "cancel", order, cancel }),
    kitchenEnabled,
    courierEnabled,
    couriers: couriersQuery.data ?? [],
    onFlowAction: (order: OrderResponse, kind: OrderFlowAction, courierStaffId?: number) =>
      action.mutate({ orderId: order.id, kind, order, courierStaffId }),
  };

  const processPanel =
    billOrder != null ? (
      <WaiterProcessPanel
        {...processPanelProps}
        board={processBoard}
        kitchenLoading={(kitchenQuery.isLoading || todayQuery.isLoading) && processBoard.cooking.length === 0}
      />
    ) : null;

  return (
    <div className={shell.page}>
      <header className={shell.header}>
        <div className={shell.headerInner}>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            onClick={() => setTab("tables")}
          >
            <BrandLogo size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{me.displayName?.trim() || "Personel"}</p>
              <p className="text-xs text-muted-foreground">
                {STAFF_ROLE_LABEL.WAITER} · Şube {formatBranchCode(me.branchId)}
              </p>
            </div>
          </button>
          <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
            Çıkış
          </Button>
        </div>
      </header>

      <main className={shell.main}>
        {!profileReady ? (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Profil bilgileri eksik (personel, şube veya işletme). Çıkış yapıp tekrar giriş deneyin.
          </div>
        ) : null}
        {upstreamUnavailable ? (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error ?? "qr-service yanıt vermiyor."} IntelliJ / terminalden{" "}
            <strong>qr-service</strong> (8080) yeniden başlatın; ardından sayfayı yenileyin.
          </div>
        ) : null}
        {error?.includes("Personel oturumu gerekli") || error?.includes("Oturum gerekli") ? (
          <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
            Oturum süresi doldu veya qr-service yeniden başlatıldı.{" "}
            <strong>Çıkış</strong> yapıp garson girişini tekrar deneyin.
          </div>
        ) : null}
        {error?.includes("Garson bulunamadı") || error?.includes("Personel bulunamadı") ? (
          <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
            Giriş başarılı ancak API personel kaydınızı tanımıyor (JWT <code className="text-xs">staffId</code> ↔
            veritabanı). Oturumunuz silinmemeli; yönetici{" "}
            <code className="text-xs">docs/STAFF_JWT_QR_SERVICE.md</code> kontrol listesine bakmalı.
          </div>
        ) : null}
        {tab === "tables" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Masalar</h1>
                <p className="text-sm text-muted-foreground">Salon masaları · kırmızı ödeme bekliyor</p>
              </div>
              <div className="flex rounded-lg border border-border p-0.5">
                <button
                  type="button"
                  aria-pressed={tableLayout === "grid"}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                    tableLayout === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                  onClick={() => setTableLayout("grid")}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Kare
                </button>
                <button
                  type="button"
                  aria-pressed={tableLayout === "list"}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                    tableLayout === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                  onClick={() => setTableLayout("list")}
                >
                  <List className="h-3.5 w-3.5" />
                  Liste
                </button>
              </div>
            </div>

            {tableAreaFilters.length > 0 ? (
              <div
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Alan filtresi"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedAreaKey === "all"}
                  className={`${shell.areaBadge} ${selectedAreaKey === "all" ? shell.areaBadgeActive : "hover:bg-muted/60"}`}
                  onClick={() => setSelectedAreaKey("all")}
                >
                  Tümü
                  <span className="ml-1.5 tabular-nums opacity-80">{branchTables.length}</span>
                </button>
                {tableAreaFilters.map((area) => (
                  <button
                    key={area.key}
                    type="button"
                    role="tab"
                    aria-selected={selectedAreaKey === area.key}
                    className={`${shell.areaBadge} ${
                      selectedAreaKey === area.key ? shell.areaBadgeActive : "hover:bg-muted/60"
                    }`}
                    onClick={() => setSelectedAreaKey(area.key)}
                  >
                    {area.name}
                    <span className="ml-1.5 tabular-nums opacity-80">{area.tables.length}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {counterOpen ? (
              <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold">Gel-al ve paket</h2>
                <WaiterProcessPanel
                  {...processPanelProps}
                  board={counterBoard}
                  counter
                  openOnly
                  kitchenLoading={(kitchenQuery.isLoading || todayQuery.isLoading) && counterBoard.cooking.length === 0}
                />
              </section>
            ) : null}

            {!tablesProfileReady ? (
              <p className="text-sm text-destructive">
                İşletme veya şube bilgisi eksik. Çıkış yapıp tekrar giriş yapın.
              </p>
            ) : tablesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Masalar yükleniyor…</p>
            ) : branchTables.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bu şubede tanımlı masa yok.</p>
            ) : visibleTableGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bu alanda masa yok.</p>
            ) : (
              <div className="space-y-6">
                {visibleTableGroups.map((area) => (
                  <section key={area.key} className="space-y-3">
                    <h2 className={shell.areaHeading}>{area.name}</h2>
                    {tableLayout === "grid" ? (
                      <ul className="grid grid-cols-3 gap-1.5 min-[400px]:grid-cols-4 min-[400px]:gap-2 sm:gap-2.5 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-4 xl:gap-3">
                        {area.tables.map((table) => (
                          <li key={table.tableId}>
                            <button
                              type="button"
                              className={tableTileClass(table, awaitingPaymentIds)}
                              onClick={() => openBillForTable(table)}
                            >
                              <span className="truncate">
                                {table.tableName || `Masa ${table.tableNumber ?? table.tableId}`}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="space-y-2">
                        {area.tables.map((table) => (
                          <li key={table.tableId}>
                            <button
                              type="button"
                              className={`flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-muted/40 ${
                                awaitingPaymentIds.has(table.tableId) ? "border-red-300/80 bg-red-50/80" : ""
                              }`}
                              onClick={() => openBillForTable(table)}
                            >
                              <span
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                                  awaitingPaymentIds.has(table.tableId)
                                    ? "animate-pulse bg-red-500 text-white"
                                    : table.billStatus === "OPEN"
                                      ? "bg-amber-200 text-amber-950"
                                      : "bg-muted text-foreground"
                                }`}
                              >
                                {table.tableNumber ?? "·"}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">
                                  {table.tableName || `Masa ${table.tableNumber ?? table.tableId}`}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">{tableStatusLabel(table)}</p>
                              </div>
                              <span className="text-xs tabular-nums text-muted-foreground">
                                {table.pendingOrderCount + (table.readyOrderCount ?? 0) > 0
                                  ? `${table.pendingOrderCount + (table.readyOrderCount ?? 0)} sipariş`
                                  : table.openBillTotal != null
                                    ? `${table.openBillTotal} ₺`
                                    : ""}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {tab === "reservations" ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/20 px-6 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Rezervasyonlar</h1>
            <p className="max-w-sm text-sm text-muted-foreground">Rezervasyon listesi yakında burada olacak.</p>
          </div>
        ) : null}
      </main>

      <nav className={shell.bottomNav} aria-label="Garson menüsü">
        <div className={shell.bottomNavInner}>
          <button
            type="button"
            className={`${shell.navBtn} ${tab === "tables" ? shell.navBtnActive : ""}`}
            onClick={() => setTab("tables")}
          >
            <UtensilsCrossed className="h-5 w-5" />
            Masalar
          </button>
          <button
            type="button"
            className={`${shell.navBtn} ${tab === "reservations" ? shell.navBtnActive : ""}`}
            onClick={() => setTab("reservations")}
          >
            <CalendarDays className="h-5 w-5" />
            Rezervasyonlar
          </button>
        </div>
      </nav>

      <StaffOrderBillSheet
        order={billOrder}
        tableOrders={processBoard.approve.concat(processBoard.cooking, processBoard.deliver, processBoard.delivered)}
        open={billOrder != null}
        processPanel={processPanel}
        kitchenEnabled={kitchenEnabled}
        onOpenChange={(next) => {
          if (!next) setBillOrder(null);
        }}
        onBillUpdated={() => void refresh()}
      />
    </div>
  );
}

function WaiterProcessPanel({
  board,
  error,
  pendingLoading,
  kitchenLoading,
  readyLoading,
  busyOrderId,
  confirmKind,
  onConfirm,
  onReject,
  onCancel,
  kitchenEnabled,
  courierEnabled,
  couriers,
  counter = false,
  openOnly = false,
  onFlowAction,
}: {
  board: WaiterShiftBoard;
  error: string | null;
  pendingLoading: boolean;
  kitchenLoading: boolean;
  readyLoading: boolean;
  busyOrderId: number | null;
  confirmKind: number | null | undefined;
  onConfirm: (order: OrderResponse) => void;
  onReject: (order: OrderResponse, cancel: OrderCancelRequest) => void;
  onCancel: (order: OrderResponse, cancel: OrderCancelRequest) => void;
  kitchenEnabled: boolean;
  courierEnabled: boolean;
  couriers: KitchenCourierOption[];
  counter?: boolean;
  openOnly?: boolean;
  onFlowAction: (order: OrderResponse, kind: OrderFlowAction, courierStaffId?: number) => void;
}) {
  const [closing, setClosing] = useState<{ order: OrderResponse; kind: "reject" | "cancel" } | null>(null);
  const [courierByOrder, setCourierByOrder] = useState<Record<number, number>>({});
  const cancelButton = (order: OrderResponse) =>
    canWaiterCancel(order) ? (
      <Button
        size="sm"
        variant="outline"
        className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
        disabled={busyOrderId === order.id}
        onClick={() => setClosing({ order, kind: "cancel" })}
      >
        İptal et
      </Button>
    ) : null;
  const flowButtons = (order: OrderResponse) => (
    <>
      {waiterModeActions(order.status, orderFlowContextFor(order, { kitchenEnabled, courierEnabled })).map((step) =>
        step.action === "markKitchenDeliveredToCourier" ? (
          <span key={step.action} className="flex flex-wrap items-center gap-2">
            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              value={courierByOrder[order.id] ?? ""}
              onChange={(event) =>
                setCourierByOrder((current) => ({ ...current, [order.id]: Number(event.target.value) }))
              }
            >
              <option value="">Kurye seç</option>
              {couriers.map((courier) => (
                <option key={courier.staffId} value={courier.staffId}>
                  {courier.displayName}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={busyOrderId === order.id || !courierByOrder[order.id]}
              onClick={() => onFlowAction(order, step.action, courierByOrder[order.id])}
            >
              {busyOrderId === order.id ? "Kaydediliyor…" : step.label}
            </Button>
          </span>
        ) : (
          <Button
            key={step.action}
            size="sm"
            disabled={busyOrderId === order.id}
            onClick={() => onFlowAction(order, step.action)}
          >
            {busyOrderId === order.id ? "Kaydediliyor…" : step.label}
          </Button>
        ),
      )}
      {cancelButton(order)}
    </>
  );

  return (
    <div className="space-y-4">
      <OrderCancelDialog
        open={closing != null}
        title={closing?.kind === "reject" ? "Siparişi reddet" : "Siparişi iptal et"}
        confirmLabel={closing?.kind === "reject" ? "Siparişi reddet" : "Siparişi iptal et"}
        subject={closing ? `${orderLocationLabel(closing.order)} #${closing.order.orderNumber || closing.order.id}` : null}
        onOpenChange={(open) => (open ? undefined : setClosing(null))}
        onConfirm={(request) => {
          if (closing?.kind === "reject") onReject(closing.order, request);
          else if (closing) onCancel(closing.order, request);
          setClosing(null);
        }}
      />
      {kitchenEnabled ? (
        <>
          <p className="text-xs text-muted-foreground">
            {counter
              ? "Gel-al: mutfak hazırlayınca müşteriye verilir."
              : "Bu masanın siparişleri hangi aşamada — onay, mutfak, teslim."}
          </p>
          <ProcessStepper
            steps={[
              { step: "1", title: "Onayla", detail: "Yeni siparişi kabul et", count: board.approve.length },
              { step: "2", title: "Mutfak", detail: "Hazırlanıyor", count: board.cooking.length },
              {
                step: "3",
                title: "Teslim al",
                detail: "Mutfaktan alındı",
                count: board.deliver.length,
                emphasis: true,
              },
              { step: "4", title: "Teslim edildi", detail: "Müşteriye bırakıldı", count: board.delivered.length },
            ]}
          />
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {counter
              ? "Mutfak kapalı. Gel-al tek dokunuşla biter. Paket hazır olunca kurye seçilir."
              : "Garsonun aldığı sipariş onaylı gelir. Müşteri teslimi unutulabilir. Adisyon kapanınca ödeme alındı olur."}
          </p>
          <ProcessStepper
            steps={[
              { step: "1", title: "Onayla", detail: "Yeni siparişi kabul et", count: board.approve.length },
              {
                step: "2",
                title: "Müşteri teslim",
                detail: "Unutulabilir",
                count: board.cooking.length,
                emphasis: true,
              },
              { step: "3", title: "Ödeme alındı", detail: "Adisyon kapanınca", count: board.delivered.length },
            ]}
          />
        </>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="space-y-3">
        <OrderLane
          compact
          title="Onayla"
          empty="Bu masada onay bekleyen sipariş yok."
          orders={board.approve}
          loading={pendingLoading}
          renderActions={(order) => (
            <>
              <Button size="sm" disabled={busyOrderId === order.id} onClick={() => onConfirm(order)}>
                {busyOrderId === order.id && confirmKind === order.id ? "Onaylanıyor…" : "Onayla"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyOrderId === order.id}
                onClick={() => setClosing({ order, kind: "reject" })}
              >
                Reddet
              </Button>
            </>
          )}
        />
        {kitchenEnabled ? (
          <>
            <OrderLane
              compact
              title="Mutfakta"
              empty="Bu masada mutfakta sipariş yok."
              orders={board.cooking}
              loading={kitchenLoading}
              renderMeta={(order) => (
                <p className="text-xs text-muted-foreground">{orderFlowStatusLabel(order.status)}</p>
              )}
              renderActions={cancelButton}
            />
            <OrderLane
              compact
              title="Teslim al"
              empty="Bu masada teslim alınacak sipariş yok."
              orders={board.deliver}
              loading={readyLoading}
              emphasis
              renderMeta={(order) => {
                const elapsed = formatKitchenElapsed(order.readyAt || order.submittedAt || order.createdAt);
                return elapsed ? (
                  <p className="text-xs font-medium text-amber-700">{elapsed} hazır bekliyor</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{orderFlowStatusLabel(order.status)}</p>
                );
              }}
              renderActions={flowButtons}
            />
          </>
        ) : (
          <OrderLane
            compact
            title="Müşteri teslim"
            empty="Bu masada teslim bekleyen sipariş yok."
            orders={board.cooking}
            loading={kitchenLoading}
            emphasis
            renderMeta={(order) => (
              <p className="text-xs text-muted-foreground">{waiterServiceStatusLabel(order.status)}</p>
            )}
            renderActions={flowButtons}
          />
        )}
        {openOnly ? null : (
          <>
            <OrderLane
              compact
              title={kitchenEnabled ? "Teslim edildi" : "Ödeme alındı"}
              empty={kitchenEnabled ? "Bugün teslim edilmiş sipariş yok." : "Bugün ödeme alınan sipariş yok."}
              orders={board.delivered}
              loading={false}
              renderMeta={kitchenEnabled ? undefined : (order) => (
                <p className="text-xs text-muted-foreground">{waiterServiceStatusLabel(order.status)}</p>
              )}
              renderActions={() => null}
            />
            <OrderLane
              compact
              title="İptal edilenler"
              empty="Bugün iptal edilen sipariş yok."
              orders={board.cancelled}
              loading={false}
              renderMeta={(order) => (
                <p className="text-xs font-medium text-destructive">
                  {[orderFlowStatusLabel(order.status), orderCancelReasonLabel(order)].filter(Boolean).join(" · ")}
                </p>
              )}
              renderActions={() => null}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** Waiter cancel hits the table-order API, so store and marketplace tickets are left to their own screens. */
function canWaiterCancel(order: OrderResponse): boolean {
  return kitchenOrderOrigin(order) === "TABLE" && isOrderCancellable(order.status, orderIsDelivery(order));
}

function ProcessStepper({
  steps,
}: {
  steps: { step: string; title: string; detail: string; count: number; emphasis?: boolean }[];
}) {
  return (
    <ol className="flex items-start">
      {steps.map((item, index) => (
        <li key={item.step} className="flex min-w-0 flex-1 flex-col items-center">
          <div className="flex w-full items-center">
            <span className={`h-px flex-1 ${index === 0 ? "bg-transparent" : "bg-border"}`} />
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                item.emphasis ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
              title={item.detail}
            >
              {item.step}
            </span>
            <span className={`h-px flex-1 ${index === steps.length - 1 ? "bg-transparent" : "bg-border"}`} />
          </div>
          <p className="mt-1.5 px-0.5 text-center text-[11px] font-semibold leading-tight">{item.title}</p>
          <p className="text-[11px] tabular-nums text-muted-foreground">{item.count}</p>
        </li>
      ))}
    </ol>
  );
}

function OrderLane({
  title,
  empty,
  orders,
  loading,
  emphasis = false,
  compact = false,
  onOpenBill,
  renderActions,
  renderMeta,
}: {
  title: string;
  empty: string;
  orders: OrderResponse[];
  loading: boolean;
  emphasis?: boolean;
  compact?: boolean;
  onOpenBill?: (order: OrderResponse) => void;
  renderActions: (order: OrderResponse) => ReactNode;
  renderMeta?: (order: OrderResponse) => ReactNode;
}) {
  return (
    <section
      className={
        compact
          ? emphasis
            ? "space-y-2 rounded-xl border border-primary/35 bg-card p-3 ring-1 ring-primary/10"
            : "space-y-2 rounded-xl border border-border bg-card p-3"
          : emphasis
            ? shell.cardEmphasis
            : shell.card
      }
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">{orders.length}</span>
      </div>
      {loading && orders.length === 0 ? <p className="text-sm text-muted-foreground">Yükleniyor…</p> : null}
      {!loading && orders.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : null}
      <ul className="space-y-2">
        {orders.map((order) => (
          <li key={order.id} className={shell.orderCard}>
            <p className="text-sm font-semibold">{orderLocationLabel(order)}</p>
            <p className="text-xs text-muted-foreground">#{order.orderNumber || order.id}</p>
            {renderMeta?.(order)}
            <OrderItems order={order} />
            <div className="mt-3 flex flex-wrap gap-2">
              {renderActions(order)}
              {onOpenBill && order.tableId != null ? (
                <Button size="sm" variant="secondary" onClick={() => onOpenBill(order)}>
                  Adisyon
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OrderItems({ order }: { order: OrderResponse }) {
  const items = order.items ?? [];
  if (items.length === 0 && !order.kitchenNote && !order.note) return null;
  const visible = items.slice(0, 4);
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

function tableTileClass(table: WaiterTableSummary, awaitingPaymentIds: ReadonlySet<number>): string {
  if (awaitingPaymentIds.has(table.tableId)) {
    return `${shell.tableTile} ${shell.tableTileUnpaid}`;
  }
  const busy =
    (table.pendingOrderCount ?? 0) > 0 ||
    (table.readyOrderCount ?? 0) > 0 ||
    (table.kitchenOrderCount ?? 0) > 0;
  if (busy) {
    return `${shell.tableTile} ${shell.tableTileIdle}`;
  }
  return `${shell.tableTile} ${shell.tableTilePaid}`;
}

function tableStatusLabel(table: WaiterTableSummary): string {
  if (table.billStatus === "OPEN") return "Açık adisyon";
  if ((table.pendingOrderCount ?? 0) > 0) return "Onay bekliyor";
  if ((table.readyOrderCount ?? 0) > 0) return "Hazır sipariş var";
  return "Boş";
}

function orderFromTable(table: WaiterTableSummary): OrderResponse {
  return {
    id: table.latestPendingOrderId ?? table.openBillId ?? table.tableId,
    status: "WAITER_TAKEN",
    tableId: table.tableId,
    tableName: table.tableName ?? null,
    billId: table.openBillId ?? null,
  };
}
