// Заказы продавца: WB-подобный процесс — отправка с трек-номером + отмена
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ExternalLink, Truck, XCircle, Loader2, X, PackageCheck, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
import { getSellerOrderItems } from "@/lib/order-history.functions";
import {
  ALL_STATUSES,
  CARRIERS,
  STATUS_BADGE,
  STATUS_LABELS,
  normalizeStatus,
  type OrderStatus,
} from "@/lib/order-status";
import {
  sellerCancelOrderItem,
  sellerMarkDeliveredItem,
  sellerShipOrderItem,
} from "@/lib/order-status.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/seller/orders")({
  head: () => ({ meta: [{ title: "Мои заказы — продавец — BreezeMarket" }] }),
  component: SellerOrdersPage,
});

const fmt = (s: string) =>
  new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

type SellerItem = {
  id: string;
  product_id: string | null;
  title_snapshot: string;
  price_kopecks: number;
  quantity: number;
  commission_kopecks: number;
  status: string | null;
  tracking_number: string | null;
  shipping_carrier: string | null;
  shipped_at: string | null;
  received_at: string | null;
  returned_at: string | null;
  return_reason: string | null;
  return_comment: string | null;
  return_photos: string[] | null;
  orders: {
    id: string;
    created_at: string;
    shipping_name: string | null;
    shipping_phone: string | null;
    shipping_address: string | null;
  } | null;
};

function SellerOrdersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const shipFn = useServerFn(sellerShipOrderItem);
  const cancelFn = useServerFn(sellerCancelOrderItem);
  const deliverFn = useServerFn(sellerMarkDeliveredItem);
  const fetchSellerOrders = useServerFn(getSellerOrderItems);

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [shipItem, setShipItem] = useState<SellerItem | null>(null);

  const q = useQuery({
    queryKey: ["seller-orders", user?.id],
    enabled: !!user,
    queryFn: async () => (await fetchSellerOrders()) as unknown as SellerItem[],
  });

  const cancelMut = useMutation({
    mutationFn: (v: { order_item_id: string; title: string }) =>
      cancelFn({ data: { order_item_id: v.order_item_id } }),
    onSuccess: (_r, v) => {
      toast.success("Позиция отменена", { description: v.title });
      qc.invalidateQueries({ queryKey: ["seller-orders", user?.id] });
      qc.invalidateQueries({ queryKey: ["seller-stats"] });
    },
    onError: (e: Error) => toast.error("Не удалось отменить", { description: e.message }),
  });

  const deliverMut = useMutation({
    mutationFn: (v: { order_item_id: string; title: string }) =>
      deliverFn({ data: { order_item_id: v.order_item_id } }),
    onSuccess: (_r, v) => {
      toast.success("Заказ отмечен как доставленный", { description: v.title });
      qc.invalidateQueries({ queryKey: ["seller-orders", user?.id] });
      qc.invalidateQueries({ queryKey: ["seller-stats"] });
    },
    onError: (e: Error) => toast.error("Не удалось обновить статус", { description: e.message }),
  });

  const all = q.data ?? [];
  const counts: Record<string, number> = { all: all.length };
  for (const it of all) {
    const s = normalizeStatus(it.status);
    counts[s] = (counts[s] ?? 0) + 1;
  }
  const filtered =
    statusFilter === "all"
      ? all
      : all.filter((it) => normalizeStatus(it.status) === statusFilter);

  return (
    <div>
      {all.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatusFilter("all")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition ${
              statusFilter === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-accent"
            }`}
          >
            Все <span className="opacity-70">({counts.all})</span>
          </button>
          {ALL_STATUSES.map((s) => {
            const n = counts[s] ?? 0;
            if (n === 0) return null;
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : `${STATUS_BADGE[s]} border-transparent hover:opacity-90`
                }`}
              >
                {STATUS_LABELS[s]} <span className="opacity-70">({n})</span>
              </button>
            );
          })}
        </div>
      )}

      {q.isLoading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : q.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          Не удалось загрузить заказы продавца.
        </div>
      ) : all.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          Пока нет заказов на ваши товары.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          Нет заказов в выбранном статусе.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((it) => {
            const line = it.price_kopecks * it.quantity;
            const payout = line - it.commission_kopecks;
            const status = normalizeStatus(it.status);
            const canShip = status === "processing";
            const canCancel = status === "processing";
            const canDeliver = status === "shipped";
            return (
              <div key={it.id} className="rounded-2xl border bg-card p-4">
                <div className="flex justify-between items-start gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold">{it.title_snapshot}</div>
                      {it.product_id && (
                        <Link
                          to="/product/$id"
                          params={{ id: it.product_id }}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition"
                        >
                          <ExternalLink className="h-3 w-3" /> К товару
                        </Link>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Заказ №{it.orders?.id.slice(0, 8).toUpperCase()} ·{" "}
                      {it.orders && fmt(it.orders.created_at)}
                    </div>
                    <span
                      className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[status]}`}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Заплатил покупатель</div>
                    <div className="text-lg font-bold">{formatPrice(line)}</div>
                    <div className="text-xs text-muted-foreground">× {it.quantity}</div>
                    <div className="mt-1 text-sm text-emerald-600 font-semibold">
                      К выплате: {formatPrice(payout)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      после комиссии платформы 10%
                    </div>
                  </div>
                </div>

                <div className="mt-3 border-t pt-3 text-sm space-y-1">
                  <div>
                    <span className="text-muted-foreground">Покупатель:</span>{" "}
                    {it.orders?.shipping_name}, {it.orders?.shipping_phone}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Адрес:</span>{" "}
                    {it.orders?.shipping_address}
                  </div>
                </div>

                {/* Инфо об отправке */}
                {(status === "shipped" || status === "received") && it.tracking_number && (
                  <div className="mt-3 rounded-lg bg-indigo-50 border border-indigo-100 p-2.5 text-xs">
                    <div className="flex items-center gap-1.5 text-indigo-900 font-medium">
                      <Truck className="h-3.5 w-3.5" />
                      {it.shipping_carrier ?? "Отправлен"}
                    </div>
                    <div className="mt-1 font-mono text-indigo-800 select-all break-all">
                      {it.tracking_number}
                    </div>
                    {status === "received" && it.received_at && (
                      <div className="mt-1 text-emerald-700">
                        Получено покупателем · {fmt(it.received_at)}
                      </div>
                    )}
                  </div>
                )}

                {/* Заявка на возврат */}
                {status === "returned" && (
                  <div className="mt-3 rounded-lg bg-orange-50 border border-orange-200 p-3 text-xs space-y-1.5">
                    <div className="font-semibold text-orange-900">
                      Покупатель оформил возврат
                    </div>
                    {it.return_reason && (
                      <div className="text-orange-900">
                        <span className="font-medium">Причина:</span> {it.return_reason}
                      </div>
                    )}
                    {it.return_comment && (
                      <div className="text-orange-800">{it.return_comment}</div>
                    )}
                    {it.return_photos && it.return_photos.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {it.return_photos.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="h-16 w-16 rounded-lg overflow-hidden border bg-white"
                          >
                            <img
                              src={url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(canShip || canCancel) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                    {canShip && (
                      <button
                        type="button"
                        onClick={() => setShipItem(it)}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                      >
                        <Truck className="h-4 w-4" /> Отправить
                      </button>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        disabled={cancelMut.isPending}
                        onClick={() => {
                          if (confirm("Отменить эту позицию заказа?")) {
                            cancelMut.mutate({
                              order_item_id: it.id,
                              title: it.title_snapshot,
                            });
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" /> Отменить
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {shipItem && (
        <ShipDialog
          item={shipItem}
          onClose={() => setShipItem(null)}
          onSuccess={() => {
            setShipItem(null);
            qc.invalidateQueries({ queryKey: ["seller-orders", user?.id] });
            qc.invalidateQueries({ queryKey: ["seller-stats"] });
          }}
          shipFn={shipFn}
        />
      )}
    </div>
  );
}

// ————— Диалог «Отправить» —————

type ShipDialogProps = {
  item: SellerItem;
  onClose: () => void;
  onSuccess: () => void;
  shipFn: (args: {
    data: { order_item_id: string; tracking_number: string; shipping_carrier: string };
  }) => Promise<unknown>;
};

function ShipDialog({ item, onClose, onSuccess, shipFn }: ShipDialogProps) {
  const [carrier, setCarrier] = useState<string>(CARRIERS[0]);
  const [track, setTrack] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const trimmed = track.trim();
    if (trimmed.length < 3) {
      toast.error("Введите трек-номер");
      return;
    }
    setSubmitting(true);
    try {
      await shipFn({
        data: {
          order_item_id: item.id,
          tracking_number: trimmed,
          shipping_carrier: carrier,
        },
      });
      toast.success("Заказ отправлен", { description: `${carrier} · ${trimmed}` });
      onSuccess();
    } catch (err) {
      toast.error("Не удалось отправить", { description: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl border shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <div className="font-semibold">Отправить заказ</div>
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
            <label className="text-sm font-medium mb-1.5 block">Служба доставки</label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-background"
            >
              {CARRIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Трек-номер</label>
            <input
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              maxLength={80}
              placeholder="Например, 1234567890"
              className="w-full rounded-lg border px-3 py-2 text-sm bg-background font-mono"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Покупатель увидит его в своём заказе.
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-3 font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Отправить и уведомить покупателя
          </button>
        </div>
      </div>
    </div>
  );
}
