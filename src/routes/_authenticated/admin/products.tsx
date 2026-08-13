// Модерация товаров
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listAdminProducts, moderateProduct, bulkModerateProducts, deleteProductAdmin } from "@/lib/admin/products.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Check, X, Ban, Trash2, Undo2, Download } from "lucide-react";
import { exportCsv, csvFileName } from "@/lib/csv-export";

type SearchParams = { status?: string };

export const Route = createFileRoute("/_authenticated/admin/products")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({ status: (s.status as string) || undefined }),
  component: ProductsPage,
});

function ProductsPage() {
  const search = Route.useSearch();
  const list = useServerFn(listAdminProducts);
  const mod = useServerFn(moderateProduct);
  const bulk = useServerFn(bulkModerateProducts);
  const del = useServerFn(deleteProductAdmin);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>(search.status ?? "all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reasonDialog, setReasonDialog] = useState<{ id?: string; action: "reject" | "block"; bulk?: boolean } | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", q, status, page],
    queryFn: () => list({ data: { q, status, page, pageSize: 30 } }),
  });

  const rows = (data?.rows ?? []) as unknown as Array<{
    id: string; title: string; price_kopecks: number; stock: number; is_active: boolean;
    moderation_status: string; moderation_reason: string | null; image_url: string | null; seller_id: string;
    categories: { name: string } | null; profiles: { full_name: string | null } | null;
  }>;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    setSelected(new Set());
  };

  const modM = useMutation({ mutationFn: mod, onSuccess: () => { toast.success("Готово"); invalidate(); setReasonDialog(null); setReason(""); }, onError: (e: Error) => toast.error(e.message) });
  const bulkM = useMutation({ mutationFn: bulk, onSuccess: () => { toast.success("Массовое действие выполнено"); invalidate(); setReasonDialog(null); setReason(""); }, onError: (e: Error) => toast.error(e.message) });
  const delM = useMutation({ mutationFn: del, onSuccess: () => { toast.success("Удалено"); invalidate(); }, onError: (e: Error) => toast.error(e.message) });

  const toggleAll = () => setSelected((s) => s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const bulkAction = (action: "approve" | "reject" | "block" | "unblock" | "delete") => {
    if (selected.size === 0) return;
    if (action === "reject" || action === "block") {
      setReasonDialog({ action, bulk: true });
    } else {
      bulkM.mutate({ data: { ids: [...selected], action } });
    }
  };

  const handleExport = () => {
    const headers = ["ID", "Название", "Цена", "Категория", "Продавец", "Статус", "Остаток"];
    const csvRows = rows.map((p) => [
      p.id,
      p.title,
      Math.round(p.price_kopecks / 100).toLocaleString("ru-RU") + " ₽",
      p.categories?.name ?? "—",
      p.profiles?.full_name ?? "—",
      p.moderation_status,
      p.stock,
    ]);
    exportCsv(csvFileName("products"), headers, csvRows);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Товары и модерация</h1>
          <p className="text-foreground/60 text-sm mt-1">Всего: {data?.total ?? 0}</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-1" />Экспорт CSV
        </Button>
      </div>

      <div className="rounded-2xl bg-white border border-border/60 p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Название товара" className="pl-9" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-border px-3 h-10 text-sm bg-white">
          <option value="all">Все статусы</option>
          <option value="pending">На проверке</option>
          <option value="approved">Одобрено</option>
          <option value="rejected">Отклонено</option>
          <option value="blocked">Заблокировано</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="rounded-2xl bg-brand/5 border border-brand/20 p-3 flex flex-wrap gap-2 items-center">
          <div className="text-sm font-medium">Выбрано: {selected.size}</div>
          <Button size="sm" variant="default" onClick={() => bulkAction("approve")}>Одобрить</Button>
          <Button size="sm" variant="outline" onClick={() => bulkAction("reject")}>Отклонить</Button>
          <Button size="sm" variant="outline" onClick={() => bulkAction("block")}>Заблокировать</Button>
          <Button size="sm" variant="outline" onClick={() => bulkAction("unblock")}>Разблокировать</Button>
          <Button size="sm" variant="destructive" onClick={() => bulkAction("delete")}>Удалить</Button>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-foreground/60">Загрузка...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-foreground/60">Ничего не найдено</div>
        ) : (
          <>
            <div className="p-3 border-b flex items-center gap-3">
              <Checkbox checked={selected.size === rows.length && rows.length > 0} onCheckedChange={toggleAll} />
              <span className="text-xs text-foreground/60">Выбрать все на странице</span>
            </div>
            <div className="divide-y divide-border/60">
              {rows.map((p) => (
                <div key={p.id} className="p-3 md:p-4 flex flex-wrap items-start gap-3">
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} className="mt-2" />
                  {p.image_url && <img src={p.image_url} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{p.title}</div>
                    <div className="text-xs text-foreground/60 truncate">
                      {p.profiles?.full_name ?? "—"} · {p.categories?.name ?? "—"} · {Math.round(p.price_kopecks / 100).toLocaleString("ru-RU")} ₽ · остаток {p.stock}
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <Badge variant={p.moderation_status === "approved" ? "default" : p.moderation_status === "pending" ? "secondary" : "destructive"} className="text-[10px]">
                        {p.moderation_status}
                      </Badge>
                      {!p.is_active && <Badge variant="secondary" className="text-[10px]">Неактивно</Badge>}
                      {p.moderation_reason && <span className="text-[10px] text-foreground/50">« {p.moderation_reason}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {p.moderation_status !== "approved" && (
                      <Button size="sm" onClick={() => modM.mutate({ data: { productId: p.id, action: "approve" } })}>
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    {p.moderation_status !== "rejected" && (
                      <Button size="sm" variant="outline" onClick={() => setReasonDialog({ id: p.id, action: "reject" })}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {p.moderation_status === "blocked" ? (
                      <Button size="sm" variant="outline" onClick={() => modM.mutate({ data: { productId: p.id, action: "unblock" } })}>
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setReasonDialog({ id: p.id, action: "block" })}>
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => { if (confirm("Удалить товар?")) delM.mutate({ data: { id: p.id } }); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {data && data.total > 30 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Назад</Button>
          <div className="px-3 py-2 text-sm">Стр. {page} из {Math.ceil(data.total / 30)}</div>
          <Button variant="outline" disabled={page >= Math.ceil(data.total / 30)} onClick={() => setPage((p) => p + 1)}>Вперёд</Button>
        </div>
      )}

      <Dialog open={!!reasonDialog} onOpenChange={(v) => !v && setReasonDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reasonDialog?.action === "reject" ? "Отклонить" : "Заблокировать"} товар</DialogTitle>
          </DialogHeader>
          <Input placeholder="Причина" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonDialog(null)}>Отмена</Button>
            <Button onClick={() => {
              if (!reasonDialog) return;
              if (reasonDialog.bulk) bulkM.mutate({ data: { ids: [...selected], action: reasonDialog.action, reason } });
              else if (reasonDialog.id) modM.mutate({ data: { productId: reasonDialog.id, action: reasonDialog.action, reason } });
            }}>Применить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
