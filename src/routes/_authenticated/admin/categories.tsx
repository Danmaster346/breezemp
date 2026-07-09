// Категории — CRUD и порядок
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listAdminCategories, upsertCategory, deleteCategory, reorderCategories } from "@/lib/admin/categories.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: CategoriesPage,
});

type Cat = { id: string; name: string; slug: string; icon: string | null; icon_url: string | null; sort_order: number };

function CategoriesPage() {
  const list = useServerFn(listAdminCategories);
  const upsert = useServerFn(upsertCategory);
  const del = useServerFn(deleteCategory);
  const reorder = useServerFn(reorderCategories);
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ["admin-categories"], queryFn: () => list() });
  const cats = (data ?? []) as Cat[];

  const [edit, setEdit] = useState<Partial<Cat> | null>(null);

  const upM = useMutation({ mutationFn: upsert, onSuccess: () => { toast.success("Сохранено"); qc.invalidateQueries({ queryKey: ["admin-categories"] }); setEdit(null); }, onError: (e: Error) => toast.error(e.message) });
  const delM = useMutation({ mutationFn: del, onSuccess: () => { toast.success("Удалено"); qc.invalidateQueries({ queryKey: ["admin-categories"] }); }, onError: (e: Error) => toast.error(e.message) });
  const rM = useMutation({ mutationFn: reorder, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }) });

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...cats];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    rM.mutate({ data: { orderedIds: next.map((c) => c.id) } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Категории</h1>
          <p className="text-foreground/60 text-sm mt-1">Всего: {cats.length}</p>
        </div>
        <Button onClick={() => setEdit({ name: "", slug: "", icon: "", icon_url: "", sort_order: cats.length })}>
          <Plus className="h-4 w-4 mr-1" /> Новая
        </Button>
      </div>

      <div className="rounded-2xl bg-white border border-border/60 divide-y divide-border/60">
        {cats.map((c, i) => (
          <div key={c.id} className="p-3 md:p-4 flex items-center gap-3">
            {c.icon_url ? (
              <img src={c.icon_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ) : c.icon ? (
              <div className="h-10 w-10 rounded-lg bg-surface flex items-center justify-center text-lg">{c.icon}</div>
            ) : (
              <div className="h-10 w-10 rounded-lg bg-surface" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-foreground/60">/{c.slug} · порядок {c.sort_order}</div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => move(i, 1)} disabled={i === cats.length - 1}><ArrowDown className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => setEdit(c)}><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="destructive" onClick={() => { if (confirm(`Удалить «${c.name}»?`)) delM.mutate({ data: { id: c.id } }); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Редактировать" : "Новая категория"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Название" value={edit?.name ?? ""} onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))} />
            <Input placeholder="Slug (для URL)" value={edit?.slug ?? ""} onChange={(e) => setEdit((s) => ({ ...s, slug: e.target.value }))} />
            <Input placeholder="Иконка (emoji или короткий код)" value={edit?.icon ?? ""} onChange={(e) => setEdit((s) => ({ ...s, icon: e.target.value }))} />
            <Input placeholder="URL иконки (опц.)" value={edit?.icon_url ?? ""} onChange={(e) => setEdit((s) => ({ ...s, icon_url: e.target.value }))} />
            <Input type="number" placeholder="Порядок" value={edit?.sort_order ?? 0} onChange={(e) => setEdit((s) => ({ ...s, sort_order: Number(e.target.value) }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Отмена</Button>
            <Button onClick={() => edit && upM.mutate({ data: { id: edit.id, name: edit.name!, slug: edit.slug!, icon: edit.icon ?? null, icon_url: edit.icon_url ?? null, sort_order: edit.sort_order ?? 0 } })}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
