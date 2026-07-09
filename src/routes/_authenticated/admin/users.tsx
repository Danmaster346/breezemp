// Пользователи
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listAdminUsers, setUserBlocked, setUserRole, getUserDetail, type AdminUserRow } from "@/lib/admin/users.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Ban, ShieldCheck, Search, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const list = useServerFn(listAdminUsers);
  const block = useServerFn(setUserBlocked);
  const role = useServerFn(setUserRole);
  const detail = useServerFn(getUserDetail);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [blockUser, setBlockUser] = useState<AdminUserRow | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", q, status, roleFilter, page],
    queryFn: () => list({ data: { q, status, role: roleFilter, page, pageSize: 30 } }),
  });

  const detailQ = useQuery({
    queryKey: ["admin-user-detail", selected?.id],
    queryFn: () => detail({ data: { userId: selected!.id } }),
    enabled: !!selected,
  });

  const blockM = useMutation({
    mutationFn: (v: { userId: string; blocked: boolean; reason?: string }) => block({ data: v }),
    onSuccess: () => {
      toast.success("Готово");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setBlockUser(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleM = useMutation({
    mutationFn: (v: { userId: string; role: "buyer" | "seller" | "admin"; add: boolean }) => role({ data: v }),
    onSuccess: () => {
      toast.success("Роль обновлена");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user-detail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Пользователи</h1>
        <p className="text-foreground/60 text-sm mt-1">Всего: {data?.total ?? 0}</p>
      </div>

      <div className="rounded-2xl bg-white border border-border/60 p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Имя, email, телефон" className="pl-9" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value as never); setPage(1); }} className="rounded-md border border-border px-3 h-10 text-sm bg-white">
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="blocked">Заблокированные</option>
        </select>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="rounded-md border border-border px-3 h-10 text-sm bg-white">
          <option value="all">Все роли</option>
          <option value="buyer">Покупатели</option>
          <option value="seller">Продавцы</option>
          <option value="admin">Админы</option>
        </select>
      </div>

      <div className="rounded-2xl bg-white border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-foreground/60">Загрузка...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-foreground/60">Ничего не найдено</div>
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map((u) => (
              <div key={u.id} className="p-3 md:p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{u.full_name || "—"}</div>
                  <div className="text-xs text-foreground/60 truncate">{u.email ?? u.phone ?? u.id.slice(0, 8)}</div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {u.roles.length === 0 ? <Badge variant="secondary" className="text-[10px]">buyer</Badge> : u.roles.map((r) => (
                      <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="text-[10px]">{r}</Badge>
                    ))}
                    {u.is_blocked && <Badge variant="destructive" className="text-[10px]">Заблокирован</Badge>}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setSelected(u)}><Info className="h-4 w-4 mr-1" />Детали</Button>
                  {u.is_blocked ? (
                    <Button size="sm" variant="outline" onClick={() => blockM.mutate({ userId: u.id, blocked: false })}>
                      <ShieldCheck className="h-4 w-4 mr-1" />Разблокировать
                    </Button>
                  ) : (
                    <Button size="sm" variant="destructive" onClick={() => setBlockUser(u)}>
                      <Ban className="h-4 w-4 mr-1" />Заблокировать
                    </Button>
                  )}
                </div>
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

      {/* Блокировка */}
      <Dialog open={!!blockUser} onOpenChange={(v) => !v && setBlockUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Заблокировать пользователя?</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-foreground/70">{blockUser?.full_name || blockUser?.id.slice(0, 8)}</div>
          <Input placeholder="Причина блокировки" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockUser(null)}>Отмена</Button>
            <Button variant="destructive" disabled={blockM.isPending} onClick={() => blockUser && blockM.mutate({ userId: blockUser.id, blocked: true, reason })}>
              Заблокировать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Детали */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.full_name || "Пользователь"}</DialogTitle>
          </DialogHeader>
          {detailQ.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-foreground/50">ID:</span> <span className="font-mono text-[11px]">{detailQ.data.profile?.id}</span></div>
                <div><span className="text-foreground/50">Email:</span> {detailQ.data.profile?.email ?? "—"}</div>
                <div><span className="text-foreground/50">Телефон:</span> {detailQ.data.profile?.phone ?? "—"}</div>
                <div><span className="text-foreground/50">Регистрация:</span> {detailQ.data.profile?.created_at ? new Date(detailQ.data.profile.created_at).toLocaleDateString("ru-RU") : "—"}</div>
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">Роли</div>
                <div className="flex gap-2 flex-wrap">
                  {(["buyer", "seller", "admin"] as const).map((r) => {
                    const has = detailQ.data!.roles.includes(r);
                    return (
                      <Button key={r} size="sm" variant={has ? "default" : "outline"} onClick={() => roleM.mutate({ userId: selected!.id, role: r, add: !has })}>
                        {has ? "✓ " : "+ "}{r}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">Заказы ({detailQ.data.orders.length})</div>
                <div className="space-y-1 max-h-40 overflow-y-auto text-sm">
                  {detailQ.data.orders.map((o) => (
                    <div key={o.id} className="flex justify-between p-2 rounded bg-surface">
                      <div className="font-mono text-xs">{o.id.slice(0, 8)}</div>
                      <div>{o.status}</div>
                      <div className="font-semibold">{Math.round((o.total_kopecks ?? 0) / 100).toLocaleString("ru-RU")} ₽</div>
                    </div>
                  ))}
                </div>
              </div>

              {detailQ.data.products.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2">Товары ({detailQ.data.products.length})</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto text-sm">
                    {detailQ.data.products.map((p) => (
                      <div key={p.id} className="flex justify-between p-2 rounded bg-surface gap-2">
                        <div className="flex-1 min-w-0 truncate">{p.title}</div>
                        <Badge variant="secondary" className="text-[10px]">{p.moderation_status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
