// Финансы продавца: баланс, история продаж, история выводов и вывод средств
// с выбором способа (СБП / Карта / Счёт), быстрыми пресетами и сохранением
// способа по умолчанию.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  Wallet,
  TrendingUp,
  ArrowDownToLine,
  X,
  CheckCircle2,
  Clock,
  Smartphone,
  CreditCard,
  Landmark,
  Info,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
import { requestPayout, getPayoutDefaults, type PayoutMethod } from "@/lib/payouts.functions";
import { getSellerFinance } from "@/lib/order-history.functions";
import { STATUS_LABELS, type OrderStatus } from "@/lib/order-status";

export const Route = createFileRoute("/_authenticated/seller/balance")({
  component: BalancePage,
});

const MIN_AMOUNT_KOPECKS = 100_00;

const METHOD_META: Record<
  PayoutMethod,
  { label: string; icon: typeof Smartphone; eta: string; placeholder: string; hint: string }
> = {
  sbp: {
    label: "СБП",
    icon: Smartphone,
    eta: "мгновенно",
    placeholder: "+7 900 000-00-00",
    hint: "Номер телефона получателя, привязанный к банку в СБП.",
  },
  card: {
    label: "Карта",
    icon: CreditCard,
    eta: "до 3 минут",
    placeholder: "0000 0000 0000 0000",
    hint: "Номер карты российского банка.",
  },
  bank: {
    label: "Счёт",
    icon: Landmark,
    eta: "1–2 рабочих дня",
    placeholder: "40000000000000000000 · 044525000",
    hint: "Расчётный счёт (20 цифр) и БИК (9 цифр) через запятую.",
  },
};

function BalancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [method, setMethod] = useState<PayoutMethod>("sbp");
  const [destination, setDestination] = useState("");
  const [note, setNote] = useState("");
  const [saveDefault, setSaveDefault] = useState(true);

  const requestPayoutFn = useServerFn(requestPayout);
  const fetchFinance = useServerFn(getSellerFinance);
  const fetchDefaults = useServerFn(getPayoutDefaults);

  const salesQuery = useQuery({
    queryKey: ["seller-sales-total", user?.id],
    enabled: !!user,
    queryFn: () => fetchFinance(),
  });

  const defaultsQuery = useQuery({
    queryKey: ["seller-payout-defaults", user?.id],
    enabled: !!user,
    queryFn: () => fetchDefaults(),
  });

  const totalPayout = salesQuery.data?.totalPayout ?? 0;
  const totalSales = salesQuery.data?.totalSales ?? 0;
  const withdrawn = salesQuery.data?.withdrawn ?? 0;
  const available = salesQuery.data?.available ?? 0;
  const pending = salesQuery.data?.pending ?? 0;
  const soldItems = salesQuery.data?.items ?? [];
  const payouts = salesQuery.data?.payouts ?? [];

  // Realtime: подтверждение получения и появление новой выплаты
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`seller-finance-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "order_items", filter: `seller_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["seller-sales-total", user.id] }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payouts", filter: `seller_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["seller-sales-total", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const amountRub = Number(amountInput.replace(",", "."));
  const amountKopecks =
    Number.isFinite(amountRub) && amountRub > 0 ? Math.round(amountRub * 100) : 0;
  const belowMin = amountKopecks > 0 && amountKopecks < MIN_AMOUNT_KOPECKS;
  const overMax = amountKopecks > available;
  const destInvalid = destination.trim().length < 3;
  const amountInvalid = amountKopecks <= 0 || belowMin || overMax;
  const canWithdraw = !amountInvalid && !destInvalid;

  const withdraw = useMutation({
    mutationFn: async () =>
      requestPayoutFn({
        data: {
          amount_kopecks: amountKopecks,
          method,
          destination,
          note: note.trim() || undefined,
          save_as_default: saveDefault,
        },
      }),
    onSuccess: (res) => {
      toast.success("Заявка на вывод создана", {
        description: `${formatPrice(res.amount_kopecks)} · ${METHOD_META[res.method as PayoutMethod].label} · ${METHOD_META[res.method as PayoutMethod].eta}`,
        icon: <Sparkles className="h-4 w-4" />,
      });
      setConfirmOpen(false);
      setAmountInput("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["seller-sales-total", user?.id] });
      qc.invalidateQueries({ queryKey: ["seller-payout-defaults", user?.id] });
    },
    onError: (e: Error) => toast.error("Не удалось вывести средства", { description: e.message }),
  });

  const openWithdraw = () => {
    setAmountInput((available / 100).toFixed(2));
    const savedMethod = defaultsQuery.data?.method;
    const savedDest = defaultsQuery.data?.destination;
    if (savedMethod) setMethod(savedMethod);
    // Сохранённый destination уже маскирован — не подставляем в поле ввода,
    // только показываем подсказкой.
    setDestination("");
    setNote("");
    setSaveDefault(true);
    setConfirmOpen(true);
  };

  const preset = (fraction: number) => {
    const val = Math.max(0, Math.floor(available * fraction) / 100);
    setAmountInput(val.toFixed(2));
  };

  const cards = useMemo(
    () => [
      {
        label: "Общая сумма продаж",
        value: formatPrice(totalSales),
        hint: "заплатили покупатели",
        icon: TrendingUp,
        accent: "from-sky-500/15 to-sky-500/5 text-sky-700",
      },
      {
        label: "В ожидании",
        value: formatPrice(pending),
        hint: "поступит после подтверждения",
        icon: Clock,
        accent: "from-amber-500/15 to-amber-500/5 text-amber-700",
      },
      {
        label: "Заработано",
        value: formatPrice(totalPayout),
        hint: "покупатель подтвердил получение",
        icon: Wallet,
        accent: "from-emerald-500/15 to-emerald-500/5 text-emerald-700",
      },
      {
        label: "Уже выведено",
        value: formatPrice(withdrawn),
        hint: `выводов: ${payouts.length}`,
        icon: ArrowDownToLine,
        accent: "from-slate-500/15 to-slate-500/5 text-slate-700",
      },
    ],
    [totalSales, pending, totalPayout, withdrawn, payouts.length],
  );

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
              Средства становятся доступными после того, как покупатель подтвердит получение товара.
              В ожидании: <span className="font-semibold text-foreground">{formatPrice(pending)}</span>
              {salesQuery.data?.awaitingConfirm ? (
                <>
                  {" "}· ждут подтверждения:{" "}
                  <span className="font-semibold text-amber-700">
                    {formatPrice(salesQuery.data.awaitingConfirm)}
                  </span>
                </>
              ) : null}
              .
            </p>
          </div>
          <button
            disabled={available < MIN_AMOUNT_KOPECKS || withdraw.isPending}
            onClick={openWithdraw}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Вывести средства
          </button>
        </div>
        {available > 0 && available < MIN_AMOUNT_KOPECKS && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-800">
            <Info className="h-3.5 w-3.5" />
            Минимальная сумма вывода — 100 ₽. Продолжайте продавать!
          </div>
        )}
      </div>

      {/* Показатели */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

      {salesQuery.isError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          Не удалось загрузить продажи и финансы. Обновите страницу или попробуйте ещё раз.
        </div>
      )}

      {/* История продаж */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Купленные товары</h2>
          <span className="text-xs text-muted-foreground">{soldItems.length} позиций</span>
        </div>
        {soldItems.length > 0 ? (
          <ul className="divide-y">
            {soldItems.map((it) => {
              const line = it.price_kopecks * it.quantity;
              const payout = line - it.commission_kopecks;
              const status = (it.status ?? "new") as OrderStatus;
              return (
                <li key={it.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-xl bg-surface overflow-hidden shrink-0">
                      {it.image_url ? (
                        <img src={it.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-lg">🛍️</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium line-clamp-1">{it.title_snapshot}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatPrice(it.price_kopecks)} × {it.quantity} · {STATUS_LABELS[status]}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold">{formatPrice(line)}</div>
                    <div className="text-xs text-emerald-600 font-medium">
                      к выплате {formatPrice(payout)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Продаж пока нет. Здесь появятся товары, которые купили у вас.
          </div>
        )}
      </div>

      {/* История выводов */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">История выводов</h2>
          <span className="text-xs text-muted-foreground">{payouts.length} операций</span>
        </div>
        {payouts.length > 0 ? (
          <ul className="divide-y">
            {payouts.map((p) => {
              const m = (p.method as PayoutMethod | undefined) ?? null;
              const meta = m ? METHOD_META[m] : null;
              const Icon = meta?.icon ?? CheckCircle2;
              const statusLabel =
                p.status === "pending"
                  ? "В обработке"
                  : p.status === "rejected"
                    ? "Отклонён"
                    : "Выполнен";
              const statusClass =
                p.status === "pending"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : p.status === "rejected"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200";
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {meta ? meta.label : "Вывод средств"}
                        </span>
                        {p.destination && (
                          <span className="text-xs text-muted-foreground font-mono truncate">
                            {p.destination}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide rounded-full border px-2 py-0.5 ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(p.created_at).toLocaleString("ru-RU", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {p.note ? <> · {p.note}</> : null}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-foreground shrink-0">
                    −{formatPrice(p.amount_kopecks)}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Выводов пока не было. Как только у вас появятся продажи, вы сможете вывести заработанное.
          </div>
        )}
      </div>

      {/* Модалка вывода */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-t-3xl md:rounded-2xl bg-white shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
              <h3 className="font-semibold">Вывод средств</h3>
              <button
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg p-1.5 hover:bg-surface"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-5 overflow-y-auto">
              {/* Способ вывода */}
              <div>
                <div className="text-sm font-medium mb-2">Способ вывода</div>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(METHOD_META) as PayoutMethod[]).map((m) => {
                    const meta = METHOD_META[m];
                    const Icon = meta.icon;
                    const active = method === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setMethod(m);
                          setDestination("");
                        }}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition ${
                          active
                            ? "border-brand bg-brand-soft ring-2 ring-brand/30"
                            : "border-border bg-white hover:border-brand/50"
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${active ? "text-brand" : "text-foreground/70"}`} />
                        <span className="text-xs font-semibold">{meta.label}</span>
                        <span className="text-[10px] text-muted-foreground">{meta.eta}</span>
                      </button>
                    );
                  })}
                </div>
                {defaultsQuery.data?.method === method && defaultsQuery.data.destination && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Сохранённые реквизиты:{" "}
                    <span className="font-mono">{defaultsQuery.data.destination}</span>
                  </div>
                )}
              </div>

              {/* Реквизиты */}
              <div>
                <label htmlFor="dest" className="text-sm font-medium">
                  Реквизиты
                </label>
                <input
                  id="dest"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder={METHOD_META[method].placeholder}
                  className="mt-1 w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">{METHOD_META[method].hint}</p>
              </div>

              {/* Сумма */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="amount" className="text-sm font-medium">
                    Сумма, ₽
                  </label>
                  <span className="text-xs text-muted-foreground">
                    доступно{" "}
                    <span className="font-semibold text-foreground">{formatPrice(available)}</span>
                  </span>
                </div>
                <input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  max={(available / 100).toFixed(2)}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-xl font-bold outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="0.00"
                />
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {[0.25, 0.5, 0.75, 1].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => preset(f)}
                      className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-semibold hover:border-brand hover:text-brand transition"
                    >
                      {f === 1 ? "Всё" : `${Math.round(f * 100)}%`}
                    </button>
                  ))}
                </div>
                {belowMin && (
                  <p className="mt-2 text-xs text-destructive">Минимум — 100 ₽</p>
                )}
                {overMax && (
                  <p className="mt-2 text-xs text-destructive">Больше доступного баланса</p>
                )}
              </div>

              {/* Комментарий */}
              <div>
                <label htmlFor="note" className="text-sm font-medium">
                  Комментарий <span className="text-muted-foreground font-normal">— необязательно</span>
                </label>
                <input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={300}
                  placeholder="Например: закупка товара"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              <label className="flex items-start gap-2 text-xs text-foreground/80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saveDefault}
                  onChange={(e) => setSaveDefault(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-brand shrink-0"
                />
                <span>Запомнить {METHOD_META[method].label.toLowerCase()} как способ по умолчанию.</span>
              </label>
            </div>

            <div className="flex gap-2 px-5 py-4 border-t bg-surface/50">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-full border border-border bg-white px-4 py-2.5 text-sm font-semibold hover:bg-surface transition"
              >
                Отмена
              </button>
              <button
                onClick={() => withdraw.mutate()}
                disabled={withdraw.isPending || !canWithdraw}
                className="flex-1 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {withdraw.isPending
                  ? "Отправка…"
                  : `Вывести ${amountKopecks > 0 ? formatPrice(amountKopecks) : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
