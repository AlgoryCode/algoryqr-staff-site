"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { formatMenuPrice } from "@/components/menu-templates/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { MenuProductOptionGroupApiItem } from "@/lib/api";
import {
  addWaiterBillItems,
  createWaiterOrder,
  listWaiterCatalog,
  WaiterApiError,
  type WaiterCatalogProduct,
  type WaiterTableSummary,
} from "@/lib/waiter-api";

type OrderLine = {
  key: string;
  productId: number;
  name: string;
  quantity: number;
  selectedOptionIds: number[];
  optionLabel: string;
  unitPrice: number;
};

type WaiterAddOrderSheetProps = {
  table: WaiterTableSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (table: WaiterTableSummary) => void;
  billId?: number | null;
  baseTotal?: number;
  currency?: string;
};

export function WaiterAddOrderSheet({
  table,
  open,
  onOpenChange,
  onCreated,
  billId = null,
  baseTotal = 0,
  currency: currencyProp = "TRY",
}: WaiterAddOrderSheetProps) {
  const tableId = table?.tableId ?? null;
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [draftOptions, setDraftOptions] = useState<number[]>([]);
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: ["staff-waiter-catalog", tableId],
    enabled: open && tableId != null,
    queryFn: () => listWaiterCatalog(tableId!),
  });

  useEffect(() => {
    if (!open) return;
    setCategory("all");
    setQuery("");
    setExpandedProductId(null);
    setDraftOptions([]);
    setDraftQuantity(1);
    setLines([]);
    setError(null);
  }, [open, tableId]);

  const products = catalogQuery.data?.products ?? [];
  const categories = useMemo(() => {
    const names: string[] = [];
    for (const product of products) {
      const name = categoryName(product);
      if (!names.includes(name)) names.push(name);
    }
    return names;
  }, [products]);

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    return products.filter((product) => {
      if (category !== "all" && categoryName(product) !== category) return false;
      if (!needle) return true;
      const haystack = [product.name, product.description, categoryName(product)]
        .filter((value): value is string => Boolean(value?.trim()))
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      return haystack.includes(needle);
    });
  }, [products, category, query]);

  const submit = useMutation({
    mutationFn: async () => {
      if (tableId == null) throw new Error("Masa seçilmedi");
      const items = lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        selectedOptionIds: line.selectedOptionIds,
      }));
      if (billId != null && billId > 0) {
        return addWaiterBillItems(billId, items);
      }
      return createWaiterOrder({ tableId, items });
    },
    onSuccess: () => {
      if (table) onCreated(table);
    },
    onError: (cause) => {
      setError(cause instanceof WaiterApiError ? cause.message : "Sipariş oluşturulamadı");
    },
  });

  const tableLabel = table?.tableName?.trim() || (table ? `Masa ${table.tableNumber ?? table.tableId}` : "Masa");
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const displayTotal = Math.max(0, baseTotal) + cartTotal;
  const currency = currencyProp || "TRY";
  const addingToBill = billId != null && billId > 0;

  const addConfiguredProduct = (product: WaiterCatalogProduct) => {
    const validation = optionValidation(product.optionGroups ?? [], draftOptions);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    const selected = [...draftOptions].sort((left, right) => left - right);
    setLines((current) =>
      upsertLine(
        current,
        {
          key: `${product.productId}:${selected.join(",")}`,
          productId: product.productId,
          name: product.name,
          quantity: draftQuantity,
          selectedOptionIds: selected,
          optionLabel: optionLabel(product.optionGroups ?? [], selected),
          unitPrice: unitPriceForProduct(product, selected),
        },
        draftQuantity,
      ),
    );
    setExpandedProductId(null);
    setDraftOptions([]);
    setDraftQuantity(1);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-hidden sm:max-w-md">
        <SheetHeader className="shrink-0 pr-6">
          <SheetTitle>{addingToBill ? "Adisyona ürün ekle" : "Sipariş ekle"}</SheetTitle>
          <SheetDescription>{tableLabel}</SheetDescription>
        </SheetHeader>

        <div className="mt-3 flex shrink-0 items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">Toplam tutar</span>
          <span className="text-lg font-semibold tabular-nums">{formatMenuPrice(displayTotal, currency)}</span>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
          {catalogQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Menü yükleniyor…</p>
          ) : catalogQuery.isError ? (
            <p className="text-sm text-destructive">
              {catalogQuery.error instanceof WaiterApiError
                ? catalogQuery.error.message
                : "Menü alınamadı"}
            </p>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu masada satılabilir ürün yok.</p>
          ) : (
            <>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ürün ara"
                aria-label="Ürün ara"
              />
              <div className="flex gap-2 overflow-x-auto pb-1">
                <CategoryChip active={category === "all"} onClick={() => setCategory("all")}>
                  Tümü
                </CategoryChip>
                {categories.map((name) => (
                  <CategoryChip key={name} active={category === name} onClick={() => setCategory(name)}>
                    {name}
                  </CategoryChip>
                ))}
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {visibleProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aramaya uyan ürün yok.</p>
                ) : null}
                {visibleProducts.map((product) => {
                  const groups = product.optionGroups ?? [];
                  const configurable = groups.length > 0;
                  const expanded = expandedProductId === product.productId;
                  const plainLine = lines.find((line) => line.key === String(product.productId));
                  return (
                    <div key={product.productId} className="rounded-xl border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <ProductThumb src={product.imageUrl} name={product.name} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatMenuPrice(product.price ?? undefined, product.currency || "TRY")}
                            </p>
                          </div>
                        </div>
                        {configurable ? (
                          <Button
                            type="button"
                            size="sm"
                            variant={expanded ? "secondary" : "outline"}
                            disabled={!product.available}
                            onClick={() => {
                              setError(null);
                              setExpandedProductId(expanded ? null : product.productId);
                              setDraftOptions([]);
                              setDraftQuantity(1);
                            }}
                          >
                            {product.available ? "Seç" : "Tükendi"}
                          </Button>
                        ) : (
                          <QuantityControl
                            quantity={plainLine?.quantity ?? 0}
                            disabled={!product.available}
                            onChange={(quantity) => {
                              setError(null);
                              setLines((current) =>
                                setLineQuantity(current, String(product.productId), {
                                  key: String(product.productId),
                                  productId: product.productId,
                                  name: product.name,
                                  quantity,
                                  selectedOptionIds: [],
                                  optionLabel: "",
                                  unitPrice: unitPriceForProduct(product, []),
                                }),
                              );
                            }}
                          />
                        )}
                      </div>
                      {expanded ? (
                        <div className="mt-3 space-y-3">
                          {groups.map((group) => (
                            <div key={group.groupId} className="space-y-2">
                              <p className="text-xs font-medium">
                                {group.name}
                                {group.minSelect > 0 ? ` · en az ${group.minSelect}` : ""}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {(group.options ?? [])
                                  .filter((option) => option.available !== false)
                                  .map((option) => {
                                    const selected = draftOptions.includes(option.optionId);
                                    return (
                                      <button
                                        key={option.optionId}
                                        type="button"
                                        className={`rounded-full border px-3 py-1 text-xs ${
                                          selected
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-border bg-background"
                                        }`}
                                        onClick={() =>
                                          setDraftOptions((current) => toggleOption(group, option.optionId, current))
                                        }
                                      >
                                        {option.name}
                                      </button>
                                    );
                                  })}
                              </div>
                            </div>
                          ))}
                          <div className="flex items-center justify-between gap-3">
                            <QuantityControl
                              quantity={draftQuantity}
                              min={1}
                              onChange={setDraftQuantity}
                            />
                            <Button type="button" size="sm" onClick={() => addConfiguredProduct(product)}>
                              Ekle
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {lines.length > 0 ? (
            <ul className="max-h-28 space-y-1 overflow-y-auto rounded-xl bg-muted/40 p-3 text-xs">
              {lines.map((line) => (
                <li key={line.key} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {line.quantity}× {line.name}
                    {line.optionLabel ? ` (${line.optionLabel})` : ""}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-destructive"
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                  >
                    Sil
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="button"
            disabled={itemCount === 0 || submit.isPending}
            onClick={() => {
              setError(null);
              submit.mutate();
            }}
          >
            {submit.isPending
              ? "Kaydediliyor…"
              : addingToBill
                ? `Adisyona ekle${itemCount > 0 ? ` (${itemCount})` : ""}`
                : `Siparişi gönder${itemCount > 0 ? ` (${itemCount})` : ""}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ProductThumb({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const url = src?.trim();
  if (!url || failed) {
    return (
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground"
      >
        {name.trim().slice(0, 1).toLocaleUpperCase("tr-TR") || "·"}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="h-10 w-10 shrink-0 rounded-lg object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function QuantityControl({
  quantity,
  disabled = false,
  min = 0,
  onChange,
}: {
  quantity: number;
  disabled?: boolean;
  min?: number;
  onChange: (quantity: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || quantity <= min}
        onClick={() => onChange(Math.max(min, quantity - 1))}
      >
        −
      </Button>
      <span className="w-5 text-center text-sm tabular-nums">{quantity}</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => onChange(quantity + 1)}
      >
        +
      </Button>
    </div>
  );
}

function categoryName(product: WaiterCatalogProduct): string {
  return product.mainCategoryName?.trim() || "Diğer";
}

function upsertLine(lines: OrderLine[], line: OrderLine, amount = 1): OrderLine[] {
  const existing = lines.find((item) => item.key === line.key);
  if (!existing) return [...lines, { ...line, quantity: amount }];
  return lines.map((item) =>
    item.key === line.key ? { ...item, quantity: item.quantity + amount } : item,
  );
}

function setLineQuantity(lines: OrderLine[], key: string, line: OrderLine): OrderLine[] {
  if (line.quantity <= 0) return lines.filter((item) => item.key !== key);
  const existing = lines.find((item) => item.key === key);
  if (!existing) return [...lines, line];
  return lines.map((item) => (item.key === key ? { ...item, quantity: line.quantity } : item));
}

function toggleOption(
  group: MenuProductOptionGroupApiItem,
  optionId: number,
  selected: number[],
): number[] {
  const groupIds = new Set((group.options ?? []).map((option) => option.optionId));
  const inGroup = selected.filter((id) => groupIds.has(id));
  const rest = selected.filter((id) => !groupIds.has(id));
  const max = Math.max(1, group.maxSelect ?? 1);
  if (inGroup.includes(optionId)) {
    return [...rest, ...inGroup.filter((id) => id !== optionId)];
  }
  if (max <= 1) return [...rest, optionId];
  if (inGroup.length >= max) return selected;
  return [...rest, ...inGroup, optionId];
}

function optionValidation(groups: MenuProductOptionGroupApiItem[], selected: number[]): string | null {
  for (const group of groups) {
    const ids = new Set((group.options ?? []).map((option) => option.optionId));
    const count = selected.filter((id) => ids.has(id)).length;
    if (count < (group.minSelect ?? 0)) {
      return `${group.name}: en az ${group.minSelect} seçin`;
    }
    if (count > (group.maxSelect ?? count)) {
      return `${group.name}: en fazla ${group.maxSelect} seçin`;
    }
  }
  return null;
}

function optionLabel(groups: MenuProductOptionGroupApiItem[], selected: number[]): string {
  const names: string[] = [];
  for (const group of groups) {
    for (const option of group.options ?? []) {
      if (selected.includes(option.optionId)) names.push(option.name);
    }
  }
  return names.join(", ");
}

function parseAmount(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", ".").trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function unitPriceForProduct(product: WaiterCatalogProduct, selectedOptionIds: number[]): number {
  let total = parseAmount(product.price);
  for (const group of product.optionGroups ?? []) {
    for (const option of group.options ?? []) {
      if (selectedOptionIds.includes(option.optionId)) {
        total += parseAmount(option.priceDelta);
      }
    }
  }
  return total;
}
