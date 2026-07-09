// Возвраты
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listAdminReturns, resolveReturn } from "@/lib/admin/returns.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Check, X, MessageSquare } from "lucide-react";

type SearchParams = { status?: string };

export const Route = createFileRoute("/_authenticated/admin/returns")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({ status: (s.status as string) || undefined }),
  component: ReturnsPage,
});

function ReturnsPage() {
  const search = Route.useSearch();
  const list = useServerFn(listAdminReturns);
  const resolve = useServerFn(resolveReturn);
  const qc = useQueryClient();

  const [status, setStatus] = useState<string>(search.status ?? "pending");
  const [dialog, setDialog] = useState<{ itemId: string; action: "reject" | "request_info" } | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-returns", status],
    queryFn: () => list({ data: { status, page: 1, pageSize: 100 } }),
  });

  const resM = useMutation({
    mutationFn: resolve,
    onSuccess: () => {
      toast.success("Готово");
      qc.invalidateQueries({ queryKey: ["admin-returns"] });
      setDialog(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data?.rows ?? []) as Array<{
    id: string; order_id: string; title_snapshot: string; image_url: string | null;
    price_kopecks: number; quantity: number; return_reason: string | null; return_comment: string | null;
    return_photos: string[] | null; return_admin_status: string; return_admin_reason: string | null;
    status: string;
  }>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Возвраты</h1>
        <p className="text-foreground/60 text-sm mt-1">Всего: {data?.total ?? 0}</p>
      </div>

      <div className="rounded-2xl bg-white border border-border/60 p-3 flex gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-border px-3 h-10 text-sm bg-white">
          <option value="pending">Новые</option>
          <option value="approved">Одобренные</option>
          <option value="rejected">Отклонённые</option>
          <option value="all">Все</option>
        </select>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          <div className="rounded-2xl bg-white p-8 text-center text-foreground/60">Загрузка...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center text-foreground/60">Возвратов нет</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white border border-border/60 p-4">
              <div className="flex flex-wrap gap-4">
                {r.image_url && <img src={r.image_url} alt="" className="h-20 w-20 rounded-lg object-cover" />}
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <div className="font-semibold">{r.title_snapshot}</div>
                    <div className="text-xs text-foreground/60">Заказ {r.order_id.slice(0, 8)} · {r.quantity} × {Math.round(r.price_kopecks / 100).toLocaleString("ru-RU")} ₽</div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">{r.status}</Badge>
                    <Badge variant={r.return_admin_status === "approved" ? "default" : r.return_admin_status === "rejected" ? "destructive" : "secondary"} className="text-[10px]">
                      админ: {r.return_admin_status}
                    </Badge>
                  </div>
                  {r.return_reason && (
                    <div className="text-sm">
                      <span className="text-foreground/60">Причина:</span> {r.return_reason}
                    </div>
                  )}
                  {r.return_comment && <div className="text-sm text-foreground/70 italic">« {r.return_comment} »</div>}
                  {r.return_photos && r.return_photos.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {r.return_photos.map((p, i) => (
                        <a key={i} href={p} target="_blank" rel="noreferrer">
                          <img src={p} alt="" className="h-16 w-16 rounded object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button size="sm" onClick={() => resM.mutate({ data: { itemId: r.id, action: "approve" } })}>
                    <Check className="h-4 w-4 mr-1" />Одобрить
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDialog({ itemId: r.id, action: "reject" })}>
                    <X className="h-4 w-4 mr-1" />Отклонить
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDialog({ itemId: r.id, action: "request_info" })}>
                    <MessageSquare className="h-4 w-4 mr-1" />Запросить инфо
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.action === "reject" ? "Отклонить возврат" : "Запросить дополнительную информацию"}</DialogTitle>
          </DialogHeader>
          <Input placeholder={dialog?.action === "reject" ? "Причина отказа" : "Что нужно уточнить"} value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Отмена</Button>
            <Button onClick={() => dialog && resM.mutate({ data: { itemId: dialog.itemId, action: dialog.action, reason } })}>
              Отправить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
