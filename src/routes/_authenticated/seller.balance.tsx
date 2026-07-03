// Финансы продавца: баланс, история и демо-вывод средств
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Banknote, Wallet, TrendingUp, ArrowDownToLine, X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
import { requestPayout } from "@/lib/payouts.functions";

export const Route = createFileRoute("/_authenticated/seller/balance")({
  component: BalancePage,
});

function BalancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const requestPayoutFn = useServerFn(requestPayout);

  // Продажи продавца → считаем итоги
  const salesQuery = useQuery({
    queryKey: ["seller-sales-total", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("price_kopecks, quantity, commission_kopecks")
        .eq("seller_id", user!.id);
      if (error) throw error;
      const totalSales = (data ?? []).reduce((s, r) => s + r.price_kopecks * r.quantity, 0);
      const totalPayout = (data ?? []).reduce(
        (s, r) => s + (r.price_kopecks * r.quantity - r.commission_kopecks),
        0,
      );
      return { totalSales, totalPayout };
    },
  });

  // История выводов
  const payoutsQuery = useQuery({
    queryKey: ["seller-payouts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select("id, amount_kopecks, created_at")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalPayout = salesQuery.data?.totalPayout ?? 0;
  const totalSales = salesQuery.data?.totalSales ?? 0;
  const withdrawn = (payoutsQuery.data ?? []).reduce((s, p) => s + p.amount_kopecks, 0);
  const available = Math.max(0, totalPayout - withdrawn);

  // Демо-вывод: пишем запись в таблицу payouts
  const withdraw = useMutation({
    mutationFn: async (amount: number) => {
      const { error } = await supabase
        .from("payouts")
        .insert({ seller_id: user!.id, amount_kopecks: amount });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Средства выведены (демо)", {
        description: `На ваш счёт зачислено ${formatPrice(available)}`,
      });
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["seller-payouts", user?.id] });
    },
    onError: (e: Error) => toast.error("Не удалось вывести средства", { description: e.message }),
  });

  const cards = [
    {
      label: "Общая сумма продаж",
      value: formatPrice(totalSales),
      hint: "заплатили покупатели",
      icon: TrendingUp,
      accent: "from-sky-500/15 to-sky-500/5 text-sky-700",
    },
    {
      label: "Заработано (после комиссии 10%)",
      value: formatPrice(totalPayout),
      hint: "всего начислено вам",
      icon: Wallet,
      accent: "from-emerald-500/15 to-emerald-500/5 text-emerald-700",
    },
    {
      label: "Уже выведено",
      value: formatPrice(withdrawn),
      hint: `выводов: ${payoutsQuery.data?.length ?? 0}`,
      icon: ArrowDownToLine,
      accent: "from-slate-500/15 to-slate-500/5 text-slate-700",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Основная карточка: сумма к выводу + кнопка */}
      <div className="relative overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-brand-soft via-white to-white p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white border border-border px-3 py-1 text-xs font-semibold text-brand">
              <Banknote className="h-3.5 w-3.5" /> Доступно к выводу
            </div>
            <div className="mt-4 text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
              {formatPrice(available)}
            </div>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Сумма формируется из ваших продаж за вычетом комиссии платформы 10% и уже сделанных выводов.
            </p>
          </div>
          <button
            disabled={available <= 0 || withdraw.isPending}
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Вывести средства
          </button>
        </div>
      </div>

      {/* Три показателя */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={`relative rounded-2xl border bg-gradient-to-br ${c.accent} p-5`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground">{c.label}</div>
                  <div className="mt-1 text-xl md:text-2xl font-bold text-foreground break-words">
                    {c.value}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{c.hint}</div>
                </div>
                <div className="rounded-xl bg-white/70 p-2 shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* История выводов */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">История выводов</h2>
          <span className="text-xs text-muted-foreground">
            {payoutsQuery.data?.length ?? 0} операций
          </span>
        </div>
        {payoutsQuery.data && payoutsQuery.data.length > 0 ? (
          <ul className="divide-y">
            {payoutsQuery.data.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Вывод средств</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-bold text-foreground shrink-0">
                  −{formatPrice(p.amount_kopecks)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Выводов пока не было. Как только у вас появятся продажи, вы сможете вывести заработанное.
          </div>
        )}
      </div>

      {/* Модалка подтверждения */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold">Подтверждение вывода</h3>
              <button
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg p-1.5 hover:bg-surface"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                На ваш банковский счёт будет переведена вся доступная сумма. Это демо-режим — реальные средства не переводятся.
              </p>
              <div className="rounded-xl border bg-surface p-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">К выводу</span>
                <span className="text-2xl font-extrabold text-brand">{formatPrice(available)}</span>
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t bg-surface/50">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-full border border-border bg-white px-4 py-2.5 text-sm font-semibold hover:bg-surface transition"
              >
                Отмена
              </button>
              <button
                onClick={() => withdraw.mutate(available)}
                disabled={withdraw.isPending || available <= 0}
                className="flex-1 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50 transition"
              >
                {withdraw.isPending ? "Отправка…" : "Подтвердить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
