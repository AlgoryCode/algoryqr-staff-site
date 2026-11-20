"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Box, CircleDot, Gamepad, Gamepad2, Glasses, Joystick, Monitor, Car } from "lucide-react";

import type { DeviceType } from "@/lib/device-rental";
import { cn } from "@/lib/utils";

export function DeviceTypeIcon({ type, className }: { type?: DeviceType | null; className?: string }) {
  const cls = cn("h-4 w-4", className);
  switch (type ?? "PLAYSTATION") {
    case "PLAYSTATION":
      return <Gamepad2 className={cls} />;
    case "XBOX":
      return <Gamepad className={cls} />;
    case "NINTENDO":
      return <Joystick className={cls} />;
    case "PC":
      return <Monitor className={cls} />;
    case "VR":
      return <Glasses className={cls} />;
    case "SIMULATOR":
      return <Car className={cls} />;
    case "BILLIARDS":
      return <CircleDot className={cls} />;
    default:
      return <Box className={cls} />;
  }
}

/** Same inline error style as the bill sheet. */
export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="text-sm text-destructive">{errorMessage(error)}</p>;
}

export function errorMessage(error: unknown, fallback = "İşlem başarısız"): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

/** Segmented choice button, same look as the waiter screen's Kare / Liste toggle. */
export function ChoiceButton({
  active,
  disabled,
  onClick,
  children,
  className,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted/60",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ControllerToggle({ value, onChange }: { value: number; onChange: (count: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[2, 4].map((count) => (
        <ChoiceButton key={count} active={value === count} onClick={() => onChange(count)}>
          {count} kol
        </ChoiceButton>
      ))}
    </div>
  );
}

/** Wall clock that ticks every `intervalMs`. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Debounced copy of `value`. */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

let audioContext: AudioContext | null = null;

/** Short two-tone beep via WebAudio; silently does nothing where audio is blocked. */
export function playTimeUpBeep(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioContext ??= new Ctx();
    const ctx = audioContext;
    if (ctx.state === "suspended") void ctx.resume();
    const start = ctx.currentTime;
    [0, 0.25].forEach((offset, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = index === 0 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.22);
    });
  } catch {
    // Audio is optional.
  }
}

export const deviceCardClass = "flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm";
