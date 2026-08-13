// Управление складом продавца: остатки с индикацией, инлайн-правки, поставки,
// история движений, импорт/экспорт CSV и настройки уведомлений о низком остатке.
import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Download,
  History,
  Loader2,
  PackagePlus,
  Save,
  Settings2,
  Truck,
  Upload,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SmartImage } from "@/components/SmartImage";
import { formatPrice } from "@/lib/format";
import { useAuth } from "@/lib/use-auth";
import {
  createSupply,
  getWarehouse,
  importWarehouseCsv,
  listStockMovements,
  listSupplies,
  patchWarehouseItem,
  saveWarehouseSettings,
  type WarehouseRow,
} from "@/lib/seller/warehouse.functions";

export const Route = createFileRoute("/_authenticated/seller/warehouse")({
  component: WarehousePage,
  errorComponent: ({ error }) => (
    <div role="alert" className="rounded-2xl bg-card hairline p-6 text-sm text-destructive">
      Не удалось загрузить склад: {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Склад не найден.</div>,
});

const MOVEMENT_LABEL: Record<string, string> = {
  manual: "Ручное изменение",
  import: "Импорт CSV",
  supply: "Поставка",
  order: "Продажа",
  writeoff: "Списание",
  return: "Возврат",
};

/** Цветовая индикация остатка. */
function stockTone(row: WarehouseRow): { dot: string; tone: string; label: string } {
  const min = Math.max(row.min_stock, 1);
  if (row.stock === 0) return { dot: "🔴", tone: "text-destructive", label: "Нет в наличии" };
  if (row.stock <= min) return { dot: "🟡", tone: "text-amber-700", label: "Низкий остаток" };
  if (row.stock > min * 10) return { dot: "🔵", tone: "text-sky-700", label: "Избыточный остаток" };
  return { dot: "🟢", tone: "text-emerald-700", label: "В наличии" };
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-card hairline p-4 ${className}`}>{children}</div>;
}

function WarehousePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchWarehouse = useServerFn(getWarehouse);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");

  const wh = useQuery({
    queryKey: ["seller-warehouse", user?.id],
    enabled: !!user,
    queryFn: () => fetchWarehouse(),
  });

  const rows = useMemo(() => {
    const list = wh.data?.rows ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      if (filter === "out" && r.stock !== 0) return false;
      if (filter === "low" && !(r.stock > 0 && r.stock <= Math.max(r.min_stock, 1))) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        (r.sku ?? "").toLowerCase().includes(q) ||
        (r.category_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [wh.data, search, filter]);

  const s = wh.data?.summary;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["seller-warehouse"] });
    qc.invalidateQueries({ queryKey: ["stock-movements"] });
    qc.invalidateQueries({ queryKey: ["seller-dashboard-extra"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl md:text-2xl font-extrabold tracking-tight">
          <WarehouseIcon className="mr-2 inline h-5 w-5" /> Управление складом
        </h2>
        <p className="text-sm text-muted-foreground">
          Остатки, поставки, история движений и уведомления о нехватке товара
        </p>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Всего SKU", value: s?.skuCount ?? 0, tone: "" },
          { label: "В наличии", value: s?.inStock ?? 0, tone: "text-emerald-700" },
          { label: "Низкий остаток", value: s?.lowStock ?? 0, tone: "text-amber-700" },
          { label: "Нет в наличии", value: s?.outOfStock ?? 0, tone: "text-destructive" },
        ].map((k) => (
          <Card key={k.label}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {k.label}
            </div>
            <div className={`mt-1 font-display text-2xl font-extrabold tabular-nums ${k.tone}`}>
              {k.value}
            </div>
          </Card>
        ))}
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Стоимость склада
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold tabular-nums">
            {formatPrice(s?.stockValueKopecks ?? 0)}
          </div>
        </Card>
      </div>

      <Tabs defaultValue="stock">
        <TabsList className="flex-wrap">
          <TabsTrigger value="stock">Остатки</TabsTrigger>
          <TabsTrigger value="supplies">Поставки</TabsTrigger>
          <TabsTrigger value="movements">Движения</TabsTrigger>
          <TabsTrigger value="settings">Настройки</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, артикулу, категории"
              className="h-11 min-w-[240px] flex-1 rounded-full border bg-background px-4 text-sm"
            />
            {(
              [
                { key: "all", label: "Все" },
                { key: "low", label: "Низкий остаток" },
                { key: "out", label: "Нет в наличии" },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`h-11 rounded-full px-4 text-sm font-semibold ui-transition ${
                  filter === f.key ? "bg-brand text-brand-foreground" : "border hover:bg-accent"
                }`}
              >
                {f.label}
              </button>
            ))}
            <CsvTools rows={wh.data?.rows ?? []} onDone={invalidate} />
          </div>

          {wh.isLoading ? (
            <Card className="text-sm text-muted-foreground">Загружаем остатки…</Card>
          ) : rows.length === 0 ? (
            <Card className="text-sm text-muted-foreground">Товары не найдены.</Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-card hairline">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-surface text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Товар</th>
                    <th className="px-3 py-3">Артикул</th>
                    <th className="px-3 py-3">Остаток</th>
                    <th className="px-3 py-3">Мин.</th>
                    <th className="px-3 py-3">Цена</th>
                    <th className="px-3 py-3">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <StockRow key={r.id} row={r} onSaved={invalidate} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="supplies" className="mt-4">
          <SuppliesTab rows={wh.data?.rows ?? []} onDone={invalidate} />
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          <MovementsTab />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <SettingsTab
            threshold={s?.threshold ?? 5}
            channel={s?.channel ?? "app"}
            onDone={invalidate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Строка таблицы с инлайн-правкой остатка, минимума и артикула. */
function StockRow({ row, onSaved }: { row: WarehouseRow; onSaved: () => void }) {
  const patch = useServerFn(patchWarehouseItem);
  const [stock, setStock] = useState(String(row.stock));
  const [min, setMin] = useState(String(row.min_stock));
  const [sku, setSku] = useState(row.sku ?? "");
  const tone = stockTone(row);

  const dirty =
    Number(stock) !== row.stock || Number(min) !== row.min_stock || sku !== (row.sku ?? "");

  const save = useMutation({
    mutationFn: () =>
      patch({
        data: {
          product_id: row.id,
          stock: Number(stock),
          min_stock: Number(min),
          sku: sku.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Сохранено", { description: row.title });
      onSaved();
    },
    onError: (e: Error) => toast.error("Не удалось сохранить", { description: e.message }),
  });

  return (
    <tr className="border-t">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface">
            {row.image_url && (
              <SmartImage src={row.image_url} alt={row.title} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold">{row.title}</div>
            <div className="text-xs text-muted-foreground">{row.category_name ?? "Без категории"}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="—"
          className="h-9 w-28 rounded-lg border bg-background px-2 text-sm"
        />
      </td>
      <td className="px-3 py-3">
        <input
          type="number"
          min={0}
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="h-9 w-20 rounded-lg border bg-background px-2 text-sm tabular-nums"
        />
      </td>
      <td className="px-3 py-3">
        <input
          type="number"
          min={0}
          value={min}
          onChange={(e) => setMin(e.target.value)}
          className="h-9 w-16 rounded-lg border bg-background px-2 text-sm tabular-nums"
        />
      </td>
      <td className="px-3 py-3 tabular-nums">{formatPrice(row.price_kopecks)}</td>
      <td className="px-3 py-3">
        <div className={`text-xs font-semibold ${tone.tone}`}>
          {tone.dot} {tone.label}
        </div>
        {dirty && (
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-brand px-3 text-xs font-bold text-brand-foreground disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Сохранить
          </button>
        )}
      </td>
    </tr>
  );
}

/** Экспорт остатков в CSV и массовый импорт. */
function CsvTools({ rows, onDone }: { rows: WarehouseRow[]; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const importCsv = useServerFn(importWarehouseCsv);

  const doImport = useMutation({
    mutationFn: (parsed: { sku?: string; title?: string; stock?: number; price_kopecks?: number }[]) =>
      importCsv({ data: { rows: parsed } }),
    onSuccess: (res) => {
      toast.success(`Обновлено товаров: ${res.updated}`, {
        description: res.skippedCount > 0 ? `Не найдено: ${res.skippedCount}` : undefined,
      });
      onDone();
    },
    onError: (e: Error) => toast.error("Импорт не удался", { description: e.message }),
  });

  const exportCsv = () => {
    const header = "sku;title;stock;price_rub";
    const body = rows
      .map((r) => `${r.sku ?? ""};${r.title.replace(/;/g, ",")};${r.stock};${r.price_kopecks / 100}`)
      .join("\n");
    const blob = new Blob([`\uFEFF${header}\n${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `warehouse-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    const sep = (lines[0] ?? "").includes(";") ? ";" : ",";
    const head = (lines[0] ?? "").toLowerCase().split(sep).map((h) => h.trim());
    const idx = (name: string) => head.indexOf(name);
    const start = head.includes("sku") || head.includes("title") ? 1 : 0;
    const parsed = lines.slice(start).map((line) => {
      const cells = line.split(sep).map((c) => c.trim());
      const num = (i: number) => {
        const v = Number((cells[i] ?? "").replace(",", "."));
        return Number.isFinite(v) ? v : undefined;
      };
      const priceRub = idx("price_rub") >= 0 ? num(idx("price_rub")) : undefined;
      return {
        sku: idx("sku") >= 0 ? cells[idx("sku")] || undefined : cells[0] || undefined,
        title: idx("title") >= 0 ? cells[idx("title")] || undefined : cells[1] || undefined,
        stock: idx("stock") >= 0 ? num(idx("stock")) : num(2),
        price_kopecks: priceRub !== undefined ? Math.round(priceRub * 100) : undefined,
      };
    });
    const clean = parsed.filter((r) => r.sku || r.title);
    if (clean.length === 0) {
      toast.error("В файле нет подходящих строк");
      return;
    }
    doImport.mutate(clean.slice(0, 1000));
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={exportCsv}
        className="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold hover:bg-accent ui-transition"
      >
        <Download className="h-4 w-4" /> Экспорт CSV
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={doImport.isPending}
        className="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold hover:bg-accent ui-transition disabled:opacity-60"
      >
        {doImport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Импорт CSV
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Создание поставки и её история. */
function SuppliesTab({ rows, onDone }: { rows: WarehouseRow[]; onDone: () => void }) {
  const { user } = useAuth();
  const fetchSupplies = useServerFn(listSupplies);
  const create = useServerFn(createSupply);
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});

  const supplies = useQuery({
    queryKey: ["seller-supplies", user?.id],
    enabled: !!user,
    queryFn: () => fetchSupplies(),
  });

  const items = Object.entries(qty)
    .map(([product_id, v]) => ({ product_id, quantity: Number(v) }))
    .filter((i) => Number.isFinite(i.quantity) && i.quantity > 0);

  const submit = useMutation({
    mutationFn: () =>
      create({ data: { supplied_at: date, comment: comment.trim() || undefined, items } }),
    onSuccess: (res) => {
      toast.success(`Поставка создана: ${res.items} позиц.`);
      setQty({});
      setComment("");
      qc.invalidateQueries({ queryKey: ["seller-supplies"] });
      onDone();
    },
    onError: (e: Error) => toast.error("Не удалось создать поставку", { description: e.message }),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <PackagePlus className="h-4 w-4" /> Новая поставка
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 rounded-xl border bg-background px-3 text-sm"
          />
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Комментарий (необязательно)"
            className="h-11 min-w-[200px] flex-1 rounded-xl border bg-background px-3 text-sm"
          />
        </div>

        <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.title}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  на складе: {r.stock}
                </div>
              </div>
              <input
                type="number"
                min={0}
                value={qty[r.id] ?? ""}
                onChange={(e) => setQty((p) => ({ ...p, [r.id]: e.target.value }))}
                placeholder="0"
                className="h-9 w-20 rounded-lg border bg-background px-2 text-sm tabular-nums"
              />
            </div>
          ))}
          {rows.length === 0 && (
            <div className="text-sm text-muted-foreground">Сначала добавьте товары.</div>
          )}
        </div>

        <button
          type="button"
          onClick={() => submit.mutate()}
          disabled={items.length === 0 || submit.isPending}
          className="mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-brand-foreground disabled:opacity-60"
        >
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
          Оприходовать ({items.reduce((s, i) => s + i.quantity, 0)} шт)
        </button>
      </Card>

      <Card>
        <div className="mb-3 text-sm font-bold">История поставок</div>
        {supplies.isLoading ? (
          <div className="text-sm text-muted-foreground">Загружаем…</div>
        ) : (supplies.data ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">Поставок пока не было.</div>
        ) : (
          <ul className="space-y-2">
            {(supplies.data ?? []).map((s) => (
              <li key={s.id} className="rounded-xl bg-surface p-3">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{new Date(s.supplied_at).toLocaleDateString("ru-RU")}</span>
                  <span className="tabular-nums">{s.total_qty} шт</span>
                </div>
                {s.comment && <div className="text-xs text-muted-foreground">{s.comment}</div>}
                <ul className="mt-1 text-xs text-muted-foreground">
                  {s.items.slice(0, 5).map((i, n) => (
                    <li key={`${s.id}-${n}`} className="truncate">
                      {i.title} — {i.quantity} шт
                    </li>
                  ))}
                  {s.items.length > 5 && <li>и ещё {s.items.length - 5}…</li>}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** История движений склада с фильтром по периоду и типу. */
function MovementsTab() {
  const { user } = useAuth();
  const fetchMovements = useServerFn(listStockMovements);
  const [days, setDays] = useState(30);
  const [kind, setKind] = useState<string>("");

  const movements = useQuery({
    queryKey: ["stock-movements", user?.id, days, kind],
    enabled: !!user,
    queryFn: () => fetchMovements({ data: { days, kind: kind || undefined } }),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {[7, 30, 90, 365].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`h-10 rounded-full px-4 text-sm font-semibold ui-transition ${
              days === d ? "bg-brand text-brand-foreground" : "border hover:bg-accent"
            }`}
          >
            {d} дн
          </button>
        ))}
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="h-10 rounded-full border bg-background px-3 text-sm"
        >
          <option value="">Все типы</option>
          {Object.entries(MOVEMENT_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {movements.isLoading ? (
        <Card className="text-sm text-muted-foreground">Загружаем историю…</Card>
      ) : (movements.data ?? []).length === 0 ? (
        <Card className="text-sm text-muted-foreground">
          <History className="mr-2 inline h-4 w-4" /> Движений за период нет.
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-card hairline">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-surface text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Дата</th>
                <th className="px-3 py-3">Товар</th>
                <th className="px-3 py-3">Тип</th>
                <th className="px-3 py-3">Изменение</th>
                <th className="px-3 py-3">Было → стало</th>
                <th className="px-3 py-3">Причина</th>
              </tr>
            </thead>
            <tbody>
              {(movements.data ?? []).map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString("ru-RU")}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-3">{m.title}</td>
                  <td className="px-3 py-3 text-xs">{MOVEMENT_LABEL[m.kind] ?? m.kind}</td>
                  <td
                    className={`px-3 py-3 font-bold tabular-nums ${m.delta >= 0 ? "text-emerald-700" : "text-destructive"}`}
                  >
                    {m.delta > 0 ? "+" : ""}
                    {m.delta}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {m.stock_before} → {m.stock_after}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-3 text-xs text-muted-foreground">
                    {m.reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Порог и канал уведомлений о низком остатке. */
function SettingsTab({
  threshold,
  channel,
  onDone,
}: {
  threshold: number;
  channel: string;
  onDone: () => void;
}) {
  const save = useServerFn(saveWarehouseSettings);
  const [value, setValue] = useState(String(threshold));
  const [ch, setCh] = useState(channel);

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          low_stock_threshold: Number(value) || 0,
          low_stock_channel: ch as "app" | "email" | "telegram",
        },
      }),
    onSuccess: () => {
      toast.success("Настройки сохранены");
      onDone();
    },
    onError: (e: Error) => toast.error("Не удалось сохранить", { description: e.message }),
  });

  return (
    <Card className="max-w-xl">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <Settings2 className="h-4 w-4" /> Уведомления о низком остатке
      </div>
      <label className="block text-xs font-semibold text-muted-foreground">
        Порог остатка (штук)
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm tabular-nums"
        />
      </label>
      <label className="mt-3 block text-xs font-semibold text-muted-foreground">
        Канал уведомлений
        <select
          value={ch}
          onChange={(e) => setCh(e.target.value)}
          className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm"
        >
          <option value="app">В приложении</option>
          <option value="email">Email</option>
          <option value="telegram">Telegram</option>
        </select>
      </label>
      <button
        type="button"
        onClick={() => mut.mutate()}
        disabled={mut.isPending}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-brand-foreground disabled:opacity-60"
      >
        {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Сохранить
      </button>
    </Card>
  );
}
