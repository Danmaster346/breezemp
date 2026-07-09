// Возвраты у продавца: список заявок и решение (одобрить / отклонить)
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X, Undo2, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { STATUS_BADGE, STATUS_LABELS, normalizeStatus } from "@/lib/order-status";
import {
  listSellerReturns,
  sellerResolveReturn,
} from "@/lib/seller-returns.functions";

type Filter = "pending" | "resolved" | "all";
type SearchParams = { filter?: Filter };

export const Route = createFileRoute("/_authenticated/seller/returns")({
  head: () => ({ meta: [{ title: "Возвраты — продавец — BreezeMarket" }] }),
  validateSearch: (s: Record<string, unknown>): SearchParams => {
    const f = s.filter as Filter | undefined;
    return { filter: f === "resolved" || f === "all" ? f : "pending" };
  },
  component: SellerReturnsPage,
});

type Row = {
  id: string;
  order_id: string;
  product_id: string | null;
  title_snapshot: string;
  image_url: string | null;
  price_kopecks: number;
  quantity: number;
  status: string;
  return_reason: string | null;
  return_comment: string | null;
  return_photos: string[] | null;
  return_admin_status: string;
  return_admin_reason: string | null;
  returned_at: string | null;
  orders: {
    id: string;
    created_at: string;
    shipping_name: string | null;
    shipping_phone: string | null;
    shipping_address: string | null;
  } | null;
};

const fmt = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

function SellerReturnsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const list = useServerFn(listSellerReturns);
  const resolve = useServerFn(sellerResolveReturn);
  const qc = useQueryClient();
  const filter: Filter = search.filter ?? "pending";
  const [decision, setDecision] = useState<{
    item: Row;
    action: "approve" | "reject";
  } | null>(null);
  const [comment, setComment] = useState("");

  const q = useQuery({
    queryKey: ["seller-returns", filter],
    queryFn: async () => ((await list({ data: { filter } })) ?? []) as Row[],
  });

  const mut = useMutation({
    mutationFn: (v: { order_item_id: string; action: "approve" | "reject"; comment: string }) =>
      resolve({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.action === "approve" ? "Возврат одобрен" : "Возврат отклонён");
      qc.invalidateQueries({ queryKey: ["seller-returns"] });
      qc.invalidateQueries({ queryKey: ["seller-orders"] });
      setDecision(null);
      setComment("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];

  const submitDecision = () => {
    if (!decision) return;
    if (decision.action === "reject" && !comment.trim()) {
      toast.error("Укажите причину отказа");
      return;
    }
    mut.mutate({
      order_item_id: decision.item.id,
      action: decision.action,
      comment: comment.trim(),
    });
  };

  const setFilter = (f: Filter) => navigate({ search: { filter: f } });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(
          [
            ["pending", "Новые"],
            ["resolved", "Решённые"],
            ["all", "Все"],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition ${
              filter === key
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          <Undo2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
          {filter === "pending"
            ? "Новых заявок на возврат нет"
            : "Заявок нет"}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const st = normalizeStatus(r.status);
            const isPending = r.status === "return_requested";
            return (
              <div key={r.id} className="rounded-2xl border bg-card p-4">
                <div className="flex gap-3 flex-wrap">
                  <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted shrink-0">
                    {r.image_url ? (
                      <img src={r.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-xl">
                        🛍️
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="font-semibold line-clamp-2">{r.title_snapshot}</div>
                    <div className="text-xs text-muted-foreground">
                      Заказ №{r.order_id.slice(0, 8).toUpperCase()} · {r.quantity} ×{" "}
                      {formatPrice(r.price_kopecks)}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[st]}`}
                      >
                        {STATUS_LABELS[st]}
                      </span>
                      {r.return_admin_status === "approved" && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                          Одобрено
                        </span>
                      )}
                      {r.return_admin_status === "rejected" && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 text-rose-800">
                          Отклонено
                        </span>
                      )}
                    </div>
                    {r.returned_at && (
                      <div className="text-[11px] text-muted-foreground">
                        Заявка: {fmt(r.returned_at)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-orange-50 border border-orange-100 p-3 text-sm space-y-1.5">
                  {r.return_reason && (
                    <div>
                      <span className="text-orange-900 font-medium">Причина:</span>{" "}
                      <span className="text-orange-900">{r.return_reason}</span>
                    </div>
                  )}
                  {r.return_comment && (
                    <div className="text-orange-800 italic">« {r.return_comment} »</div>
                  )}
                  {r.return_photos && r.return_photos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {r.return_photos.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="h-16 w-16 rounded-lg overflow-hidden border bg-white"
                        >
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {r.return_admin_reason && !isPending && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Ваш ответ: {r.return_admin_reason}
                  </div>
                )}

                {r.orders && (
                  <div className="mt-3 border-t pt-3 text-xs text-muted-foreground space-y-0.5">
                    <div>
                      Покупатель: {r.orders.shipping_name}, {r.orders.shipping_phone}
                    </div>
                    <div>Адрес: {r.orders.shipping_address}</div>
                  </div>
                )}

                {isPending && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setDecision({ item: r, action: "approve" });
                        setComment("");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm font-semibold hover:bg-emerald-700"
                    >
                      <Check className="h-4 w-4" /> Одобрить возврат
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDecision({ item: r, action: "reject" });
                        setComment("");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 text-rose-700 px-3 py-2 text-sm font-semibold hover:bg-rose-50"
                    >
                      <X className="h-4 w-4" /> Отклонить
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {decision && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
          onClick={() => setDecision(null)}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl border shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <div className="font-semibold">
                  {decision.action === "approve"
                    ? "Одобрить возврат"
                    : "Отклонить возврат"}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-1">
                  {decision.item.title_snapshot}
                </div>
              </div>
              <button
                onClick={() => setDecision(null)}
                className="p-1 rounded hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {decision.action === "approve"
                    ? "Комментарий (необязательно)"
                    : "Причина отказа"}
                  {decision.action === "reject" && (
                    <span className="text-rose-600"> *</span>
                  )}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder={
                    decision.action === "approve"
                      ? "Например: возврат согласован, ждём товар"
                      : "Опишите причину отказа — покупатель увидит её"
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-background resize-none"
                />
              </div>
              <button
                type="button"
                disabled={mut.isPending}
                onClick={submitDecision}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white disabled:opacity-60 ${
                  decision.action === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {decision.action === "approve" ? "Одобрить" : "Отклонить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
