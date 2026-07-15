// Личный кабинет покупателя: список заказов, детали, подтверждение/возврат в стиле WB
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
import { getBuyerOrders } from "@/lib/order-history.functions";
import { getOrCreateOrderChat } from "@/lib/chat.functions";
import {
  buyerConfirmReceivedItem,
  buyerReturnOrderItem,
} from "@/lib/order-status.functions";
import {
  STATUS_BADGE,
  STATUS_LABELS,
  RETURN_REASONS,
  normalizeStatus,
  type OrderStatus,
} from "@/lib/order-status";
import {
  LogOut,
  Store,
  X,
  ShoppingBag,
  MessageCircle,
  Truck,
  Undo2,
  Upload,
  Loader2,
  Star,
  CheckCircle2,
  Clock,
  PackageCheck,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Мои заказы — BreezeMarket" }] }),
  component: AccountPage,
});

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

type OrderItem = {
  id: string;
  product_id: string | null;
  seller_id: string;
  title_snapshot: string;
  image_url: string | null;
  price_kopecks: number;
  quantity: number;
  commission_kopecks: number | null;
  status: string | null;
  tracking_number: string | null;
  shipping_carrier: string | null;
  shipped_at: string | null;
  received_at: string | null;
  returned_at: string | null;
  return_reason: string | null;
  return_comment: string | null;
  return_photos: string[] | null;
};

type Order = {
  id: string;
  buyer_id: string;
  total_kopecks: number;
  commission_kopecks: number | null;
  status: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  created_at: string;
  order_items: OrderItem[];
};

// Агрегированный статус заказа: показываем «минимальную» стадию — WB-подобно
const STAGE_ORDER: OrderStatus[] = [
  "processing",
  "shipped",
  "delivered",
  "received",
  "returned",
  "cancelled",
];
function aggregateStatus(items: OrderItem[]): OrderStatus {
  if (!items.length) return "processing";
  const nonCancelled = items.filter((it) => normalizeStatus(it.status) !== "cancelled");
  if (!nonCancelled.length) return "cancelled";
  let minIdx = STAGE_ORDER.length;
  for (const it of nonCancelled) {
    const st = normalizeStatus(it.status);
    const idx = STAGE_ORDER.indexOf(st);
    if (idx >= 0 && idx < minIdx) minIdx = idx;
  }
  return STAGE_ORDER[minIdx] ?? "processing";
}

function AccountPage() {
  const { user, isSeller } = useAuth();
  const qc = useQueryClient();
  const fetchBuyerOrders = useServerFn(getBuyerOrders);
  const openOrderChat = useServerFn(getOrCreateOrderChat);
  const returnItemFn = useServerFn(buyerReturnOrderItem);
  const confirmReceivedFn = useServerFn(buyerConfirmReceivedItem);
  const navigate = useNavigate();

  const [openId, setOpenId] = useState<string | null>(null);
  const [returnItem, setReturnItem] = useState<OrderItem | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const confirmReceived = async (itemId: string) => {
    setConfirmingId(itemId);
    try {
      await confirmReceivedFn({ data: { order_item_id: itemId } });
      toast.success("Спасибо! Получение подтверждено", {
        description: "Продавец получит выплату за этот товар.",
      });
      qc.invalidateQueries({ queryKey: ["my-orders", user?.id] });
    } catch (err) {
      toast.error("Не удалось подтвердить", { description: (err as Error).message });
    } finally {
      setConfirmingId(null);
    }
  };

  const writeSeller = async (item: OrderItem) => {
    try {
      const res = await openOrderChat({ data: { order_item_id: item.id } });
      navigate({ to: "/messages/$chatId", params: { chatId: res.id } });
    } catch (err) {
      toast.error("Не удалось открыть чат", { description: (err as Error).message });
    }
  };

  const ordersQuery = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const data = await fetchBuyerOrders();
      return (data ?? []) as unknown as Order[];
    },
  });

  const orders = ordersQuery.data ?? [];
  const openOrder = useMemo(
    () => orders.find((o) => o.id === openId) ?? null,
    [orders, openId],
  );

  // Уведомления при смене статусов позиций (продавец → отправил, и т.д.)
  const prevStatusesRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!orders.length) return;
    const next: Record<string, string> = {};
    for (const o of orders) {
      for (const it of o.order_items ?? []) {
        const prev = prevStatusesRef.current[it.id];
        const cur = normalizeStatus(it.status);
        if (prev && prev !== cur) {
          if (cur === "shipped") {
            toast.success(`Заказ отправлен: «${it.title_snapshot}»`, {
              description: it.tracking_number
                ? `${it.shipping_carrier ?? ""} · ${it.tracking_number}`
                : undefined,
            });
          } else if (cur === "delivered") {
            toast.success(`Заказ доставлен: «${it.title_snapshot}»`, {
              description: "Теперь вы можете оставить отзыв о товаре",
            });
          } else {
            toast.info(`«${it.title_snapshot}» — ${STATUS_LABELS[cur]}`);
          }
        }
        next[it.id] = cur;
      }
    }
    prevStatusesRef.current = next;
  }, [orders]);

  // Realtime: обновляем список при изменениях позиций
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`buyer-orders-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "order_items" },
        () => {
          qc.invalidateQueries({ queryKey: ["my-orders", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Вы вышли из аккаунта");
    window.location.href = "/";
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Личный кабинет</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/favorites"
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
            >
              <Heart className="h-4 w-4 text-brand" /> Избранное
            </Link>
            {isSeller && (
              <Link
                to="/seller/products"
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
              >
                <Store className="h-4 w-4" /> Кабинет продавца
              </Link>
            )}
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
            >
              <LogOut className="h-4 w-4" /> Выйти
            </button>
          </div>
        </div>


        {/* Обзорные карточки покупателя */}
        {(() => {
          const allItems = orders.flatMap((o) => o.order_items ?? []);
          const active = orders.filter((o) => {
            const s = aggregateStatus(o.order_items ?? []);
            return s === "processing" || s === "shipped";
          }).length;
          const toConfirm = allItems.filter(
            (it) => normalizeStatus(it.status) === "delivered",
          );
          const completed = allItems.filter(
            (it) => normalizeStatus(it.status) === "received",
          ).length;
          const overview = [
            {
              label: "Активные заказы",
              value: active,
              hint: "в пути или на сборке",
              icon: Truck,
              accent: "from-sky-500/15 to-sky-500/5 text-sky-700",
            },
            {
              label: "Ждут подтверждения",
              value: toConfirm.length,
              hint: "получили — нажмите «Подтвердить»",
              icon: PackageCheck,
              accent: "from-amber-500/15 to-amber-500/5 text-amber-700",
            },
            {
              label: "Получено",
              value: completed,
              hint: "успешно завершено",
              icon: CheckCircle2,
              accent: "from-emerald-500/15 to-emerald-500/5 text-emerald-700",
            },
          ];
          return (
            <>
              {orders.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                  {overview.map((c) => {
                    const Icon = c.icon;
                    return (
                      <div
                        key={c.label}
                        className={`rounded-2xl border bg-gradient-to-br ${c.accent} p-3 sm:p-4`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[11px] sm:text-xs font-medium text-muted-foreground">
                              {c.label}
                            </div>
                            <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-foreground">
                              {c.value}
                            </div>
                            <div className="hidden sm:block text-xs text-muted-foreground mt-1">
                              {c.hint}
                            </div>
                          </div>
                          <div className="rounded-xl bg-white/70 p-1.5 sm:p-2 shrink-0">
                            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {toConfirm.length > 0 && (
                <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-700 shrink-0">
                    <PackageCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-amber-900">
                      {toConfirm.length}{" "}
                      {toConfirm.length === 1 ? "товар доставлен" : "товаров доставлено"}
                    </div>
                    <div className="text-sm text-amber-800 mt-0.5">
                      Подтвердите получение, чтобы продавец получил выплату и вы могли оставить отзыв.
                    </div>
                    <div className="mt-3 space-y-2">
                      {toConfirm.slice(0, 3).map((it) => (
                        <div
                          key={it.id}
                          className="flex flex-col gap-2 rounded-xl bg-white/80 p-2.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 text-sm font-medium text-foreground line-clamp-1">
                            {it.title_snapshot}
                          </div>
                          <button
                            type="button"
                            disabled={confirmingId === it.id}
                            onClick={() => confirmReceived(it.id)}
                            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {confirmingId === it.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Подтвердить получение
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        <h2 className="text-xl font-bold mb-3">История заказов</h2>

        {ordersQuery.isLoading ? (
          <div className="text-muted-foreground">Загрузка...</div>
        ) : ordersQuery.isError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            Не удалось загрузить заказы. Обновите страницу или попробуйте ещё раз.
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center">
            <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">У вас пока нет заказов.</p>
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90"
            >
              Перейти в каталог
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const status = aggregateStatus(o.order_items ?? []);
              const items = o.order_items ?? [];
              const itemsCount = items.reduce((a, it) => a + it.quantity, 0);
              const preview = items
                .slice(0, 2)
                .map((it) => `${it.title_snapshot} × ${it.quantity}`)
                .join(", ");
              const more = items.length > 2 ? `, ещё ${items.length - 2}` : "";
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOpenId(o.id)}
                  className="w-full text-left rounded-2xl border bg-card p-4 hover:shadow-md hover:border-primary/40 transition"
                >
                  <div className="flex justify-between items-start gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-mono text-sm">
                        №{o.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDate(o.created_at)}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[status]}`}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-between items-end gap-3">
                    <div className="text-sm text-muted-foreground line-clamp-2 min-w-0">
                      {itemsCount} {itemsCount === 1 ? "товар" : "товаров"}:{" "}
                      <span className="text-foreground">
                        {preview}
                        {more}
                      </span>
                    </div>
                    <div className="text-lg font-bold shrink-0">
                      {formatPrice(o.total_kopecks)}
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-primary font-medium">
                    Подробнее →
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Модалка деталей заказа */}
      {openOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={() => setOpenId(null)}
        >
          <div
            className="w-full max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border shadow-lg max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card z-10">
              <div>
                <div className="font-semibold">
                  Заказ №{openOrder.id.slice(0, 8).toUpperCase()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmtDate(openOrder.created_at)}
                </div>
              </div>
              <button
                onClick={() => setOpenId(null)}
                className="p-1 rounded hover:bg-accent"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Статус заказа</div>
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-sm font-medium ${STATUS_BADGE[aggregateStatus(openOrder.order_items ?? [])]}`}
                >
                  {STATUS_LABELS[aggregateStatus(openOrder.order_items ?? [])]}
                </span>
              </div>

              {(openOrder.shipping_name ||
                openOrder.shipping_phone ||
                openOrder.shipping_address) && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Доставка</div>
                  <div className="text-sm space-y-0.5">
                    {openOrder.shipping_name && (
                      <div className="font-medium">{openOrder.shipping_name}</div>
                    )}
                    {openOrder.shipping_phone && (
                      <div className="text-muted-foreground">
                        {openOrder.shipping_phone}
                      </div>
                    )}
                    {openOrder.shipping_address && (
                      <div className="text-muted-foreground">
                        {openOrder.shipping_address}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-muted-foreground mb-2">
                  Товары в заказе ({openOrder.order_items?.length ?? 0})
                </div>
                <div className="space-y-2">
                  {openOrder.order_items?.map((it) => {
                    const st = normalizeStatus(it.status);
                    const canReturn = st === "shipped" || st === "delivered";
                    const canConfirm = st === "delivered";
                    const canReview = (st === "delivered" || st === "received") && !!it.product_id;
                    return (
                      <div
                        key={it.id}
                        className="rounded-xl border p-3 space-y-3"
                      >
                        <div className="flex gap-3">
                          <div className="h-14 w-14 rounded-lg bg-muted overflow-hidden shrink-0">
                            {it.image_url ? (
                              <img
                                src={it.image_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-lg">
                                🛍️
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm line-clamp-2">
                              {it.title_snapshot}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatPrice(it.price_kopecks)} × {it.quantity}
                            </div>
                            <span
                              className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[st]}`}
                            >
                              {STATUS_LABELS[st]}
                            </span>
                          </div>
                          <div className="text-sm font-semibold shrink-0">
                            {formatPrice(it.price_kopecks * it.quantity)}
                          </div>
                        </div>

                        {/* Информация об отправке */}
                        {(st === "shipped" || st === "delivered" || st === "received") && it.tracking_number && (
                          <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-2.5 text-xs">
                            <div className="flex items-center gap-1.5 text-indigo-900 font-medium">
                              <Truck className="h-3.5 w-3.5" />
                              {it.shipping_carrier ?? "Отправлен"}
                            </div>
                            <div className="mt-1 font-mono text-indigo-800 select-all break-all">
                              {it.tracking_number}
                            </div>
                            {st === "delivered" && (
                              <div className="mt-1 text-sky-700">Заказ доставлен</div>
                            )}
                          </div>
                        )}

                        {/* Информация о возврате */}
                        {st === "returned" && (
                          <div className="rounded-lg bg-orange-50 border border-orange-100 p-2.5 text-xs space-y-1">
                            <div className="font-medium text-orange-900">
                              Оформлен возврат
                            </div>
                            {it.return_reason && (
                              <div className="text-orange-800">
                                Причина: {it.return_reason}
                              </div>
                            )}
                            {it.return_comment && (
                              <div className="text-orange-700">
                                {it.return_comment}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Действия */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => writeSeller(it)}
                            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
                          >
                            <MessageCircle className="h-3 w-3" /> Написать продавцу
                          </button>
                          {canConfirm && (
                            <button
                              type="button"
                              disabled={confirmingId === it.id}
                              onClick={() => confirmReceived(it.id)}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white px-3 py-1 text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {confirmingId === it.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              Подтвердить получение
                            </button>
                          )}
                          {canReturn && (
                            <button
                              type="button"
                              onClick={() => setReturnItem(it)}
                              className="inline-flex items-center gap-1 rounded-full border border-orange-300 text-orange-700 px-3 py-1 text-[11px] font-semibold hover:bg-orange-50"
                            >
                              <Undo2 className="h-3 w-3" /> Оформить возврат
                            </button>
                          )}
                          {canReview && (
                            <Link
                              to="/product/$id"
                              params={{ id: it.product_id! }}
                              hash="reviews"
                              className="inline-flex items-center gap-1 rounded-full border border-amber-300 text-amber-700 px-3 py-1 text-[11px] font-semibold hover:bg-amber-50"
                            >
                              <Star className="h-3 w-3" /> Оставить отзыв
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 p-3 text-sm">
                <div className="flex justify-between font-bold text-base">
                  <span>Итого оплачено</span>
                  <span>{formatPrice(openOrder.total_kopecks)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка формы возврата */}
      {returnItem && (
        <ReturnDialog
          item={returnItem}
          onClose={() => setReturnItem(null)}
          onSuccess={() => {
            setReturnItem(null);
            qc.invalidateQueries({ queryKey: ["my-orders", user?.id] });
          }}
          returnItemFn={returnItemFn}
        />
      )}
    </AppLayout>
  );
}

// ————— Форма возврата —————

type ReturnDialogProps = {
  item: OrderItem;
  onClose: () => void;
  onSuccess: () => void;
  returnItemFn: (args: {
    data: { order_item_id: string; reason: string; comment?: string; photos?: string[] };
  }) => Promise<unknown>;
};

function ReturnDialog({ item, onClose, onSuccess, returnItemFn }: ReturnDialogProps) {
  const [reason, setReason] = useState<string>(RETURN_REASONS[0]);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const uploadPhotos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const slots = 5 - photos.length;
    if (slots <= 0) return;
    const list = Array.from(files).slice(0, slots);
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of list) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${item.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("return-photos")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) {
          toast.error("Не удалось загрузить фото", { description: error.message });
          continue;
        }
        const signed = await supabase.storage
          .from("return-photos")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signed.data?.signedUrl) uploaded.push(signed.data.signedUrl);
      }
      if (uploaded.length) setPhotos((p) => [...p, ...uploaded]);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await returnItemFn({
        data: {
          order_item_id: item.id,
          reason,
          comment: comment.trim() || undefined,
          photos: photos.length ? photos : undefined,
        },
      });
      toast.success("Заявка на возврат отправлена");
      onSuccess();
    } catch (err) {
      toast.error("Не удалось оформить возврат", {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl border shadow-lg max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <div className="font-semibold">Оформить возврат</div>
            <div className="text-xs text-muted-foreground line-clamp-1">
              {item.title_snapshot}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Причина возврата</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-background"
            >
              {RETURN_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Комментарий</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Опишите подробнее (необязательно)"
              className="w-full rounded-lg border px-3 py-2 text-sm bg-background resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Фото ({photos.length}/5)
            </label>
            <div className="flex flex-wrap gap-2">
              {photos.map((url, i) => (
                <div
                  key={i}
                  className="relative h-16 w-16 rounded-lg overflow-hidden border"
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      setPhotos((p) => p.filter((_, idx) => idx !== i))
                    }
                    className="absolute top-0.5 right-0.5 rounded-full bg-black/60 text-white p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < 5 && (
                <label className="h-16 w-16 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-accent">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => uploadPhotos(e.target.files)}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-3 font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Отправить заявку на возврат
          </button>
        </div>
      </div>
    </div>
  );
}
