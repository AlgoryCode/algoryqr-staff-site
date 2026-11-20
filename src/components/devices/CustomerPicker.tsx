"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDeviceCustomer, deviceQueryKeys, searchDeviceCustomers } from "@/lib/device-api";
import { formatDeviceMoney, formatMinutes, type DeviceCustomer } from "@/lib/device-rental";

import { ErrorText, useDebounced } from "./device-ui";

/**
 * Free-text customer name that doubles as a search over customer cards. Picking a card links it; "Yeni müşteri"
 * creates a card from the typed name.
 */
export function CustomerPicker({
  name,
  onNameChange,
  selected,
  onSelect,
  label = "Müşteri",
}: {
  name: string;
  onNameChange: (name: string) => void;
  selected: DeviceCustomer | null;
  onSelect: (customer: DeviceCustomer | null) => void;
  label?: string;
}) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const term = useDebounced(name.trim(), 300);

  const searchQuery = useQuery({
    queryKey: deviceQueryKeys.customers(term),
    enabled: selected == null && term.length >= 2,
    queryFn: () => searchDeviceCustomers(term, 0, 8),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () => createDeviceCustomer({ name: name.trim(), phone: phone.trim() || undefined }),
    onSuccess: (customer) => {
      onSelect(customer);
      setCreating(false);
      setPhone("");
      void queryClient.invalidateQueries({ queryKey: ["staff-devices", "customers"] });
    },
  });

  if (selected) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <div className="flex items-center gap-3 rounded-xl border border-primary/35 bg-primary/5 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{selected.name}</p>
            <p className="text-xs text-muted-foreground">
              {selected.phone ? `${selected.phone} · ` : ""}Bakiye {formatDeviceMoney(selected.balance)}
              {selected.freeMinutes > 0 ? ` · ${formatMinutes(selected.freeMinutes)} ücretsiz` : ""}
              {(selected.membershipMinutes ?? 0) > 0 ? ` · ${formatMinutes(selected.membershipMinutes)} üyelik` : ""}
              {selected.tierName ? ` · ${selected.tierName}` : ""}
            </p>
          </div>
          <Button type="button" size="icon" variant="ghost" aria-label="Müşteriyi kaldır" onClick={() => onSelect(null)}>
            <X />
          </Button>
        </div>
      </div>
    );
  }

  const results = searchQuery.data?.content ?? [];

  return (
    <div className="space-y-1.5">
      <Label htmlFor="device-customer-name">{label}</Label>
      <Input
        id="device-customer-name"
        value={name}
        placeholder="Ad yazın veya müşteri kartı arayın"
        autoComplete="off"
        onChange={(event) => onNameChange(event.target.value)}
      />
      {term.length >= 2 ? (
        <div className="rounded-xl border border-border">
          {searchQuery.isLoading ? (
            <p className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aranıyor…
            </p>
          ) : searchQuery.isError ? (
            <div className="px-3 py-2">
              <ErrorText error={searchQuery.error} />
            </div>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Kayıtlı müşteri bulunamadı.</p>
          ) : (
            <ul className="max-h-44 divide-y divide-border overflow-y-auto">
              {results.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/60"
                    onClick={() => onSelect(customer)}
                  >
                    <span className="min-w-0 truncate font-medium">
                      {customer.name}
                      {customer.phone ? <span className="ml-1 text-xs text-muted-foreground">{customer.phone}</span> : null}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatDeviceMoney(customer.balance)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {creating ? (
        <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
          <p className="text-xs text-muted-foreground">
            Yeni kart: <strong className="text-foreground">{name.trim() || "—"}</strong>
          </p>
          <Input
            value={phone}
            placeholder="Telefon (isteğe bağlı)"
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
          />
          <ErrorText error={create.error} />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!name.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? <Loader2 className="animate-spin" /> : null}
              Kaydet
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setCreating(false)}>
              Vazgeç
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!name.trim()}
          onClick={() => setCreating(true)}
        >
          <UserPlus />
          Yeni müşteri
        </Button>
      )}
    </div>
  );
}
