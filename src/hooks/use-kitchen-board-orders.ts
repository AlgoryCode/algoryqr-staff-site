"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { servedBillIds, withoutClosedBillTickets } from "@/lib/kitchen-queue";
import type { OrderResponse } from "@/lib/ordering-api";
import { getWaiterBill } from "@/lib/waiter-api";

const EMPTY_CLOSED = new Set<number>();

async function closedBillIds(billIds: number[]): Promise<Set<number>> {
  const closed = new Set<number>();
  await Promise.all(
    billIds.map(async (billId) => {
      try {
        const bill = await getWaiterBill(billId);
        if (bill.status === "CLOSED") closed.add(billId);
      } catch {
        // Leave the ticket up when the bill cannot be read.
      }
    }),
  );
  return closed;
}

/** Served tickets stay on the board until that table's bill is closed. */
export function useKitchenBoardOrders(orders: OrderResponse[]): OrderResponse[] {
  const billIds = useMemo(() => servedBillIds(orders), [orders]);
  const billKey = billIds.join(",");
  const closedQuery = useQuery({
    queryKey: ["kitchen-closed-bills", billKey],
    enabled: billIds.length > 0,
    queryFn: () => closedBillIds(billIds),
    refetchInterval: 6_000,
  });

  return useMemo(
    () => withoutClosedBillTickets(orders, closedQuery.data ?? EMPTY_CLOSED),
    [closedQuery.data, orders],
  );
}
