"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Play, Trash2, Trophy, UserPlus, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  addDeviceTournamentPlayer,
  deviceQueryKeys,
  getDeviceTournament,
  listDeviceTournaments,
  payDeviceTournamentPlayer,
  removeDeviceTournamentPlayer,
  reportDeviceTournamentMatch,
  startDeviceTournament,
} from "@/lib/device-api";
import {
  formatDeviceMoney,
  formatIstanbulDateTime,
  groupMatchesByRound,
  PAYMENT_METHOD_LABEL,
  roundLabel,
  toAmount,
  TOURNAMENT_STATUS_LABEL,
  type DeviceCustomer,
  type DevicePaymentMethod,
  type DeviceTournament,
  type DeviceTournamentMatch,
  type DeviceTournamentPlayer,
  type DeviceTournamentStatus,
} from "@/lib/device-rental";
import { cn } from "@/lib/utils";

import { CustomerPicker } from "./CustomerPicker";
import { ChoiceButton, deviceCardClass, ErrorText } from "./device-ui";

const STATUS_CLASS: Record<DeviceTournamentStatus, string> = {
  REGISTRATION: "bg-emerald-200 text-emerald-950",
  RUNNING: "bg-sky-200 text-sky-950",
  FINISHED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-red-100 text-red-900",
};

const FEE_METHODS: DevicePaymentMethod[] = ["CASH", "CARD", "TRANSFER", "BALANCE"];

function StatusBadge({ status }: { status: DeviceTournamentStatus }) {
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_CLASS[status])}>
      {TOURNAMENT_STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** Staff run tournaments the owner created: players, fees, start and results. */
export function TournamentsPanel() {
  const [openId, setOpenId] = useState<number | null>(null);
  if (openId != null) return <TournamentDetail key={openId} tournamentId={openId} onBack={() => setOpenId(null)} />;
  return <TournamentList onOpen={setOpenId} />;
}

function TournamentList({ onOpen }: { onOpen: (id: number) => void }) {
  const listQuery = useQuery({
    queryKey: deviceQueryKeys.tournaments,
    queryFn: listDeviceTournaments,
    retry: false,
  });
  const rows = [...(listQuery.data ?? [])].sort((a, b) => {
    const order = (t: DeviceTournament) => (t.status === "RUNNING" ? 0 : t.status === "REGISTRATION" ? 1 : 2);
    return order(a) - order(b) || String(b.startsAt ?? "").localeCompare(String(a.startsAt ?? ""));
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Turnuvaları yönetim paneli oluşturur; burada oyuncu ve sonuçları girersiniz.</p>
      <ErrorText error={listQuery.error} />
      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Turnuvalar yükleniyor…</p>
      ) : rows.length === 0 && !listQuery.isError ? (
        <p className="text-sm text-muted-foreground">Turnuva yok.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {rows.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                onClick={() => onOpen(t.id)}
              >
                <Trophy className="h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatIstanbulDateTime(t.startsAt)}
                    {t.gameName ? ` · ${t.gameName}` : ""} · {t.playerCount ?? 0}/{t.maxPlayers} oyuncu
                    {t.winnerName ? ` · Kazanan: ${t.winnerName}` : ""}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TournamentDetail({ tournamentId, onBack }: { tournamentId: number; onBack: () => void }) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: deviceQueryKeys.tournament(tournamentId),
    queryFn: () => getDeviceTournament(tournamentId),
    retry: false,
  });

  /** Every mutation returns the whole tournament; keep it and refresh the list. */
  const apply = (t: DeviceTournament) => {
    queryClient.setQueryData(deviceQueryKeys.tournament(tournamentId), t);
    void queryClient.invalidateQueries({ queryKey: deviceQueryKeys.tournaments });
    // Fees land in the open shift.
    void queryClient.invalidateQueries({ queryKey: deviceQueryKeys.currentShift });
  };

  const start = useMutation({ mutationFn: () => startDeviceTournament(tournamentId), onSuccess: apply });

  const t = detailQuery.data;
  const back = (
    <Button type="button" size="sm" variant="ghost" className="-ml-2" onClick={onBack}>
      <ArrowLeft />
      Turnuvalar
    </Button>
  );

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-3">
        {back}
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      </div>
    );
  }
  if (!t) {
    return (
      <div className="space-y-3">
        {back}
        <ErrorText error={detailQuery.error ?? "Turnuva bulunamadı"} />
      </div>
    );
  }

  const fee = toAmount(t.entryFee);
  const players = t.players ?? [];
  const registration = t.status === "REGISTRATION";

  return (
    <div className="space-y-4">
      {back}

      <div className={deviceCardClass}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t.name}</h2>
            <p className="text-xs text-muted-foreground">
              {formatIstanbulDateTime(t.startsAt)}
              {t.gameName ? ` · ${t.gameName}` : ""}
            </p>
          </div>
          <StatusBadge status={t.status} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p>
            <span className="block text-[11px] text-muted-foreground">Oyuncu</span>
            {t.playerCount ?? players.length}/{t.maxPlayers}
          </p>
          <p>
            <span className="block text-[11px] text-muted-foreground">Katılım ücreti</span>
            {fee > 0 ? formatDeviceMoney(fee) : "Ücretsiz"}
          </p>
          {fee > 0 ? (
            <p>
              <span className="block text-[11px] text-muted-foreground">Tahsil edilen</span>
              {formatDeviceMoney(t.collected)} · {t.paidCount ?? 0} ödeme
            </p>
          ) : null}
          {t.prizeNote ? (
            <p>
              <span className="block text-[11px] text-muted-foreground">Ödül</span>
              {t.prizeNote}
            </p>
          ) : null}
        </div>
        {t.winnerName ? (
          <p className="flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950">
            <Trophy className="h-4 w-4" /> Kazanan: {t.winnerName}
          </p>
        ) : null}
        {registration ? (
          <>
            <ErrorText error={start.error} />
            <Button type="button" className="w-full" disabled={players.length < 2 || start.isPending} onClick={() => start.mutate()}>
              {start.isPending ? <Loader2 className="animate-spin" /> : <Play />}
              Turnuvayı başlat
            </Button>
            {players.length < 2 ? <p className="text-xs text-muted-foreground">Başlatmak için en az 2 oyuncu gerekir.</p> : null}
          </>
        ) : null}
      </div>

      {t.status === "RUNNING" || t.status === "FINISHED" ? <Bracket tournament={t} onChanged={apply} /> : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Oyuncular</h3>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz oyuncu yok.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {players.map((player) => (
              <PlayerRow key={player.id} tournament={t} player={player} onChanged={apply} />
            ))}
          </ul>
        )}
        {registration && players.length < t.maxPlayers ? <AddPlayerForm tournament={t} onChanged={apply} /> : null}
        {registration && players.length >= t.maxPlayers ? <p className="text-xs text-muted-foreground">Kontenjan dolu.</p> : null}
      </section>
    </div>
  );
}

function PlayerRow({
  tournament,
  player,
  onChanged,
}: {
  tournament: DeviceTournament;
  player: DeviceTournamentPlayer;
  onChanged: (t: DeviceTournament) => void;
}) {
  const [payOpen, setPayOpen] = useState(false);
  const fee = toAmount(tournament.entryFee);
  const canPay = fee > 0 && !player.paid && tournament.status !== "CANCELLED";

  const pay = useMutation({
    mutationFn: (method: DevicePaymentMethod) => payDeviceTournamentPlayer(tournament.id, player.id, method),
    onSuccess: onChanged,
  });
  const remove = useMutation({
    mutationFn: () => removeDeviceTournamentPlayer(tournament.id, player.id),
    onSuccess: onChanged,
  });

  return (
    <li className="space-y-1 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {player.name}
            {tournament.winnerPlayerId === player.id ? <Trophy className="ml-1 inline h-3.5 w-3.5 text-amber-600" /> : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {player.phone ? `${player.phone} · ` : ""}
            {player.customerId ? "Müşteri kartı" : "Misafir"}
            {fee > 0
              ? player.paid
                ? ` · Ödedi${player.paymentMethod ? ` (${PAYMENT_METHOD_LABEL[player.paymentMethod]})` : ""}`
                : " · Ödemedi"
              : ""}
          </p>
        </div>
        {canPay ? (
          <Popover open={payOpen} onOpenChange={setPayOpen}>
            <PopoverTrigger asChild>
              <Button type="button" size="sm" variant="outline" disabled={pay.isPending}>
                {pay.isPending ? <Loader2 className="animate-spin" /> : <Wallet />}
                Ücret al
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52">
              <p className="mb-2 text-xs text-muted-foreground">{formatDeviceMoney(fee)} · yöntem</p>
              <div className="grid grid-cols-2 gap-1.5">
                {FEE_METHODS.map((method) => (
                  <Button
                    key={method}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={method === "BALANCE" && !player.customerId}
                    onClick={() => {
                      setPayOpen(false);
                      pay.mutate(method);
                    }}
                  >
                    {PAYMENT_METHOD_LABEL[method]}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
        {tournament.status === "REGISTRATION" ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Oyuncuyu çıkar"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        ) : null}
      </div>
      <ErrorText error={pay.error ?? remove.error} />
    </li>
  );
}

function AddPlayerForm({ tournament, onChanged }: { tournament: DeviceTournament; onChanged: (t: DeviceTournament) => void }) {
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState<DeviceCustomer | null>(null);
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<DevicePaymentMethod | null>(null);
  const fee = toAmount(tournament.entryFee);

  const add = useMutation({
    mutationFn: () =>
      addDeviceTournamentPlayer(tournament.id, {
        customerId: customer?.id,
        name: customer ? undefined : name.trim(),
        phone: customer ? undefined : phone.trim() || undefined,
        paymentMethod: fee > 0 && method ? method : undefined,
      }),
    onSuccess: (t) => {
      setName("");
      setCustomer(null);
      setPhone("");
      setMethod(null);
      onChanged(t);
    },
  });

  const canSubmit = (customer != null || name.trim().length > 0) && !(method === "BALANCE" && !customer);

  return (
    <form
      className="space-y-3 rounded-2xl border border-dashed border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) add.mutate();
      }}
    >
      <CustomerPicker name={name} onNameChange={setName} selected={customer} onSelect={setCustomer} label="Oyuncu" />
      {!customer ? (
        <div className="space-y-1.5">
          <Label htmlFor="device-tournament-phone">Telefon (isteğe bağlı)</Label>
          <Input id="device-tournament-phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </div>
      ) : null}
      {fee > 0 ? (
        <div className="space-y-1.5">
          <Label>Katılım ücreti {formatDeviceMoney(fee)}</Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            <ChoiceButton active={method == null} onClick={() => setMethod(null)}>
              Sonra
            </ChoiceButton>
            {FEE_METHODS.map((item) => (
              <ChoiceButton
                key={item}
                active={method === item}
                disabled={item === "BALANCE" && !customer}
                onClick={() => setMethod(item)}
              >
                {PAYMENT_METHOD_LABEL[item]}
              </ChoiceButton>
            ))}
          </div>
        </div>
      ) : null}
      <ErrorText error={add.error} />
      <Button type="submit" className="w-full" disabled={!canSubmit || add.isPending}>
        {add.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
        Oyuncu ekle
      </Button>
    </form>
  );
}

function Bracket({ tournament, onChanged }: { tournament: DeviceTournament; onChanged: (t: DeviceTournament) => void }) {
  const rounds = groupMatchesByRound(tournament.matches);
  const totalRounds = tournament.rounds ?? rounds.length;
  if (rounds.length === 0) return null;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Fikstür</h3>
      {rounds.map((group) => (
        <div key={group.round} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {roundLabel(group.round, totalRounds)}
          </p>
          <ul className="space-y-2">
            {group.matches.map((match) => (
              <MatchCard key={match.id} tournament={tournament} match={match} onChanged={onChanged} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function MatchCard({
  tournament,
  match,
  onChanged,
}: {
  tournament: DeviceTournament;
  match: DeviceTournamentMatch;
  onChanged: (t: DeviceTournament) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [winner, setWinner] = useState<number | null>(match.winnerId ?? null);
  const [score, setScore] = useState(match.score && match.score !== "Bay" ? match.score : "");
  const bye = match.score === "Bay";
  const bothKnown = match.player1Id != null && match.player2Id != null;
  // A result can be entered (or corrected, until the next match is played) while the tournament runs.
  const canReport = tournament.status === "RUNNING" && bothKnown && !bye;

  const report = useMutation({
    mutationFn: () =>
      reportDeviceTournamentMatch(tournament.id, match.id, { winnerPlayerId: winner!, score: score.trim() || undefined }),
    onSuccess: (t) => {
      setEditing(false);
      onChanged(t);
    },
  });

  const side = (id: number | null | undefined, name: string | null | undefined) => (
    <span
      className={cn(
        "min-w-0 flex-1 truncate",
        match.winnerId != null && id === match.winnerId && "font-semibold text-emerald-700",
        match.winnerId != null && id !== match.winnerId && "text-muted-foreground line-through",
        id == null && "italic text-muted-foreground",
      )}
    >
      {name ?? (id == null ? (bye ? "—" : "Bekleniyor") : "Oyuncu")}
    </span>
  );

  return (
    <li className={cn("rounded-xl border border-border bg-card p-3", match.ready && "border-sky-500/50")}>
      <div className="flex items-center gap-2 text-sm">
        {side(match.player1Id, match.player1Name)}
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{match.score || "vs"}</span>
        <span className="flex min-w-0 flex-1 justify-end text-right">{side(match.player2Id, match.player2Name)}</span>
      </div>
      {canReport && !editing ? (
        <Button
          type="button"
          size="sm"
          variant={match.winnerId == null ? "default" : "ghost"}
          className="mt-2 w-full"
          onClick={() => setEditing(true)}
        >
          {match.winnerId == null ? "Sonuç gir" : "Sonucu düzelt"}
        </Button>
      ) : null}
      {editing ? (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <ChoiceButton active={winner === match.player1Id} onClick={() => setWinner(match.player1Id ?? null)}>
              <span className="block truncate">{match.player1Name ?? "Oyuncu 1"}</span>
            </ChoiceButton>
            <ChoiceButton active={winner === match.player2Id} onClick={() => setWinner(match.player2Id ?? null)}>
              <span className="block truncate">{match.player2Name ?? "Oyuncu 2"}</span>
            </ChoiceButton>
          </div>
          <Input
            placeholder="Skor (isteğe bağlı, örn. 3-1)"
            maxLength={40}
            value={score}
            onChange={(event) => setScore(event.target.value)}
          />
          <ErrorText error={report.error} />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="flex-1"
              disabled={winner == null || report.isPending}
              onClick={() => report.mutate()}
            >
              {report.isPending ? <Loader2 className="animate-spin" /> : <Trophy />}
              Kazananı kaydet
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              Vazgeç
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
