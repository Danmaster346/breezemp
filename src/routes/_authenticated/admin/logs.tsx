// Журнал действий администраторов
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAdminLogs } from "@/lib/admin/logs.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  component: LogsPage,
});

function LogsPage() {
  const list = useServerFn(listAdminLogs);
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-logs", action, page],
    queryFn: () => list({ data: { action: action || undefined, page, pageSize: 50 } }),
  });

  const rows = (data?.rows ?? []) as Array<{
    id: string; admin_id: string; action: string; entity_type: string; entity_id: string | null;
    details: Record<string, unknown>; created_at: string; profiles?: { full_name: string | null } | null;
  }>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Журнал действий</h1>
        <p className="text-foreground/60 text-sm mt-1">Всего: {data?.total ?? 0}</p>
      </div>

      <div className="rounded-2xl bg-white border border-border/60 p-3 flex gap-2">
        <Input placeholder="Фильтр по действию (product., user., order.)" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
      </div>

      <div className="rounded-2xl bg-white border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-foreground/60">Загрузка...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-foreground/60">Записей нет</div>
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map((l) => (
              <div key={l.id} className="p-3 flex flex-wrap items-start gap-3 text-sm">
                <div className="text-xs text-foreground/50 shrink-0 w-32 tabular-nums">
                  {new Date(l.created_at).toLocaleString("ru-RU")}
                </div>
                <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">{l.action}</Badge>
                <div className="text-xs text-foreground/60 shrink-0">
                  {l.entity_type}{l.entity_id ? `:${l.entity_id.slice(0, 8)}` : ""}
                </div>
                <div className="text-xs text-foreground/50 flex-1 min-w-0 truncate">
                  {l.profiles?.full_name ?? l.admin_id.slice(0, 8)}
                  {Object.keys(l.details).length > 0 && ` · ${JSON.stringify(l.details)}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {data && data.total > 50 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Назад</Button>
          <div className="px-3 py-2 text-sm">Стр. {page} из {Math.ceil(data.total / 50)}</div>
          <Button variant="outline" disabled={page >= Math.ceil(data.total / 50)} onClick={() => setPage((p) => p + 1)}>Вперёд</Button>
        </div>
      )}
    </div>
  );
}
