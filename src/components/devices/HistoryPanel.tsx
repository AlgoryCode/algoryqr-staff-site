"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { deviceQueryKeys, listDeviceSessionHistory } from "@/lib/device-api";
import {
  formatDeviceMoney,
  formatIstanbulDateTime,
  formatIstanbulTime,
  formatMinutes,
  PAYMENT_METHOD_LABEL,
  toAmount,
} from "@/lib/device-rental";

import { DeviceTypeIcon, ErrorText } from "./device-ui";

const PAGE_SIZE = 20;

export function HistoryPanel() {
  const [page, setPage] = useState(0);
  const historyQuery = useQuery({
    queryKey: deviceQueryKeys.history(page),
    queryFn: () => listDeviceSessionHistory(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const data = historyQuery.data;
  const rows = (data?.content ?? []).filter((session) => !session.active);

  return (
    <div className="space-y-4">
      <ErrorText error={historyQuery.error} />
      {historyQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Oturumlar yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz kapanan oturum yok.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {rows.map((session) => (
            <li key={session.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <DeviceTypeIcon type={session.deviceType} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {session.consoleName ?? "Cihaz"} · {session.customerName?.trim() || "Misafir"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatIstanbulDateTime(session.startedAt)}
                  {session.endedAt ? `–${formatIstanbulTime(session.endedAt)}` : ""} · {formatMinutes(session.durationMinutes)}
                  {session.items && session.items.length > 0 ? ` · ${session.items.length} ürün` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{formatDeviceMoney(session.amount)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {session.paymentMethod ? PAYMENT_METHOD_LABEL[session.paymentMethod] : ""}
                  {toAmount(session.discountAmount) > 0 ? ` · −${formatDeviceMoney(session.discountAmount)}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && (data.totalPages > 1 || page > 0) ? (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page === 0 || historyQuery.isFetching}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Önceki
          </Button>
          <span className="text-xs text-muted-foreground">
            Sayfa {page + 1}
            {data.totalPages > 0 ? ` / ${data.totalPages}` : ""}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!data.hasNext || historyQuery.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Sonraki
          </Button>
        </div>
      ) : null}
    </div>
  );
}
