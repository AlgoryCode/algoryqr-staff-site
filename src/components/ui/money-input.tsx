"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function formatMoneyDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed === "-" || trimmed === ",") return trimmed;

  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const commaIndex = unsigned.indexOf(",");
  const hasComma = commaIndex >= 0;
  const intRaw = hasComma ? unsigned.slice(0, commaIndex) : unsigned;
  const fracRaw = hasComma ? unsigned.slice(commaIndex + 1) : "";
  const digits = intRaw.replace(/\D/g, "");
  const frac = fracRaw.replace(/\D/g, "").slice(0, 2);

  if (!digits && !hasComma) return negative ? "-" : "";
  const grouped = (digits || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const withFrac = hasComma ? `${grouped},${frac}` : grouped;
  return negative ? `-${withFrac}` : withFrac;
}

function countDigitsLeft(value: string, caret: number): number {
  let count = 0;
  for (let i = 0; i < caret && i < value.length; i += 1) {
    if (/\d/.test(value[i]!)) count += 1;
  }
  return count;
}

function caretFromDigitCount(value: string, digitCount: number): number {
  if (digitCount <= 0) return value.startsWith("-") ? 1 : 0;
  let seen = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (/\d/.test(value[i]!)) {
      seen += 1;
      if (seen >= digitCount) return i + 1;
    }
  }
  return value.length;
}

export function parseMoneyInput(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  if (!normalized || normalized === "-" || normalized === ".") return Number.NaN;
  return Number(normalized);
}

type MoneyInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "onChange" | "inputMode"
> & {
  value: string;
  onChange: (value: string) => void;
};

export function MoneyInput({ value, onChange, className, onBlur, ...props }: MoneyInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums",
        className,
      )}
      value={value}
      onChange={(event) => {
        const next = event.target.value;
        if (!(next === "" || /^-?[\d.,]*$/.test(next))) return;

        const caret = event.target.selectionStart ?? next.length;
        const digitsLeft = countDigitsLeft(next, caret);
        const endedWithComma = next.endsWith(",");
        const formatted = formatMoneyDisplay(next);
        onChange(formatted);

        requestAnimationFrame(() => {
          const el = inputRef.current;
          if (!el) return;
          let nextCaret = caretFromDigitCount(formatted, digitsLeft);
          if (endedWithComma && formatted.includes(",")) {
            nextCaret = formatted.indexOf(",") + 1;
          }
          el.setSelectionRange(nextCaret, nextCaret);
        });
      }}
      onBlur={(event) => {
        const formatted = formatMoneyDisplay(value);
        if (formatted !== value) onChange(formatted);
        onBlur?.(event);
      }}
    />
  );
}
