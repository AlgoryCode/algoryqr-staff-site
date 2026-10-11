export function paymentMethodLabel(method: "CASH" | "CARD"): string {
  return method === "CARD" ? "Kredi kartı" : "Nakit";
}

export const billCardClass =
  "rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm";

export const billSoftBgClass = "bg-[#FAFAFA]";

export function PaymentMethodPicker({
  value,
  onChange,
  disabled,
}: {
  value: "CASH" | "CARD" | null;
  onChange: (method: "CASH" | "CARD") => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        disabled={disabled}
        className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
          value === "CASH"
            ? "border-zinc-900 bg-zinc-900 text-white"
            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
        }`}
        onClick={() => onChange("CASH")}
      >
        Nakit
      </button>
      <button
        type="button"
        disabled={disabled}
        className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
          value === "CARD"
            ? "border-zinc-900 bg-zinc-900 text-white"
            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
        }`}
        onClick={() => onChange("CARD")}
      >
        Kredi kartı
      </button>
    </div>
  );
}
