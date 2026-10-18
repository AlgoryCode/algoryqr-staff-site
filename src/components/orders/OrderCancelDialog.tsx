"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ORDER_CANCEL_REASON_LABEL,
  type OrderCancelReason,
  type OrderCancelRequest,
} from "@/lib/order-flow";
import { cn } from "@/lib/utils";

const REASONS = Object.keys(ORDER_CANCEL_REASON_LABEL) as OrderCancelReason[];

type OrderCancelDialogProps = {
  open: boolean;
  title?: string;
  confirmLabel?: string;
  subject: string | null;
  description?: string;
  error?: string | null;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (request: OrderCancelRequest) => void;
};

export function OrderCancelDialog({
  open,
  title = "Siparişi iptal et",
  confirmLabel = "Siparişi iptal et",
  subject,
  description,
  error,
  busy = false,
  onOpenChange,
  onConfirm,
}: OrderCancelDialogProps) {
  const [reason, setReason] = useState<OrderCancelReason>("CUSTOMER_REQUEST");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setReason("CUSTOMER_REQUEST");
    setNote("");
  }, [open]);

  const noteRequired = reason === "OTHER" && !note.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-2xl border-slate-200 bg-white"
        overlayClassName="bg-slate-900/40 backdrop-blur-[2px]"
      >
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-semibold text-slate-900">{title}</DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {description ??
              (subject ? `${subject} iptal edilecek ve "İptal edilenler" listesine taşınacak.` : null)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">İptal nedeni</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="İptal nedeni">
              {REASONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={reason === value}
                  onClick={() => setReason(value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    reason === value
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {ORDER_CANCEL_REASON_LABEL[value]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="order-cancel-note" className="mb-2 block text-xs font-medium text-slate-500">
              Not {reason === "OTHER" ? "" : "(isteğe bağlı)"}
            </label>
            <Textarea
              id="order-cancel-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Örn. müşteri siparişi değiştirmek istedi"
              className="resize-none rounded-xl border-slate-200 text-sm"
            />
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-xl"
            disabled={busy || noteRequired}
            onClick={() => onConfirm({ reason, reasonNote: note.trim() || undefined })}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
