// Модерация отзывов
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listAdminReviews, setReviewHidden, deleteReviewAdmin } from "@/lib/admin/reviews.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Eye, EyeOff, Trash2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  component: ReviewsPage,
});

function ReviewsPage() {
  const list = useServerFn(listAdminReviews);
  const setHidden = useServerFn(setReviewHidden);
  const del = useServerFn(deleteReviewAdmin);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [hidden, setHiddenFilter] = useState<"all" | "visible" | "hidden">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reviews", q, hidden],
    queryFn: () => list({ data: { q, hidden, page: 1, pageSize: 50 } }),
  });

  const hideM = useMutation({ mutationFn: setHidden, onSuccess: () => { toast.success("Обновлено"); qc.invalidateQueries({ queryKey: ["admin-reviews"] }); }, onError: (e: Error) => toast.error(e.message) });
  const delM = useMutation({ mutationFn: del, onSuccess: () => { toast.success("Удалено"); qc.invalidateQueries({ queryKey: ["admin-reviews"] }); }, onError: (e: Error) => toast.error(e.message) });

  const rows = (data?.rows ?? []) as unknown as Array<{
    id: string; rating: number; comment: string | null; author_name: string | null;
    is_hidden: boolean; created_at: string; products: { title: string } | null;
  }>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Модерация отзывов</h1>
        <p className="text-foreground/60 text-sm mt-1">Всего: {data?.total ?? 0}</p>
      </div>

      <div className="rounded-2xl bg-white border border-border/60 p-3 flex gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Текст отзыва" className="pl-9" />
        </div>
        <select value={hidden} onChange={(e) => setHiddenFilter(e.target.value as never)} className="rounded-md border border-border px-3 h-10 text-sm bg-white">
          <option value="all">Все</option>
          <option value="visible">Видимые</option>
          <option value="hidden">Скрытые</option>
        </select>
      </div>

      <div className="grid gap-2">
        {isLoading ? (
          <div className="rounded-2xl bg-white p-8 text-center text-foreground/60">Загрузка...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center text-foreground/60">Отзывов нет</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white border border-border/60 p-4">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-foreground/20"}`} />
                      ))}
                    </div>
                    <span className="text-sm font-medium">{r.profiles?.full_name ?? "—"}</span>
                    <span className="text-xs text-foreground/50">{new Date(r.created_at).toLocaleDateString("ru-RU")}</span>
                    {r.is_hidden && <Badge variant="secondary" className="text-[10px]">Скрыт</Badge>}
                  </div>
                  <div className="text-xs text-foreground/60 mt-0.5">Товар: {r.products?.title ?? "—"}</div>
                  <p className="text-sm mt-2">{r.body}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => hideM.mutate({ data: { id: r.id, hidden: !r.is_hidden } })}>
                    {r.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm("Удалить отзыв?")) delM.mutate({ data: { id: r.id } }); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
