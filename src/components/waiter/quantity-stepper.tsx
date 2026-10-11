"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type QuantityStepperProps = {
  value: number;
  onChange: (quantity: number) => void;
  onRemove?: () => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  showDelete?: boolean;
  size?: "sm" | "md";
};

export function QuantityStepper({
  value,
  onChange,
  onRemove,
  disabled = false,
  min = 1,
  max = 999,
  showDelete = false,
  size = "md",
}: QuantityStepperProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(String(value));
    }
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commitDraft() {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      setEditing(false);
      return;
    }

    if (parsed <= 0) {
      if (onRemove) {
        onRemove();
      } else {
        onChange(min);
      }
      setEditing(false);
      return;
    }

    const next = Math.min(Math.max(parsed, min), max);
    if (next !== value) {
      onChange(next);
    }
    setEditing(false);
  }

  const buttonClass = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const inputClass = size === "sm" ? "h-8 w-10 px-1" : "h-9 w-12 px-1";

  return (
    <div className="flex items-center gap-1.5">
      {showDelete && onRemove && value > 0 ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(buttonClass, "shrink-0 text-destructive hover:text-destructive")}
          disabled={disabled}
          aria-label="Ürünü sil"
          onClick={onRemove}
        >
          <Trash2 className={iconClass} />
        </Button>
      ) : null}
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={buttonClass}
        disabled={disabled || value <= min}
        aria-label="Azalt"
        onClick={() => onChange(value - 1)}
      >
        <Minus className={iconClass} />
      </Button>
      {editing ? (
        <Input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          disabled={disabled}
          className={cn(inputClass, "text-center text-sm font-semibold tabular-nums")}
          aria-label="Adet"
          onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
            if (event.key === "Escape") {
              setDraft(String(value));
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          className={cn(
            inputClass,
            "inline-flex items-center justify-center rounded-md border border-transparent text-sm font-semibold tabular-nums transition-colors",
            disabled
              ? "cursor-not-allowed opacity-50"
              : "cursor-text hover:border-border hover:bg-muted/50",
          )}
          aria-label="Adeti düzenle"
          onClick={() => {
            if (!disabled) {
              setEditing(true);
            }
          }}
        >
          {value}
        </button>
      )}
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={buttonClass}
        disabled={disabled || value >= max}
        aria-label="Artır"
        onClick={() => onChange(value + 1)}
      >
        <Plus className={iconClass} />
      </Button>
    </div>
  );
}
