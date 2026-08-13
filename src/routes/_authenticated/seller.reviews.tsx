// Отзывы на товары продавца: фильтры и ответы продавца.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Star, Loader2, MessageSquare, Reply } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import { getSellerReviews, replyToReview } from "@/lib/seller/reviews.functions";

export const Route = createFileRoute("/_authenticated/seller/reviews")({
  head: () => ({
    meta: [
      { title: "Отзывы на мои товары — Kupiks" },
      {
        name: "description",
        content: "Отзывы покупателей на товары магазина: фильтры и ответы продавца.",
      },
    ],
  }),
  component: SellerReviewsPage,
});

type Filter = "all" | "positive" | "negative" | "unanswered";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "positive", label: "Положительные" },
  { key: "negative", label: "Отрицательные" },
  { key: "unanswered", label: "Без ответа" },
];

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
        />
      ))}
    </span>
  );
}

function SellerReviewsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchReviews = useServerFn(getSellerReviews);
  const sendReply = useServerFn(replyToReview);
  const [filter, setFilter] = useState<Filter>("all");
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const reviewsQuery = useQuery({
    queryKey: ["seller-reviews", user?.id],
    enabled: !!user,
    queryFn: () => fetchReviews(),
  });

  const all = reviewsQuery.data ?? [];
  const list = useMemo(
    () =>
      all.filter((r) => {
        if (filter === "positive") return r.rating >= 4;
        if (filter === "negative") return r.rating <= 3;
        if (filter === "unanswered") return !r.seller_reply;
        return true;
      }),
    [all, filter],
  );

  const avg = all.length ? all.reduce((s, r) => s + r.rating, 0) / all.length : 0;
  const unanswered = all.filter((r) => !r.seller_reply).length;

  const submit = async (id: string) => {
    const reply = text.trim();
    if (reply.length < 2) return toast.error("Введите текст ответа");
    setBusy(true);
    try {
      await sendReply({ data: { review_id: id, reply } });
      toast.success("Ответ опубликован");
      setOpenFor(null);
      setText("");
      void qc.invalidateQueries({ queryKey: ["seller-reviews", user?.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось отправить ответ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-xl font-extrabold tracking-tight">Отзывы</h2>
        {all.length > 0 && (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-sm">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <b>{avg.toFixed(1)}</b>
              <span className="text-muted-foreground">· {all.length}</span>
            </span>
            {unanswered > 0 && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                Без ответа: {unanswered}
              </span>
            )}
          </>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`h-9 rounded-full px-3.5 text-sm font-semibold ui-transition ${
              filter === f.key
                ? "bg-brand text-brand-foreground"
                : "bg-surface text-foreground/80 hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {reviewsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-surface animate-pulse" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          <MessageSquare className="mx-auto mb-3 h-8 w-8 opacity-50" />
          {all.length === 0 ? "На ваши товары пока нет отзывов." : "Под этот фильтр отзывов нет."}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <article key={r.id} className="rounded-2xl bg-card hairline p-4">
              <div className="flex items-start gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface">
                  {r.product_image ? (
                    <img src={r.product_image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xl">🛍️</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/product/$id"
                    params={{ id: r.product_id }}
                    className="text-sm font-semibold hover:text-brand ui-transition line-clamp-1"
                  >
                    {r.product_title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} />
                    <span className="text-xs text-muted-foreground">
                      {r.author_name ?? "Покупатель"} · {fmtDate(r.created_at)}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{r.comment}</p>
                  )}
                  {r.photos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.photos.map((url) => (
                        <img
                          key={url}
                          src={url}
                          alt=""
                          className="h-16 w-16 rounded-lg border object-cover"
                        />
                      ))}
                    </div>
                  )}

                  {r.seller_reply ? (
                    <div className="mt-3 rounded-xl border-l-2 border-brand bg-surface p-3">
                      <div className="text-xs font-semibold text-brand">Ваш ответ</div>
                      <p className="mt-1 whitespace-pre-line text-sm">{r.seller_reply}</p>
                    </div>
                  ) : openFor === r.id ? (
                    <div className="mt-3">
                      <textarea
                        rows={3}
                        maxLength={1000}
                        autoFocus
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Ваш ответ покупателю…"
                        className="w-full rounded-xl border bg-background p-3 text-sm"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => submit(r.id)}
                          className="inline-flex items-center gap-2 h-10 rounded-full bg-brand px-4 text-sm font-semibold text-brand-foreground disabled:opacity-60"
                        >
                          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Отправить
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenFor(null);
                            setText("");
                          }}
                          className="h-10 rounded-full border px-4 text-sm font-medium hover:bg-accent"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenFor(r.id);
                        setText("");
                      }}
                      className="mt-3 inline-flex items-center gap-2 h-9 rounded-full border px-3.5 text-sm font-semibold hover:bg-accent ui-transition"
                    >
                      <Reply className="h-4 w-4" /> Ответить
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
