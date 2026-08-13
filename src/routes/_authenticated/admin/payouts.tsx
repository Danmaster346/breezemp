// Выплаты продавцам
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listAdminPayouts,
  processAdminPayout,
  freezeSellerBalance,
  type AdminPayoutRow,
} from "@/lib/admin/payouts.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, Snowflake, Sun, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  component: PayoutsPage,
});

const PAGE_SIZE = 20;

function formatRub(kopecks: number) {
  return `${Math.round(kopecks / 100).toLocaleString("ru-RU")} ₽`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

function PayoutsPage() {
  const list = useServerFn(listAdminPayouts);
  const process = useServerFn(processAdminPayout);
  const freeze = useServerFn(freezeSellerBalance);
  const qc = useQueryClient();

  const [filter, setFilter] = useState<"all" | "pending" | "frozen">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const [payoutTarget, setPayoutTarget] = useState<AdminPayoutRow | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [note, setNote] = useState("");

  const [freezeTarget, setFreezeTarget] = useState<AdminPayoutRow | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-payouts", filter, q, page],
    queryFn: () => list({ data: { filter, q, page, pageSize: PAGE_SIZE } }),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const processM = useMutation({
    mutationFn: (v: { seller_id: string; amount_kopecks: number; note?: string }) => process({ data: v }),
    onSuccess: () => {
      toast.success("Выплата произведена");
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      setPayoutTarget(null);
      setAmountInput("");
      setNote("");
    },
    onError: (e: Error) => toast.error("Не удалось выплатить", { description: e.message }),
  });

  const freezeM = useMutation({
    mutationFn: (v: { seller_id: string; frozen: boolean; reason?: string }) => freeze({ data: v }),
    onSuccess: (_res, vars) => {
      toast.success(vars.frozen ? "Баланс заморожен" : "Баланс разморожен");
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      setFreezeTarget(null);
      setReason("");
    },
    onError: (e: Error) => toast.error("Не удалось изменить статус", { description: e.message }),
  });

  const openPayout = (row: AdminPayoutRow) => {
    setPayoutTarget(row);
    setAmountInput((row.available_kopecks / 100).toFixed(2));
    setNote("");
  };

  const amountRub = Number(amountInput.replace(",", "."));
  const amountKopecks = Number.isFinite(amountRub) && amountRub > 0 ? Math.round(amountRub * 100) : 0;
  const amountInvalid = !payoutTarget || amountKopecks <= 0 || amountKopecks > payoutTarget.available_kopecks;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Выплаты продавцам</h1>
        <p className="text-foreground/60 text-sm mt-1">Всего продавцов: {total}</p>
      </div>

      <div className="rounded-2xl bg-white border border-border/60 p-3 flex flex-wrap gap-2 items-center">
        <div className="flex gap-2 flex-wrap">
          {([
            { key: "all", label: "Все" },
            { key: "pending", label: "Ожидают выплаты" },
            { key: "frozen", label: "Заморожены" },
          ] as const).map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              onClick={() => {
                setFilter(f.key);
                setPage(1);
              }}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Название магазина, имя, email"
            className="pl-9"
          />
        </div>
      </div>

      {isError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          Не удалось загрузить выплаты. Попробуйте обновить страницу.
        </div>
      )}

      <div className="rounded-2xl bg-white border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-surface animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-foreground/60">Ничего не найдено</div>
        ) : (
          <>
            {/* Десктоп-таблица */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-foreground/60">
                    <th className="p-3 font-medium">Продавец</th>
                    <th className="p-3 font-medium">К выплате</th>
                    <th className="p-3 font-medium">Всего заработано</th>
                    <th className="p-3 font-medium">Статус</th>
                    <th className="p-3 font-medium">Последняя выплата</th>
                    <th className="p-3 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rows.map((r) => (
                    <tr key={r.seller_id}>
                      <td className="p-3 font-semibold">{r.shop_name}</td>
                      <td className="p-3 font-semibold text-emerald-700">{formatRub(r.available_kopecks)}</td>
                      <td className="p-3 text-foreground/70">{formatRub(r.earned_kopecks)}</td>
                      <td className="p-3">
                        {r.frozen ? (
                          <Badge variant="destructive" className="text-[10px]">Заморожен</Badge>
                        ) : r.available_kopecks > 0 ? (
                          <Badge variant="secondary" className="text-[10px]">Ожидает</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Выплачено</Badge>
                        )}
                      </td>
                      <td className="p-3 text-foreground/70">{formatDate(r.last_payout_at)}</td>
                      <td className="p-3">
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            disabled={r.frozen || r.available_kopecks <= 0}
                            onClick={() => openPayout(r)}
                          >
                            <Wallet className="h-4 w-4 mr-1" />Выплатить
                          </Button>
                          {r.frozen ? (
                            <Button size="sm" variant="outline" onClick={() => freezeM.mutate({ seller_id: r.seller_id, frozen: false })}>
                              <Sun className="h-4 w-4 mr-1" />Разморозить
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setFreezeTarget(r)}>
                              <Snowflake className="h-4 w-4 mr-1" />Заморозить
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Мобильные карточки */}
            <div className="md:hidden divide-y divide-border/60">
              {rows.map((r) => (
                <div key={r.seller_id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold truncate">{r.shop_name}</div>
                    {r.frozen ? (
                      <Badge variant="destructive" className="text-[10px]">Заморожен</Badge>
                    ) : r.available_kopecks > 0 ? (
                      <Badge variant="secondary" className="text-[10px]">Ожидает</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Выплачено</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-foreground/50">К выплате</div>
                      <div className="font-semibold text-emerald-700">{formatRub(r.available_kopecks)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-foreground/50">Всего заработано</div>
                      <div>{formatRub(r.earned_kopecks)}</div>
                    </div>
                  </div>
                  <div className="text-xs text-foreground/50">Последняя выплата: {formatDate(r.last_payout_at)}</div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" disabled={r.frozen || r.available_kopecks <= 0} onClick={() => openPayout(r)}>
                      <Wallet className="h-4 w-4 mr-1" />Выплатить
                    </Button>
                    {r.frozen ? (
                      <Button size="sm" variant="outline" onClick={() => freezeM.mutate({ seller_id: r.seller_id, frozen: false })}>
                        <Sun className="h-4 w-4 mr-1" />Разморозить
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setFreezeTarget(r)}>
                        <Snowflake className="h-4 w-4 mr-1" />Заморозить
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Назад</Button>
          <div className="px-3 py-2 text-sm">Стр. {page} из {totalPages}</div>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Вперёд</Button>
        </div>
      )}

      {/* Диалог выплаты */}
      <Dialog open={!!payoutTarget} onOpenChange={(v) => !v && setPayoutTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Выплата продавцу</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-foreground/70">{payoutTarget?.shop_name}</div>
          {payoutTarget && (
            <div className="text-xs text-foreground/50">
              Доступно к выплате: <span className="font-semibold text-foreground">{formatRub(payoutTarget.available_kopecks)}</span>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs text-foreground/60">Сумма, ₽</label>
            <Input
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-foreground/60">Примечание (необязательно)</label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий к выплате" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutTarget(null)}>Отмена</Button>
            <Button
              disabled={amountInvalid || processM.isPending}
              onClick={() =>
                payoutTarget &&
                processM.mutate({ seller_id: payoutTarget.seller_id, amount_kopecks: amountKopecks, note: note.trim() || undefined })
              }
            >
              Выплатить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог заморозки */}
      <Dialog open={!!freezeTarget} onOpenChange={(v) => !v && setFreezeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Заморозить баланс продавца?</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-foreground/70">{freezeTarget?.shop_name}</div>
          <Input placeholder="Причина заморозки" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFreezeTarget(null)}>Отмена</Button>
            <Button
              variant="destructive"
              disabled={freezeM.isPending}
              onClick={() => freezeTarget && freezeM.mutate({ seller_id: freezeTarget.seller_id, frozen: true, reason })}
            >
              Заморозить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
