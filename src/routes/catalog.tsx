// Общий каталог товаров с поиском, фильтрами и сортировкой
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/ProductCard";
import { Search, SlidersHorizontal, X } from "lucide-react";

// Возможные варианты сортировки
const SORTS = {
  new: { label: "Сначала новые", column: "created_at", asc: false },
  price_asc: { label: "Сначала дешёвые", column: "price_kopecks", asc: true },
  price_desc: { label: "Сначала дорогие", column: "price_kopecks", asc: false },
} as const;
type SortKey = keyof typeof SORTS;

// Схема параметров поиска в URL
const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  min: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
  sort: z
    .enum(["new", "price_asc", "price_desc"])
    .optional()
    .default("new"),
});
type SearchParams = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/catalog")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Каталог — BreezeMarket" },
      { name: "description", content: "Каталог товаров всех продавцов маркетплейса." },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  // Локальный ввод поиска с задержкой (debounce), чтобы не бить по БД на каждую букву
  const [qInput, setQInput] = useState(search.q ?? "");
  useEffect(() => {
    // Синхронизация при внешних изменениях URL (например, «Сбросить»)
    setQInput(search.q ?? "");
  }, [search.q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if ((qInput || undefined) !== search.q) upd({ q: qInput || undefined });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  // Локальные значения цены — применяем по blur/Enter, а не на каждый ввод
  const [minInput, setMinInput] = useState<string>(search.min?.toString() ?? "");
  const [maxInput, setMaxInput] = useState<string>(search.max?.toString() ?? "");
  useEffect(() => setMinInput(search.min?.toString() ?? ""), [search.min]);
  useEffect(() => setMaxInput(search.max?.toString() ?? ""), [search.max]);

  const catsQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await supabase.from("categories").select("*").order("name")).data ?? [],
  });

  const productsQuery = useQuery({
    queryKey: ["catalog", search],
    queryFn: async () => {
      const sort = SORTS[search.sort ?? "new"];
      let q = supabase
        .from("products")
        .select(
          "id,title,price_kopecks,image_url,stock,category_id,categories(slug)",
          { count: "exact" },
        )
        .eq("is_active", true)
        .order(sort.column, { ascending: sort.asc })
        .limit(120);

      if (search.q) {
        // Поиск по названию И описанию
        const safe = search.q.replace(/[%,]/g, " ").trim();
        if (safe) q = q.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
      }
      if (search.category) {
        const cat = catsQuery.data?.find((c) => c.slug === search.category);
        if (cat) q = q.eq("category_id", cat.id);
      }
      if (search.min) q = q.gte("price_kopecks", search.min * 100);
      if (search.max) q = q.lte("price_kopecks", search.max * 100);

      const { data, error, count } = await q;
      if (error) throw error;
      return { items: data ?? [], count: count ?? data?.length ?? 0 };
    },
    enabled: !catsQuery.isLoading,
  });

  // Обновление URL-параметров
  const upd = (patch: Partial<SearchParams>) =>
    navigate({ search: (prev: SearchParams) => ({ ...prev, ...patch }) });

  // Применить ценовые фильтры
  const applyPrice = () => {
    const min = minInput ? Number(minInput) : undefined;
    const max = maxInput ? Number(maxInput) : undefined;
    upd({
      min: Number.isFinite(min) && min ? min : undefined,
      max: Number.isFinite(max) && max ? max : undefined,
    });
  };

  const hasFilters = Boolean(
    search.q || search.category || search.min || search.max,
  );
  const items = productsQuery.data?.items ?? [];
  const count = productsQuery.data?.count ?? 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-4">Каталог товаров</h1>

        {/* Поисковая строка */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Поиск по названию и описанию..."
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") upd({ q: qInput || undefined });
            }}
            className="w-full h-12 pl-10 pr-10 rounded-xl border bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {qInput && (
            <button
              type="button"
              onClick={() => setQInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-accent text-muted-foreground"
              aria-label="Очистить"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Чипы категорий */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4">
          <button
            onClick={() => upd({ category: undefined })}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
              !search.category
                ? "bg-primary text-primary-foreground"
                : "bg-secondary hover:bg-accent"
            }`}
          >
            Все
          </button>
          {catsQuery.data?.map((c) => (
            <button
              key={c.id}
              onClick={() => upd({ category: c.slug })}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
                search.category === c.slug
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-accent"
              }`}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        {/* Панель фильтров + сортировки */}
        <div className="rounded-2xl border bg-card p-3 mb-4 flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground ml-1 hidden sm:block" />

          {/* Цена */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="Цена от"
              value={minInput}
              onChange={(e) => setMinInput(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => e.key === "Enter" && applyPrice()}
              className="w-24 sm:w-28 h-10 px-3 rounded-lg border bg-background text-sm"
            />
            <span className="text-muted-foreground">—</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="до, ₽"
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => e.key === "Enter" && applyPrice()}
              className="w-24 sm:w-28 h-10 px-3 rounded-lg border bg-background text-sm"
            />
          </div>

          {/* Сортировка */}
          <label className="flex items-center gap-2 ml-auto text-sm">
            <span className="text-muted-foreground hidden sm:inline">Сортировка:</span>
            <select
              value={search.sort ?? "new"}
              onChange={(e) => upd({ sort: e.target.value as SortKey })}
              className="h-10 px-3 rounded-lg border bg-background text-sm"
            >
              {(Object.entries(SORTS) as [SortKey, (typeof SORTS)[SortKey]][]).map(
                ([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ),
              )}
            </select>
          </label>

          {/* Сброс */}
          {hasFilters && (
            <Link
              to="/catalog"
              search={{ sort: search.sort }}
              className="h-10 inline-flex items-center gap-1 px-3 rounded-lg text-sm text-muted-foreground hover:bg-accent"
            >
              <X className="h-3.5 w-3.5" /> Сбросить
            </Link>
          )}
        </div>

        {/* Счётчик найденного */}
        <div className="mb-3 text-sm text-muted-foreground">
          {productsQuery.isLoading
            ? "Ищем товары..."
            : `Найдено товаров: ${count}`}
        </div>

        {/* Сетка товаров */}
        {productsQuery.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-2xl bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {items.map((p) => (
              <ProductCard key={p.id} {...p} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-10 text-center">
            <p className="text-muted-foreground mb-3">
              Ничего не найдено. Попробуйте изменить фильтры.
            </p>
            {hasFilters && (
              <Link
                to="/catalog"
                className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Сбросить фильтры
              </Link>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
