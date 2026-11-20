"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput, parseMoneyInput } from "@/components/ui/money-input";
import { QuantityStepper } from "@/components/waiter/quantity-stepper";
import {
  addDeviceSessionItem,
  deviceQueryKeys,
  listDeviceProducts,
  removeDeviceSessionItem,
  type AddDeviceItemPayload,
} from "@/lib/device-api";
import { formatDeviceMoney, type DeviceProductOption, type DeviceSession } from "@/lib/device-rental";
import { cn } from "@/lib/utils";

import { ChoiceButton, ErrorText } from "./device-ui";

export function ItemsDialog({
  session,
  onOpenChange,
  onChanged,
}: {
  session: DeviceSession | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  return (
    <Dialog open={session != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {session ? <ItemsPanel key={session.id} initial={session} onChanged={onChanged} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ItemsPanel({ initial, onChanged }: { initial: DeviceSession; onChanged: () => void }) {
  const [session, setSession] = useState(initial);
  const [mode, setMode] = useState<"menu" | "free">("menu");
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<DeviceProductOption | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [freeName, setFreeName] = useState("");
  const [freePrice, setFreePrice] = useState("");

  const productsQuery = useQuery({
    queryKey: deviceQueryKeys.products,
    queryFn: listDeviceProducts,
    staleTime: 5 * 60_000,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");
    const rows = productsQuery.data ?? [];
    return term ? rows.filter((row) => row.name.toLocaleLowerCase("tr-TR").includes(term)) : rows;
  }, [productsQuery.data, search]);

  const add = useMutation({
    mutationFn: (payload: AddDeviceItemPayload) => addDeviceSessionItem(session.id, payload),
    onSuccess: (updated) => {
      setSession(updated);
      setProduct(null);
      setQuantity(1);
      setFreeName("");
      setFreePrice("");
      onChanged();
    },
  });

  const remove = useMutation({
    mutationFn: (itemId: number) => removeDeviceSessionItem(session.id, itemId),
    onSuccess: (updated) => {
      setSession(updated);
      onChanged();
    },
  });

  const price = parseMoneyInput(freePrice);
  const freeValid = freeName.trim().length > 0 && Number.isFinite(price) && price >= 0;
  const items = session.items ?? [];

  const submit = () => {
    if (mode === "menu" && product) add.mutate({ menuProductId: product.menuProductId, quantity });
    if (mode === "free" && freeValid) add.mutate({ name: freeName.trim(), unitPrice: price, quantity });
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Ürünler</DialogTitle>
        <DialogDescription>
          {session.consoleName ?? "Cihaz"} · {session.customerName?.trim() || "Misafir"}
        </DialogDescription>
      </DialogHeader>

      <section className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz ürün eklenmedi.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {item.quantity}× {item.name}
                </span>
                <span className="tabular-nums">{formatDeviceMoney(item.lineTotal)}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  aria-label="Ürünü sil"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(item.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="flex justify-between text-sm font-semibold">
          <span>Ürün toplamı</span>
          <span className="tabular-nums">{formatDeviceMoney(session.itemsAmount)}</span>
        </p>
        <ErrorText error={remove.error} />
      </section>

      <section className="space-y-3 border-t border-border pt-4">
        <div className="grid grid-cols-2 gap-2">
          <ChoiceButton active={mode === "menu"} onClick={() => setMode("menu")}>
            Menüden
          </ChoiceButton>
          <ChoiceButton active={mode === "free"} onClick={() => setMode("free")}>
            Serbest ürün
          </ChoiceButton>
        </div>

        {mode === "menu" ? (
          <div className="space-y-2">
            <Input value={search} placeholder="Ürün ara" onChange={(event) => setSearch(event.target.value)} />
            {productsQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Ürünler yükleniyor…</p>
            ) : productsQuery.isError ? (
              <ErrorText error={productsQuery.error} />
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground">Ürün bulunamadı.</p>
            ) : (
              <ul className="max-h-52 space-y-1 overflow-y-auto">
                {filtered.map((row) => (
                  <li key={row.menuProductId}>
                    <button
                      type="button"
                      aria-pressed={product?.menuProductId === row.menuProductId}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm",
                        product?.menuProductId === row.menuProductId
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:bg-muted/60",
                      )}
                      onClick={() => setProduct(row)}
                    >
                      <span className="min-w-0 truncate">{row.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{formatDeviceMoney(row.price)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_8rem] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="device-free-item-name">Ad</Label>
              <Input id="device-free-item-name" value={freeName} onChange={(event) => setFreeName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="device-free-item-price">Fiyat (₺)</Label>
              <MoneyInput id="device-free-item-price" value={freePrice} onChange={setFreePrice} placeholder="0" />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <QuantityStepper value={quantity} onChange={setQuantity} size="sm" />
          <Button
            type="button"
            disabled={add.isPending || (mode === "menu" ? product == null : !freeValid)}
            onClick={submit}
          >
            {add.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Ekle
          </Button>
        </div>
        <ErrorText error={add.error} />
      </section>
    </div>
  );
}
