// Панель массовых операций над выбранными товарами продавца
// + импорт цен/остатков из CSV.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Percent, Boxes, Eye, EyeOff, Trash2, Tag, Upload, X, FileUp } from "lucide-react";
import {
  bulkUpdateProducts,
  importProductsCsv,
  type ImportRow,
} from "@/lib/seller/products-bulk.functions";

type Props = {
  selected: string[];
  categories: { id: string; name: string }[];
  onDone: () => void;
  onClear: () => void;
};

export function BulkBar({ selected, categories, onDone, onClear }: Props) {
  const bulk = useServerFn(bulkUpdateProducts);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"price" | "stock" | "category" | "badges" | null>(null);
  const [priceMode, setPriceMode] = useState<"percent" | "fixed">("percent");
  const [priceValue, setPriceValue] = useState("-10");
  const [stockMode, setStockMode] = useState<"set" | "add">("set");
  const [stockValue, setStockValue] = useState("10");
  const [categoryId, setCategoryId] = useState("");
  const [badges, setBadges] = useState<("hit" | "new")[]>([]);

  type BulkPayload = {
    ids: string[];
    action: "activate" | "deactivate" | "price" | "stock" | "category" | "delete" | "badges";
    price_mode?: "percent" | "fixed";
    value?: number;
    stock_mode?: "set" | "add";
    category_id?: string | null;
    badges?: ("hit" | "new")[];
  };

  const run = async (payload: BulkPayload) => {

    setBusy(true);
    try {
      const r = await bulk({ data: payload });
      toast.success(`Обновлено товаров: ${r.updated}`);
      setPanel(null);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось выполнить операцию");
    } finally {
      setBusy(false);
    }
  };

  if (selected.length === 0) return null;

  const btn =
    "inline-flex items-center gap-1.5 rounded-xl border bg-background px-3 h-9 text-xs font-semibold hover:bg-accent disabled:opacity-50";

  return (
    <div className="sticky bottom-3 z-20 mb-4 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold">Выбрано: {selected.length}</span>
        <button type="button" className={btn} disabled={busy} onClick={() => setPanel(panel === "price" ? null : "price")}>
          <Percent className="h-3.5 w-3.5" /> Цена
        </button>
        <button type="button" className={btn} disabled={busy} onClick={() => setPanel(panel === "stock" ? null : "stock")}>
          <Boxes className="h-3.5 w-3.5" /> Остаток
        </button>
        <button
          type="button"
          className={btn}
          disabled={busy}
          onClick={() => setPanel(panel === "category" ? null : "category")}
        >
          <Tag className="h-3.5 w-3.5" /> Категория
        </button>
        <button
          type="button"
          className={btn}
          disabled={busy}
          onClick={() => setPanel(panel === "badges" ? null : "badges")}
        >
          <Tag className="h-3.5 w-3.5" /> Метки
        </button>
        <button type="button" className={btn} disabled={busy} onClick={() => run({ ids: selected, action: "activate" })}>
          <Eye className="h-3.5 w-3.5" /> Включить
        </button>
        <button
          type="button"
          className={btn}
          disabled={busy}
          onClick={() => run({ ids: selected, action: "deactivate" })}
        >
          <EyeOff className="h-3.5 w-3.5" /> Скрыть
        </button>
        <button
          type="button"
          className={`${btn} border-destructive/30 text-destructive hover:bg-destructive/10`}
          disabled={busy}
          onClick={() => {
            if (confirm(`Удалить ${selected.length} товаров? Действие необратимо.`)) {
              run({ ids: selected, action: "delete" });
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Удалить
        </button>
        <button type="button" onClick={onClear} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
          Снять выделение
        </button>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      </div>

      {panel === "price" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <select
            value={priceMode}
            onChange={(e) => setPriceMode(e.target.value as "percent" | "fixed")}
            className="h-9 rounded-xl border bg-background px-2 text-xs"
          >
            <option value="percent">Изменить на %</option>
            <option value="fixed">Установить цену, ₽</option>
          </select>
          <input
            value={priceValue}
            onChange={(e) => setPriceValue(e.target.value)}
            inputMode="numeric"
            className="h-9 w-28 rounded-xl border bg-background px-3 text-xs"
          />
          <span className="text-[11px] text-muted-foreground">
            {priceMode === "percent"
              ? "минус — скидка, старая цена сохранится зачёркнутой"
              : "цена в рублях для всех выбранных"}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const n = parseFloat(priceValue.replace(",", "."));
              if (!Number.isFinite(n)) return toast.error("Введите число");
              run({
                ids: selected,
                action: "price",
                price_mode: priceMode,
                value: priceMode === "percent" ? Math.round(n) : Math.round(n * 100),
              });
            }}
            className="h-9 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground"
          >
            Применить
          </button>
        </div>
      ) : null}

      {panel === "stock" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <select
            value={stockMode}
            onChange={(e) => setStockMode(e.target.value as "set" | "add")}
            className="h-9 rounded-xl border bg-background px-2 text-xs"
          >
            <option value="set">Установить</option>
            <option value="add">Прибавить</option>
          </select>
          <input
            value={stockValue}
            onChange={(e) => setStockValue(e.target.value)}
            inputMode="numeric"
            className="h-9 w-24 rounded-xl border bg-background px-3 text-xs"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const n = parseInt(stockValue, 10);
              if (!Number.isFinite(n)) return toast.error("Введите число");
              run({ ids: selected, action: "stock", stock_mode: stockMode, value: n });
            }}
            className="h-9 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground"
          >
            Применить
          </button>
        </div>
      ) : null}

      {panel === "category" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-9 rounded-xl border bg-background px-2 text-xs"
          >
            <option value="">Без категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ ids: selected, action: "category", category_id: categoryId || null })}
            className="h-9 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground"
          >
            Применить
          </button>
        </div>
      ) : null}

      {panel === "badges" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          {(["hit", "new"] as const).map((b) => (
            <label key={b} className="inline-flex items-center gap-1.5 text-xs font-medium">
              <input
                type="checkbox"
                checked={badges.includes(b)}
                onChange={(e) =>
                  setBadges((prev) => (e.target.checked ? [...prev, b] : prev.filter((x) => x !== b)))
                }
              />
              {b === "hit" ? "Хит" : "Новинка"}
            </label>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ ids: selected, action: "badges", badges })}
            className="h-9 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground"
          >
            Применить
          </button>
          <span className="text-[11px] text-muted-foreground">Пустой выбор снимет все метки</span>
        </div>
      ) : null}
    </div>
  );
}

/** Импорт цен и остатков из CSV с предпросмотром изменений. */
export function ImportCsvDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const importCsv = useServerFn(importProductsCsv);
  const [content, setContent] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = async (text: string) => {
    setContent(text);
    setBusy(true);
    try {
      const r = await importCsv({ data: { content: text, apply: false } });
      setRows(r.rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось прочитать файл");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    try {
      const r = await importCsv({ data: { content, apply: true } });
      toast.success(`Обновлено товаров: ${r.applied}`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось применить импорт");
    } finally {
      setBusy(false);
    }
  };

  const bad = rows?.filter((r) => r.error).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-t-3xl bg-card p-5 md:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold">Импорт цен и остатков (CSV)</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-accent" aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Выгрузите товары в CSV на странице аналитики, измените колонки «Цена, ₽» и «Остаток», затем
          загрузите файл обратно. Колонка <b>id</b> обязательна.
        </p>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed p-6 text-sm font-semibold hover:bg-accent">
          <FileUp className="h-4 w-4" />
          Выбрать CSV-файл
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 2_000_000) return toast.error("Файл больше 2 МБ");
              await preview(await f.text());
            }}
          />
        </label>

        {busy ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Обработка…
          </div>
        ) : null}

        {rows ? (
          <div className="mt-4">
            <div className="mb-2 text-xs text-muted-foreground">
              Строк: {rows.length}
              {bad > 0 ? ` · с ошибками: ${bad} (будут пропущены)` : ""}
            </div>
            <div className="max-h-64 overflow-auto rounded-xl border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="p-2 text-left">Товар</th>
                    <th className="p-2 text-right">Цена</th>
                    <th className="p-2 text-right">Остаток</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={`border-t ${r.error ? "bg-destructive/5 text-destructive" : ""}`}>
                      <td className="p-2">{r.error ? `${r.id} — ${r.error}` : r.title}</td>
                      <td className="p-2 text-right tabular-nums">
                        {r.price === null ? "—" : `${r.currentPrice} → ${r.price}`}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {r.stock === null ? "—" : `${r.currentStock} → ${r.stock}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={apply}
              disabled={busy || rows.length === bad}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Upload className="h-4 w-4" /> Применить изменения
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
