"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Loader2, Search, UserPlus, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput, parseMoneyInput } from "@/components/ui/money-input";
import {
  createDeviceCustomer,
  deviceQueryKeys,
  getDeviceCustomer,
  listDeviceCustomerMemberships,
  listDeviceMembershipPlans,
  searchDeviceCustomers,
  sellDeviceMembership,
  topUpDeviceCustomer,
} from "@/lib/device-api";
import {
  deviceTypeLabel,
  formatDeviceMoney,
  formatIstanbulDateTime,
  formatMinutes,
  PAYMENT_METHOD_LABEL,
  toAmount,
  type DeviceCustomer,
  type DevicePaymentMethod,
} from "@/lib/device-rental";
import { cn } from "@/lib/utils";

import { ChoiceButton, ErrorText, useDebounced } from "./device-ui";

type TopUpMethod = Exclude<DevicePaymentMethod, "BALANCE">;
const TOP_UP_METHODS: TopUpMethod[] = ["CASH", "CARD", "TRANSFER"];
const SALE_METHODS: DevicePaymentMethod[] = ["CASH", "CARD", "TRANSFER", "BALANCE"];

export function CustomersPanel() {
  const [term, setTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const q = useDebounced(term.trim(), 300);

  const listQuery = useQuery({
    queryKey: deviceQueryKeys.customers(q),
    queryFn: () => searchDeviceCustomers(q, 0, 30),
    retry: false,
  });
  const rows = listQuery.data?.content ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={term}
            placeholder="Ad veya telefon ara"
            onChange={(event) => setTerm(event.target.value)}
          />
        </div>
        <Button type="button" onClick={() => setCreating(true)}>
          <UserPlus />
          Yeni müşteri
        </Button>
      </div>

      <ErrorText error={listQuery.error} />

      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Müşteriler yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Müşteri bulunamadı.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {rows.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                onClick={() => setSelectedId(customer.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                    <span className="truncate">{customer.name}</span>
                    {customer.tierName ? (
                      <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                        {customer.tierName}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{customer.phone || "Telefon yok"}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold tabular-nums">{formatDeviceMoney(customer.balance)}</p>
                  {customer.freeMinutes > 0 ? (
                    <p className="text-emerald-700">{formatMinutes(customer.freeMinutes)} ücretsiz</p>
                  ) : null}
                  {(customer.membershipMinutes ?? 0) > 0 ? (
                    <p className="text-sky-700">{formatMinutes(customer.membershipMinutes)} üyelik</p>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          {creating ? (
            <CreateCustomerForm
              initialName={term.trim()}
              onCreated={(customer) => {
                setCreating(false);
                setSelectedId(customer.id);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={selectedId != null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {selectedId != null ? <CustomerDetail key={selectedId} customerId={selectedId} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateCustomerForm({
  initialName,
  onCreated,
}: {
  initialName: string;
  onCreated: (customer: DeviceCustomer) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createDeviceCustomer({ name: name.trim(), phone: phone.trim() || undefined, note: note.trim() || undefined }),
    onSuccess: (customer) => {
      void queryClient.invalidateQueries({ queryKey: ["staff-devices", "customers"] });
      onCreated(customer);
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) create.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>Yeni müşteri</DialogTitle>
        <DialogDescription>Müşteri kartı bakiye ve ücretsiz dakika biriktirir.</DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="device-customer-new-name">Ad</Label>
        <Input id="device-customer-new-name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="device-customer-new-phone">Telefon</Label>
        <Input
          id="device-customer-new-phone"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="device-customer-new-note">Not</Label>
        <Input id="device-customer-new-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      <ErrorText error={create.error} />
      <Button type="submit" className="w-full" disabled={!name.trim() || create.isPending}>
        {create.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
        Kaydet
      </Button>
    </form>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function CustomerDetail({ customerId }: { customerId: number }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<TopUpMethod>("CASH");
  const [done, setDone] = useState<string | null>(null);

  const customerQuery = useQuery({
    queryKey: deviceQueryKeys.customer(customerId),
    queryFn: () => getDeviceCustomer(customerId),
    retry: false,
  });

  const value = parseMoneyInput(amount);
  const valid = Number.isFinite(value) && value >= 0.01;

  const topUp = useMutation({
    mutationFn: () => topUpDeviceCustomer(customerId, { amount: value, paymentMethod: method }),
    onSuccess: (customer) => {
      queryClient.setQueryData(deviceQueryKeys.customer(customerId), customer);
      void queryClient.invalidateQueries({ queryKey: ["staff-devices", "customers"] });
      setDone(`${formatDeviceMoney(value)} yüklendi (${PAYMENT_METHOD_LABEL[method]}).`);
      setAmount("");
    },
  });

  const customer = customerQuery.data;

  if (customerQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
      </p>
    );
  }
  if (!customer) {
    return (
      <>
        <DialogTitle>Müşteri</DialogTitle>
        <ErrorText error={customerQuery.error ?? "Müşteri bulunamadı"} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>{customer.name}</DialogTitle>
        <DialogDescription>
          {customer.phone || "Telefon yok"}
          {customer.note ? ` · ${customer.note}` : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Bakiye" value={formatDeviceMoney(customer.balance)} />
        <Stat label="Ücretsiz dakika" value={formatMinutes(customer.freeMinutes)} />
        <Stat label="Toplam oyun" value={formatMinutes(customer.totalMinutes)} />
        <Stat label="Toplam harcama" value={formatDeviceMoney(customer.totalSpent)} />
        {customer.bonusBalance != null ? <Stat label="Bonus bakiye" value={formatDeviceMoney(customer.bonusBalance)} /> : null}
        {customer.membershipMinutes != null ? (
          <Stat label="Üyelik dakikası" value={formatMinutes(customer.membershipMinutes)} />
        ) : null}
        {customer.tierName ? (
          <Stat
            label="Seviye"
            value={`${customer.tierName}${toAmount(customer.tierDiscountPercent) > 0 ? ` · %${toAmount(customer.tierDiscountPercent)}` : ""}`}
          />
        ) : null}
        {customer.referralCode ? <Stat label="Davet kodu" value={customer.referralCode} /> : null}
      </div>

      <section className="space-y-3 border-t border-border pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Wallet className="h-4 w-4" /> Bakiye yükle
        </h3>
        <div className="space-y-1.5">
          <Label htmlFor="device-topup-amount">Tutar (₺)</Label>
          <MoneyInput id="device-topup-amount" value={amount} onChange={setAmount} placeholder="0" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {TOP_UP_METHODS.map((item) => (
            <ChoiceButton key={item} active={method === item} onClick={() => setMethod(item)}>
              {PAYMENT_METHOD_LABEL[item]}
            </ChoiceButton>
          ))}
        </div>
        <ErrorText error={topUp.error} />
        {done ? <p className="text-sm text-emerald-700">{done}</p> : null}
        <Button
          type="button"
          className="w-full"
          disabled={!valid || topUp.isPending}
          onClick={() => {
            setDone(null);
            topUp.mutate();
          }}
        >
          {topUp.isPending ? <Loader2 className="animate-spin" /> : <Wallet />}
          Bakiye yükle
        </Button>
      </section>

      <MembershipSection customerId={customerId} />
    </div>
  );
}

function MembershipSection({ customerId }: { customerId: number }) {
  const queryClient = useQueryClient();
  const [planId, setPlanId] = useState<number | null>(null);
  const [method, setMethod] = useState<DevicePaymentMethod>("CASH");
  const [done, setDone] = useState<string | null>(null);

  const plansQuery = useQuery({
    queryKey: deviceQueryKeys.plans,
    queryFn: listDeviceMembershipPlans,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const membershipsQuery = useQuery({
    queryKey: deviceQueryKeys.memberships(customerId),
    queryFn: () => listDeviceCustomerMemberships(customerId),
    retry: false,
  });

  const plans = (plansQuery.data ?? []).filter((plan) => plan.active !== false);
  const plan = plans.find((item) => item.id === planId) ?? null;
  const memberships = membershipsQuery.data ?? [];

  const sell = useMutation({
    mutationFn: () => sellDeviceMembership(customerId, { planId: planId!, paymentMethod: method }),
    onSuccess: (membership) => {
      setDone(`${membership.planName ?? plan?.name ?? "Üyelik"} satıldı (${PAYMENT_METHOD_LABEL[method]}).`);
      setPlanId(null);
      void queryClient.invalidateQueries({ queryKey: deviceQueryKeys.memberships(customerId) });
      void queryClient.invalidateQueries({ queryKey: deviceQueryKeys.customer(customerId) });
      void queryClient.invalidateQueries({ queryKey: ["staff-devices", "customers"] });
    },
  });

  // Hide the section on a backend without memberships (endpoint missing) and when nothing is on sale or owned.
  if (plansQuery.isError && membershipsQuery.isError) return null;
  if (!plansQuery.isLoading && !membershipsQuery.isLoading && plans.length === 0 && memberships.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <BadgeCheck className="h-4 w-4" /> Üyelikler
      </h3>

      <ErrorText error={membershipsQuery.error} />
      {memberships.length > 0 ? (
        <ul className="space-y-2">
          {memberships.map((item) => (
            <li
              key={item.id}
              className={cn(
                "rounded-xl border border-border p-3 text-sm",
                item.usable === false && "bg-muted/40 text-muted-foreground",
              )}
            >
              <p className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{item.planName ?? "Üyelik"}</span>
                <span className="shrink-0 text-xs tabular-nums">
                  {formatMinutes(item.minutesLeft)} / {formatMinutes(item.minutesTotal)}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {item.deviceType ? `${deviceTypeLabel(item.deviceType)} · ` : ""}
                {item.endsAt ? `Bitiş ${formatIstanbulDateTime(item.endsAt)}` : ""}
                {item.cancelled ? " · İptal" : item.usable === false ? " · Kullanılamaz" : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : membershipsQuery.isLoading ? null : (
        <p className="text-xs text-muted-foreground">Üyeliği yok.</p>
      )}

      {plans.length > 0 ? (
        <div className="space-y-2">
          <Label>Üyelik sat</Label>
          <div className="grid gap-2">
            {plans.map((item) => (
              <ChoiceButton
                key={item.id}
                className="text-left"
                active={planId === item.id}
                onClick={() => setPlanId(planId === item.id ? null : item.id)}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate">{item.name}</span>
                  <span className="shrink-0 tabular-nums">{formatDeviceMoney(item.price)}</span>
                </span>
                <span className="block text-[11px] font-normal">
                  {formatMinutes(item.minutes)} · {item.periodDays} gün
                  {item.deviceType ? ` · ${deviceTypeLabel(item.deviceType)}` : ""}
                </span>
              </ChoiceButton>
            ))}
          </div>
          {plan ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SALE_METHODS.map((item) => (
                  <ChoiceButton key={item} active={method === item} onClick={() => setMethod(item)}>
                    {PAYMENT_METHOD_LABEL[item]}
                  </ChoiceButton>
                ))}
              </div>
              <ErrorText error={sell.error} />
              <Button
                type="button"
                className="w-full"
                disabled={sell.isPending}
                onClick={() => {
                  setDone(null);
                  sell.mutate();
                }}
              >
                {sell.isPending ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
                {plan.name} sat · {formatDeviceMoney(plan.price)}
              </Button>
            </>
          ) : null}
        </div>
      ) : (
        <ErrorText error={plansQuery.error} />
      )}
      {done ? <p className="text-sm text-emerald-700">{done}</p> : null}
    </section>
  );
}
