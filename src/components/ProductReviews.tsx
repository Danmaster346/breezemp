// Секция отзывов на странице товара: список, средний рейтинг, форма
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getProductReviews,
  getReviewableForProduct,
  createReview,
  reportReview,
} from "@/lib/reviews.functions";
import { useAuth } from "@/lib/use-auth";
import { Star, Camera, X, Loader2, Plus, Flag } from "lucide-react";
import { toast } from "sonner";

const SIGNED_URL_TTL = 60 * 60 * 24 * 365;

// Форматирование даты
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

// Инициалы для аватара
const initials = (name: string | null) =>
  (name ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

// Компонент выбора/показа звёзд
function Stars({
  value,
  onChange,
  size = 20,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const readOnly = !onChange;
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hover ?? value) >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onMouseEnter={() => !readOnly && setHover(n)}
            onMouseLeave={() => !readOnly && setHover(null)}
            onClick={() => onChange?.(n)}
            className={`p-0.5 ${readOnly ? "cursor-default" : "cursor-pointer"} transition`}
            aria-label={`${n} из 5`}
          >
            <Star
              style={{ width: size, height: size }}
              className={
                active ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
              }
            />
          </button>
        );
      })}
    </div>
  );
}

// Лайтбокс для фото
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/10 hover:bg-white/20 p-2 text-white"
        aria-label="Закрыть"
      >
        <X className="h-6 w-6" />
      </button>
      <img
        src={src}
        alt=""
        className="max-h-full max-w-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// Форма отзыва (модалка)
function ReviewFormModal({
  productId,
  orderItemId,
  onClose,
  onDone,
}: {
  productId: string;
  orderItemId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const submit = useServerFn(createReview);

  const mutation = useMutation({
    mutationFn: async () => {
      if (rating < 1) throw new Error("Поставьте оценку от 1 до 5 звёзд");
      return await submit({
        data: {
          product_id: productId,
          order_item_id: orderItemId,
          rating,
          comment: comment.trim() || null,
          photos,
        },
      });
    },
    onSuccess: () => {
      toast.success("Спасибо за отзыв!");
      onDone();
      onClose();
    },
    onError: (e: Error) => {
      const m = e.message.match(/^\[([A-Z_]+)\]\s*(.*)$/);
      const code = m?.[1];
      const msg = m?.[2] || e.message;
      const map: Record<string, { title: string; description: string }> = {
        TOO_EARLY: {
          title: "Отзыв пока недоступен",
          description: "Оставить отзыв можно после того, как товар будет доставлен и получение подтверждено.",
        },
        NOT_PURCHASED: {
          title: "Отзыв недоступен",
          description: "Оценивать можно только товары, которые вы купили в этом магазине.",
        },
        SELF_REVIEW: {
          title: "Нельзя оценивать свой товар",
          description: "Продавец не может оставлять отзывы на собственные товары.",
        },
        DUPLICATE: {
          title: "Отзыв уже оставлен",
          description: "На эту покупку уже есть ваш отзыв — его можно только отредактировать.",
        },
        RATE_HOUR: {
          title: "Слишком часто",
          description: "Не более 5 отзывов в час. Попробуйте через несколько минут.",
        },
        RATE_DAY: {
          title: "Дневной лимит достигнут",
          description: "Вы уже оставили 20 отзывов за сутки. Возвращайтесь завтра.",
        },
      };
      const info = code && map[code];
      if (info) {
        toast.error(info.title, { description: info.description });
      } else {
        toast.error(msg);
      }
    },
  });

  const onFiles = async (files: FileList | null) => {
    if (!files || !user) return;
    const slots = 5 - photos.length;
    const list = Array.from(files).slice(0, slots);
    if (!list.length) return;
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of list) {
        if (!file.type.startsWith("image/")) {
          toast.error(`«${file.name}» — не изображение`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`«${file.name}» больше 5 МБ`);
          continue;
        }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage
          .from("review-photos")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });
        if (up.error) {
          toast.error(up.error.message);
          continue;
        }
        const signed = await supabase.storage
          .from("review-photos")
          .createSignedUrl(path, SIGNED_URL_TTL);
        if (signed.error || !signed.data) {
          toast.error(signed.error?.message || "Не удалось получить ссылку");
          continue;
        }
        uploaded.push(signed.data.signedUrl);
      }
      if (uploaded.length) setPhotos((p) => [...p, ...uploaded]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border shadow-lg max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card z-10">
          <div className="font-semibold">Оставить отзыв</div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent" aria-label="Закрыть">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="text-sm font-medium mb-1.5">Ваша оценка</div>
            <Stars value={rating} onChange={setRating} size={32} />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Комментарий (необязательно)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Расскажите о своём опыте — что понравилось, что нет"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="text-xs text-muted-foreground mt-1">{comment.length}/2000</div>
          </div>

          <div>
            <div className="text-sm font-medium mb-1.5">Фото (до 5)</div>
            <div className="flex flex-wrap gap-2">
              {photos.map((url, i) => (
                <div key={url} className="relative h-20 w-20 rounded-lg overflow-hidden border">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 rounded-full bg-black/60 text-white p-0.5 hover:bg-black/80"
                    aria-label="Удалить фото"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < 5 && (
                <label className="h-20 w-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground cursor-pointer hover:bg-accent transition">
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      <span>Фото</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      onFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={mutation.isPending || rating < 1}
            onClick={() => mutation.mutate()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Опубликовать отзыв
          </button>
        </div>
      </div>
    </div>
  );
}

// Модалка «Пожаловаться на отзыв»
const REPORT_REASONS: Array<{ value: "spam" | "offensive" | "fake" | "off_topic" | "personal_info" | "other"; label: string }> = [
  { value: "spam", label: "Спам или реклама" },
  { value: "offensive", label: "Оскорбления или нецензурная лексика" },
  { value: "fake", label: "Фейковый отзыв" },
  { value: "off_topic", label: "Не по теме товара" },
  { value: "personal_info", label: "Персональные данные" },
  { value: "other", label: "Другое" },
];

function ReportReviewModal({ reviewId, onClose }: { reviewId: string; onClose: () => void }) {
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]["value"]>("spam");
  const [comment, setComment] = useState("");
  const submit = useServerFn(reportReview);

  const mutation = useMutation({
    mutationFn: async () =>
      await submit({ data: { review_id: reviewId, reason, comment: comment.trim() || null } }),
    onSuccess: () => {
      toast.success("Жалоба отправлена", {
        description: "Модераторы рассмотрят отзыв в ближайшее время.",
      });
      onClose();
    },
    onError: (e: Error) => {
      const m = e.message.match(/^\[([A-Z_]+)\]\s*(.*)$/);
      const code = m?.[1];
      const msg = m?.[2] || e.message;
      const map: Record<string, { title: string; description: string }> = {
        DUPLICATE: {
          title: "Жалоба уже отправлена",
          description: "Вы уже жаловались на этот отзыв — модераторы её рассмотрят.",
        },
        SELF_REPORT: {
          title: "Нельзя жаловаться на свой отзыв",
          description: "Если хотите удалить свой отзыв — сделайте это в личном кабинете.",
        },
        RATE_HOUR: {
          title: "Слишком часто",
          description: "Вы отправили много жалоб за последний час. Попробуйте позже.",
        },
        NOT_FOUND: { title: "Отзыв не найден", description: "Возможно, он был удалён." },
      };
      const info = code && map[code];
      if (info) toast.error(info.title, { description: info.description });
      else toast.error(msg);
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl border shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="font-semibold">Пожаловаться на отзыв</div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent" aria-label="Закрыть">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-sm text-muted-foreground">
            Расскажите, что не так с этим отзывом. Модераторы рассмотрят жалобу.
          </div>
          <div className="grid gap-2">
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition ${
                  reason === r.value ? "border-brand bg-brand/5" : "hover:bg-accent"
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="accent-brand"
                />
                {r.label}
              </label>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Комментарий (необязательно)"
            maxLength={500}
            rows={3}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-destructive px-6 py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Отправить жалобу
          </button>
        </div>
      </div>
    </div>
  );
}
export function ProductReviews({ productId }: { productId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchReviews = useServerFn(getProductReviews);
  const fetchReviewable = useServerFn(getReviewableForProduct);
  const [showForm, setShowForm] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<string | null>(null);

  const reviewsQuery = useQuery({
    queryKey: ["product-reviews", productId],
    queryFn: () => fetchReviews({ data: { product_id: productId } }),
  });

  const canReviewQuery = useQuery({
    queryKey: ["can-review", productId, user?.id],
    enabled: !!user,
    queryFn: () => fetchReviewable({ data: { product_id: productId } }),
  });

  const reviews = reviewsQuery.data?.reviews ?? [];
  const count = reviewsQuery.data?.count ?? 0;
  const avg = reviewsQuery.data?.avg ?? 0;

  const distribution = useMemo(() => {
    const d = [0, 0, 0, 0, 0];
    for (const r of reviews) d[r.rating - 1]++;
    return d;
  }, [reviews]);

  const reviewableData = canReviewQuery.data;
  const canReview = !!reviewableData && reviewableData.canReview === true;
  const orderItemId = canReview && reviewableData.canReview ? reviewableData.order_item_id : null;
  const cannotReason =
    reviewableData && reviewableData.canReview === false ? reviewableData.reason : null;

  const reasonHint: Record<NonNullable<typeof cannotReason>, string> = {
    not_purchased: "Отзыв можно оставить только на купленный товар.",
    not_delivered: "Оставить отзыв можно после того, как заказ будет доставлен.",
    already_reviewed: "Вы уже оставили отзыв на этот товар.",
    self: "Продавец не может оставлять отзывы на свои товары.",
  };

  return (
    <section className="mt-10 md:mt-14">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">Отзывы</h2>
          {count > 0 ? (
            <div className="mt-1 flex items-center gap-2 text-sm">
              <Stars value={Math.round(avg)} size={16} />
              <span className="font-semibold">{avg.toFixed(1)}</span>
              <span className="text-muted-foreground">
                · {count} {count === 1 ? "отзыв" : count < 5 ? "отзыва" : "отзывов"}
              </span>
            </div>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">Пока нет отзывов</div>
          )}
        </div>
        {canReview && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 transition shadow-sm"
          >
            <Star className="h-4 w-4" />
            Написать отзыв
          </button>
        )}
      </div>

      {count > 0 && (
        <div className="grid gap-1.5 max-w-sm mb-6">
          {[5, 4, 3, 2, 1].map((star) => {
            const n = distribution[star - 1];
            const pct = count ? (n / count) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-muted-foreground">{star}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-6 text-right text-muted-foreground">{n}</span>
              </div>
            );
          })}
        </div>
      )}

      {reviewsQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Загрузка отзывов...</div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {canReview
            ? "Будьте первым, кто оставит отзыв на этот товар!"
            : "Отзывов пока нет. Отзыв можно оставить после получения товара."}
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <article
              key={r.id}
              className="rounded-2xl border bg-card p-4 md:p-5 animate-fade-in"
            >
              <header className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-brand/10 text-brand flex items-center justify-center text-sm font-semibold">
                    {initials(r.author_name)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">
                      {r.author_name ?? "Покупатель"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(r.created_at)}
                    </div>
                  </div>
                </div>
                <Stars value={r.rating} size={16} />
              </header>

              {r.comment && (
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">
                  {r.comment}
                </p>
              )}

              {r.photos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.photos.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setLightbox(url)}
                      className="h-20 w-20 rounded-lg overflow-hidden border hover:opacity-80 transition"
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {user && user.id !== r.user_id && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setReportFor(r.id)}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition"
                    aria-label="Пожаловаться на отзыв"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    Пожаловаться
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {reportFor && (
        <ReportReviewModal
          reviewId={reportFor}
          onClose={() => setReportFor(null)}
        />
      )}

      {showForm && orderItemId && (
        <ReviewFormModal
          productId={productId}
          orderItemId={orderItemId}
          onClose={() => setShowForm(false)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["product-reviews", productId] });
            qc.invalidateQueries({ queryKey: ["can-review", productId] });
          }}
        />
      )}

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </section>
  );
}

// Экспортируем маленькую иконку рейтинга для карточек товара
export function RatingBadge({ avg, count }: { avg: number; count: number }) {
  if (!count) return null;
  return (
    <div className="inline-flex items-center gap-1 text-xs">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <span className="font-semibold">{avg.toFixed(1)}</span>
      <span className="text-muted-foreground">({count})</span>
    </div>
  );
}
