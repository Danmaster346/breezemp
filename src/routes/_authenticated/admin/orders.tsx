// Заказы
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listAdminOrders, getAdminOrder, forceOrderStatus } from "@/lib/admin/orders.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: OrdersPage,
});

const STATUSES = ["processing", "shipped", "received", "return_requested", "returned", "cancelled"];

function OrdersPage() {
  const list = useServerFn(listAdminOrders);
  const detail = useServerFn(getAdminOrder);
  const force = useServerFn(forceOrderStatus);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", q, status, page],
    queryFn: () => list({ data: { q, status, page, pageSize: 30 } }),
  });

  const detailQ = useQuery({
    queryKey: ["admin-order", selectedId],
    queryFn: () => detail({ data: { id: selectedId! } }),
    enabled: !!selectedId,
  });

  const forceM = useMutation({
    mutationFn: force,
    onSuccess: () => {
      toast.success("Статус изменён");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-order"] });
      setNewStatus("");
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data?.rows ?? []) as Array<{
    id: string; status: string; total_kopecks: number; commission_kopecks: number;
    shipping_name: string | null; created_at: string;
    order_items: Array<{ id: string; title_snapshot: string; price_kopecks: number; quantity: number }>;
  }>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Заказы</h1>
        <p className="text-foreground/60 text-sm mt-1">Всего: {data?.total ?? 0}</p>
      </div>

      <div className="rounded-2xl bg-white border border-border/60 p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="ID заказа" className="pl-9" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-border px-3 h-10 text-sm bg-white">
          <option value="all">Все статусы</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="rounded-2xl bg-white border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-foreground/60">Загрузка...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-foreground/60">Ничего не найдено</div>
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map((o) => (
              <div key={o.id} className="p-3 md:p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm">{o.id.slice(0, 8)}</span>
                    <Badge variant="secondary" className="text-[10px]">{o.status}</Badge>
                  </div>
                  <div className="text-xs text-foreground/60">
                    {o.shipping_name ?? "—"} · {new Date(o.created_at).toLocaleString("ru-RU")} · {o.order_items.length} товаров
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{Math.round(o.total_kopecks / 100).toLocaleString("ru-RU")} ₽</div>
                  <div className="text-[11px] text-foreground/50">комиссия {Math.round(o.commission_kopecks / 100).toLocaleString("ru-RU")} ₽</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setSelectedId(o.id)}>
                  <Info className="h-4 w-4 mr-1" />Детали
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {data && data.total > 30 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Назад</Button>
          <div className="px-3 py-2 text-sm">Стр. {page} из {Math.ceil(data.total / 30)}</div>
          <Button variant="outline" disabled={page >= Math.ceil(data.total / 30)} onClick={() => setPage((p) => p + 1)}>Вперёд</Button>
        </div>
      )}

      <Dialog open={!!selectedId} onOpenChange={(v) => !v && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Заказ {selectedId?.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {detailQ.data && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-foreground/50">Статус:</span> <Badge>{detailQ.data.status}</Badge></div>
                <div><span className="text-foreground/50">Дата:</span> {new Date(detailQ.data.created_at).toLocaleString("ru-RU")}</div>
                <div><span className="text-foreground/50">Итого:</span> {Math.round(detailQ.data.total_kopecks / 100).toLocaleString("ru-RU")} ₽</div>
                <div><span className="text-foreground/50">Комиссия:</span> {Math.round(detailQ.data.commission_kopecks / 100).toLocaleString("ru-RU")} ₽</div>
              </div>

              <div>
                <div className="font-semibold mb-1">Покупатель</div>
                <div>{detailQ.data.profiles?.full_name} · {detailQ.data.profiles?.phone ?? detailQ.data.profiles?.email ?? "—"}</div>
              </div>

              <div>
                <div className="font-semibold mb-1">Доставка</div>
                <div>{detailQ.data.shipping_name} · {detailQ.data.shipping_phone}</div>
                <div className="text-foreground/60">{detailQ.data.shipping_address}</div>
              </div>

              <div>
                <div className="font-semibold mb-1">Товары</div>
                <div className="space-y-1">
                  {(detailQ.data.order_items as Array<{ id: string; title_snapshot: string; price_kopecks: number; quantity: number; status: string }>).map((it) => (
                    <div key={it.id} className="flex justify-between p-2 rounded bg-surface gap-2">
                      <div className="flex-1 min-w-0 truncate">{it.title_snapshot} × {it.quantity}</div>
                      <Badge variant="secondary" className="text-[10px]">{it.status}</Badge>
                      <div className="font-semibold">{Math.round(it.price_kopecks * it.quantity / 100).toLocaleString("ru-RU")} ₽</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="font-semibold mb-2">Принудительно изменить статус</div>
                <div className="flex gap-2 flex-wrap">
                  <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="rounded-md border border-border px-3 h-10 text-sm bg-white flex-1">
                    <option value="">— выбрать —</option>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <Input placeholder="Причина изменения (необязательно)" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedId(null)}>Закрыть</Button>
            <Button disabled={!newStatus} onClick={() => selectedId && forceM.mutate({ data: { orderId: selectedId, status: newStatus, reason } })}>
              Применить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
