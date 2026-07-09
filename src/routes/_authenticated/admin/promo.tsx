// Промокоды
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listAdminPromos, upsertPromo, deletePromo } from "@/lib/admin/promo.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/promo")({
  component: PromoPage,
});

type Promo = {
  id: string; code: string; discount_type: "percent" | "amount"; discount_value: number;
  active: boolean; max_uses: number | null; used_count: number | null; expires_at: string | null;
};

function PromoPage() {
  const list = useServerFn(listAdminPromos);
  const upsert = useServerFn(upsertPromo);
  const del = useServerFn(deletePromo);
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ["admin-promos"], queryFn: () => list() });
  const items = (data ?? []) as Promo[];

  const [edit, setEdit] = useState<Partial<Promo> | null>(null);

  const upM = useMutation({ mutationFn: upsert, onSuccess: () => { toast.success("Сохранено"); qc.invalidateQueries({ queryKey: ["admin-promos"] }); setEdit(null); }, onError: (e: Error) => toast.error(e.message) });
  const delM = useMutation({ mutationFn: del, onSuccess: () => { toast.success("Удалено"); qc.invalidateQueries({ queryKey: ["admin-promos"] }); }, onError: (e: Error) => toast.error(e.message) });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Промокоды</h1>
          <p className="text-foreground/60 text-sm mt-1">Всего: {items.length}</p>
        </div>
        <Button onClick={() => setEdit({ code: "", discount_type: "percent", discount_value: 10, active: true, max_uses: null, expires_at: null })}>
          <Plus className="h-4 w-4 mr-1" /> Новый
        </Button>
      </div>

      <div className="rounded-2xl bg-white border border-border/60 divide-y divide-border/60">
        {items.length === 0 && <div className="p-8 text-center text-foreground/60">Промокодов нет</div>}
        {items.map((p) => (
          <div key={p.id} className="p-3 md:p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold">{p.code}</span>
                <Badge variant={p.active ? "default" : "secondary"} className="text-[10px]">{p.active ? "активен" : "неактивен"}</Badge>
              </div>
              <div className="text-xs text-foreground/60 mt-0.5">
                Скидка {p.discount_type === "percent" ? `${p.discount_value}%` : `${p.discount_value} ₽`}
                {" · "}Использований: {p.used_count ?? 0}{p.max_uses ? ` / ${p.max_uses}` : ""}
                {p.expires_at && ` · до ${new Date(p.expires_at).toLocaleDateString("ru-RU")}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={p.active} onCheckedChange={(v) => upM.mutate({ data: { id: p.id, code: p.code, discount_type: p.discount_type, discount_value: p.discount_value, active: v, max_uses: p.max_uses, expires_at: p.expires_at } })} />
              <Button size="sm" variant="outline" onClick={() => setEdit(p)}><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="destructive" onClick={() => { if (confirm(`Удалить ${p.code}?`)) delM.mutate({ data: { id: p.id } }); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Редактировать промокод" : "Новый промокод"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Код (SUMMER10)" value={edit?.code ?? ""} onChange={(e) => setEdit((s) => ({ ...s, code: e.target.value }))} />
            <div className="flex gap-2">
              <select value={edit?.discount_type ?? "percent"} onChange={(e) => setEdit((s) => ({ ...s, discount_type: e.target.value as "percent" | "amount" }))} className="rounded-md border border-border px-3 h-10 text-sm bg-white flex-1">
                <option value="percent">Процент %</option>
                <option value="amount">Фикс. сумма ₽</option>
              </select>
              <Input type="number" placeholder="Значение" value={edit?.discount_value ?? 0} onChange={(e) => setEdit((s) => ({ ...s, discount_value: Number(e.target.value) }))} className="flex-1" />
            </div>
            <Input type="number" placeholder="Макс. использований (пусто = без лимита)" value={edit?.max_uses ?? ""} onChange={(e) => setEdit((s) => ({ ...s, max_uses: e.target.value ? Number(e.target.value) : null }))} />
            <Input type="datetime-local" placeholder="Срок действия" value={edit?.expires_at ? edit.expires_at.slice(0, 16) : ""} onChange={(e) => setEdit((s) => ({ ...s, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
            <div className="flex items-center gap-2">
              <Switch checked={edit?.active ?? true} onCheckedChange={(v) => setEdit((s) => ({ ...s, active: v }))} />
              <span className="text-sm">Активен</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Отмена</Button>
            <Button onClick={() => edit && upM.mutate({ data: {
              id: edit.id,
              code: edit.code ?? "",
              discount_type: edit.discount_type ?? "percent",
              discount_value: edit.discount_value ?? 0,
              active: edit.active ?? true,
              max_uses: edit.max_uses ?? null,
              expires_at: edit.expires_at ?? null,
            } })}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
