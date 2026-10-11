"use client";

import { formatMenuPrice } from "@/components/menu-templates/types";

export function BillSummaryBar({
  total,
  paid,
  remaining,
  currency,
}: {
  total?: number | string | null;
  paid?: number | string | null;
  remaining?: number | string | null;
  currency: string;
}) {
  const rows = [
    { label: "Toplam", value: total, emphasis: false },
    { label: "Ödenen", value: paid, emphasis: false, tone: "paid" as const },
    { label: "Kalan", value: remaining, emphasis: true, tone: "remaining" as const },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
      {rows.map((row) => (
        <div key={row.label} className="text-center">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            {row.label}
          </p>
          <p
            className={`mt-0.5 text-sm tabular-nums ${
              row.emphasis
                ? "font-bold text-zinc-900"
                : row.tone === "paid"
                  ? "font-semibold text-emerald-700"
                  : "font-semibold text-zinc-800"
            }`}
          >
            {formatMenuPrice(row.value ?? undefined, currency)}
          </p>
        </div>
      ))}
    </div>
  );
}
