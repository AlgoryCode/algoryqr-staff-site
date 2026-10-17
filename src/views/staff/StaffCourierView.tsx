"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CourierDisplayBoard } from "@/components/courier/CourierDisplayBoard";
import { ordersForStaffBranch } from "@/lib/branch-scope";
import { formatBranchCode, isBranchCourierEnabled } from "@/lib/branch";
import type { CourierTicket } from "@/lib/store-courier";
import {
  listCourierQueue,
  markCourierDeliveredToCustomer,
  markCourierTaken,
  WaiterApiError,
} from "@/lib/waiter-api";

import { StaffFrame } from "./StaffFrame";
import { useStaffSession } from "./use-staff-session";

export default function StaffCourierView() {
  const me = useStaffSession("COURIER");
  const queryClient = useQueryClient();
  const queueQuery = useQuery({
    queryKey: ["staff-courier-queue"],
    enabled: me != null,
    queryFn: listCourierQueue,
    refetchInterval: 6_000,
  });

  const branchOrders = useMemo(
    () =>
      me
        ? ordersForStaffBranch<CourierTicket>(queueQuery.data ?? [], me.branchId)
        : ([] as CourierTicket[]),
    [me, queueQuery.data],
  );

  const action = useMutation({
    mutationFn: async (payload: { orderId: number; kind: "dispatch" | "deliver" }) => {
      if (payload.kind === "dispatch") return markCourierTaken(payload.orderId);
      return markCourierDeliveredToCustomer(payload.orderId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff-courier-queue"] });
    },
  });

  if (!me) {
    return <p className="p-8 text-sm text-muted-foreground">Oturum kontrol ediliyor…</p>;
  }

  const courierEnabled = isBranchCourierEnabled(me);

  return (
    <StaffFrame displayName={me.displayName} role="COURIER" branchId={me.branchId}>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Kurye</h1>
          <p className="text-sm text-muted-foreground">
            {courierEnabled
              ? `Şube ${formatBranchCode(me.branchId)} teslimleri`
              : "Yeni paket atanmaz. Elindeki siparişleri teslim edebilirsin."}
          </p>
        </div>
        <CourierDisplayBoard
          orders={branchOrders}
          loading={queueQuery.isLoading}
          error={
            queueQuery.error instanceof WaiterApiError
              ? queueQuery.error.message
              : action.error instanceof Error
                ? action.error.message
                : null
          }
          busyOrderId={action.isPending ? action.variables?.orderId : null}
          currentStaffId={me.staffId}
          onDispatch={(orderId) => action.mutate({ orderId, kind: "dispatch" })}
          onDeliver={(orderId) => action.mutate({ orderId, kind: "deliver" })}
        />
      </div>
    </StaffFrame>
  );
}
