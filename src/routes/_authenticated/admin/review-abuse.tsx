// Аудит попыток злоупотребления при отправке отзыва
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listReviewAbuseLogs } from "@/lib/admin/review-abuse.functions";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/review-abuse")({
  component: ReviewAbusePage,
});

const REASON_LABEL: Record<string, string> = {
  RATE_HOUR: "Лимит: > 5 отзывов/час",
  RATE_DAY: "Лимит: > 20 отзывов/сутки",
  NOT_PURCHASED: "Товар не куплен",
  TOO_EARLY: "Товар не получен",
  SELF_REVIEW: "Отзыв на свой товар",
  DUPLICATE: "Повторный отзыв",
};

function reasonLabel(code: string) {
  return REASON_LABEL[code] ?? code;
}

function ReviewAbusePage() {
  const list = useServerFn(listReviewAbuseLogs);
  const [since, setSince] = useState<"1h" | "24h" | "7d" | "30d" | "all">("7d");
  const [reason, setReason] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-review-abuse", since, reason, userId, page],
    queryFn: () =>
      list({
        data: {
          since,
          reason: reason || null,
          user_id: userId || null,
          page,
          pageSize,
        },
      }),
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-destructive" />
          Злоупотребления отзывами
        </h1>
        <p className="text-foreground/60 text-sm mt-1">
          Аудит-лог отказов при попытке оставить отзыв. Всего за период:{" "}
          <span className="font-semibold text-foreground">{data?.total ?? 0}</span>
        </p>
      </div>

      {/* Фильтры */}
      <div className="rounded-2xl bg-white border border-border/60 p-3 flex flex-wrap gap-2 items-center">
        <div className="flex flex-wrap gap-1">
          {(["1h", "24h", "7d", "30d", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setSince(s);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                since === s ? "bg-brand text-brand-foreground" : "hover:bg-surface text-foreground/70"
              }`}
            >
              {s === "all" ? "Всё время" : s}
            </button>
          ))}
        </div>
        <select
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Все причины</option>
          {Object.entries(REASON_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          value={userId}
          onChange={(e) => {
            setUserId(e.target.value.trim());
            setPage(1);
          }}
          placeholder="user_id (UUID)"
          className="rounded-lg border bg-white px-3 py-1.5 text-sm w-64 font-mono"
        />
      </div>

      {/* Сводки */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white border border-border/60 p-4">
          <div className="font-semibold mb-2">По причинам</div>
          {(data?.byReason ?? []).length === 0 ? (
            <div className="text-sm text-foreground/60">Нет данных</div>
          ) : (
            <div className="space-y-1.5">
              {data!.byReason.map((r) => (
                <div key={r.reason_code} className="flex items-center justify-between text-sm">
                  <span>{reasonLabel(r.reason_code)}</span>
                  <span className="font-semibold tabular-nums">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-white border border-border/60 p-4">
          <div className="font-semibold mb-2">Топ подозрительных пользователей</div>
          {(data?.topUsers ?? []).length === 0 ? (
            <div className="text-sm text-foreground/60">Нет данных</div>
          ) : (
            <div className="space-y-1.5">
              {data!.topUsers.map((u) => (
                <button
                  key={u.user_id}
                  onClick={() => {
                    setUserId(u.user_id);
                    setPage(1);
                  }}
                  className="w-full text-left flex items-center justify-between text-sm rounded-lg hover:bg-surface px-2 py-1 -mx-2"
                  title="Фильтровать по этому пользователю"
                >
                  <span className="truncate">
                    {u.full_name || <span className="font-mono text-xs">{u.user_id.slice(0, 8)}…</span>}
                  </span>
                  <span className="font-semibold tabular-nums text-destructive">{u.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Таблица */}
      <div className="rounded-2xl bg-white border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-foreground/60">Загрузка...</div>
        ) : (data?.rows ?? []).length === 0 ? (
          <div className="p-8 text-center text-foreground/60">Событий нет</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-foreground/60 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Время</th>
                  <th className="text-left px-3 py-2">Причина</th>
                  <th className="text-left px-3 py-2">Пользователь</th>
                  <th className="text-left px-3 py-2">Товар / позиция</th>
                  <th className="text-left px-3 py-2">Сообщение</th>
                </tr>
              </thead>
              <tbody>
                {data!.rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="px-3 py-2 whitespace-nowrap text-foreground/70">
                      {new Date(r.created_at).toLocaleString("ru-RU")}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-destructive/10 text-destructive text-xs px-2 py-0.5 font-medium whitespace-nowrap">
                        {reasonLabel(r.reason_code)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {r.user_id ? (
                        <button
                          className="text-left hover:underline"
                          onClick={() => {
                            setUserId(r.user_id!);
                            setPage(1);
                          }}
                        >
                          {r.user_name || <span className="font-mono text-xs">{r.user_id.slice(0, 8)}…</span>}
                        </button>
                      ) : (
                        <span className="text-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-foreground/60">
                      {r.product_id ? `${r.product_id.slice(0, 8)}…` : "—"}
                      {r.order_item_id ? ` / ${r.order_item_id.slice(0, 8)}…` : ""}
                    </td>
                    <td className="px-3 py-2 text-foreground/70">{r.message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border bg-white text-sm disabled:opacity-50"
          >
            Назад
          </button>
          <span className="text-sm text-foreground/60">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg border bg-white text-sm disabled:opacity-50"
          >
            Вперёд
          </button>
        </div>
      )}
    </div>
  );
}
