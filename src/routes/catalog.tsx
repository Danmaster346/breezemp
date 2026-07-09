// Каталог: умный поиск + расширенные фильтры + сортировка. Всё состояние в URL.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/ProductCard";
import { CatalogSearchBar } from "@/components/CatalogSearchBar";
import { formatPrice } from "@/lib/format";
import {
  searchCatalog,
  listCatalogSellers,
} from "@/lib/catalog-search.functions";
import {
  Search,
  SlidersHorizontal,
  X,
  Star,
  PackageCheck,
  Store,
  RotateCcw,
} from "lucide-react";

const SORT_OPTIONS = [
  { key: "relevance", label: "По релевантности" },
  { key: "popular", label: "По популярности" },
  { key: "rating", label: "По рейтингу" },
  { key: "new", label: "Сначала новые" },
  { key: "price_asc", label: "Сначала дешёвые" },
  { key: "price_desc", label: "Сначала дорогие" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];
const SORT_KEYS = SORT_OPTIONS.map((s) => s.key) as [SortKey, ...SortKey[]];

const RATING_OPTIONS = [0, 3, 4, 4.5] as const;

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  min: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
  rating: z.coerce.number().optional(),
  seller: z.string().optional(),
  in_stock: z.coerce.boolean().optional(),
  sort: z.enum(SORT_KEYS).optional().default("relevance"),
});
type SearchParams = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/catalog")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Каталог — BreezeMarket" },
      {
        name: "description",
        content: "Умный поиск по товарам, продавцам и категориям маркетплейса BREEZE.",
      },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const doSearch = useServerFn(searchCatalog);
  const loadSellers = useServerFn(listCatalogSellers);

  const upd = (patch: Partial<SearchParams>) =>
    navigate({ search: (prev: SearchParams) => ({ ...prev, ...patch }) });

  // Локальные значения цены — применяем по blur/Enter
  const [minInput, setMinInput] = useState(search.min?.toString() ?? "");
  const [maxInput, setMaxInput] = useState(search.max?.toString() ?? "");
  useEffect(() => setMinInput(search.min?.toString() ?? ""), [search.min]);
  useEffect(() => setMaxInput(search.max?.toString() ?? ""), [search.max]);
  const applyPrice = () => {
    const min = minInput ? Number(minInput) : undefined;
    const max = maxInput ? Number(maxInput) : undefined;
    upd({
      min: Number.isFinite(min) && min ? min : undefined,
      max: Number.isFinite(max) && max ? max : undefined,
    });
  };

  const catsQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await supabase.from("categories").select("*").order("name")).data ?? [],
  });

  const sellersQuery = useQuery({
    queryKey: ["catalog-sellers"],
    queryFn: () => loadSellers(),
  });

  const productsQuery = useQuery({
    queryKey: ["catalog", search],
    queryFn: () =>
      doSearch({
        data: {
          q: search.q || undefined,
          category: search.category || undefined,
          min: search.min || undefined,
          max: search.max || undefined,
          min_rating: search.rating || undefined,
          seller_id: search.seller || undefined,
          in_stock: search.in_stock || undefined,
          sort: (search.sort ?? "relevance") as SortKey,
        },
      }),
  });

  const items = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
  const hasFilters = Boolean(
    search.q ||
      search.category ||
      search.min ||
      search.max ||
      search.rating ||
      search.seller ||
      search.in_stock,
  );

  const resetAll = () =>
    navigate({ search: { sort: search.sort } as SearchParams });

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-4">Каталог товаров</h1>

        {/* Поиск с автодополнением */}
        <div className="mb-4">
          <CatalogSearchBar
            value={search.q ?? ""}
            onSubmit={(v: string) => upd({ q: v || undefined })}
          />
        </div>

        {/* Категории */}
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

        {/* Панель фильтров */}
        <div className="rounded-2xl border border-border bg-white p-3 md:p-4 mb-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-foreground/80 mr-1">
              <SlidersHorizontal className="h-4 w-4" /> Фильтры
            </div>

            {/* Цена */}
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Цена от"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                onBlur={applyPrice}
                onKeyDown={(e) => e.key === "Enter" && applyPrice()}
                className="w-24 sm:w-28 h-10 px-3 rounded-xl border border-border bg-surface text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
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
                className="w-24 sm:w-28 h-10 px-3 rounded-xl border border-border bg-surface text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
              />
            </div>

            {/* Рейтинг */}
            <label className="relative">
              <span className="sr-only">Рейтинг</span>
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-amber-400">
                <Star className="h-4 w-4 fill-amber-400" />
              </div>
              <select
                value={search.rating ?? 0}
                onChange={(e) =>
                  upd({
                    rating: Number(e.target.value) || undefined,
                  })
                }
                className="h-10 pl-8 pr-3 rounded-xl border border-border bg-surface text-sm outline-none focus:border-brand cursor-pointer"
              >
                {RATING_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r === 0 ? "Любой рейтинг" : `от ${r} ★`}
                  </option>
                ))}
              </select>
            </label>

            {/* Продавец */}
            <label className="relative">
              <span className="sr-only">Продавец</span>
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand">
                <Store className="h-4 w-4" />
              </div>
              <select
                value={search.seller ?? ""}
                onChange={(e) => upd({ seller: e.target.value || undefined })}
                className="h-10 pl-8 pr-3 rounded-xl border border-border bg-surface text-sm outline-none focus:border-brand cursor-pointer max-w-[220px]"
              >
                <option value="">Все продавцы</option>
                {sellersQuery.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.products_count})
                  </option>
                ))}
              </select>
            </label>

            {/* Наличие */}
            <button
              type="button"
              onClick={() => upd({ in_stock: search.in_stock ? undefined : true })}
              className={`h-10 inline-flex items-center gap-1.5 px-3 rounded-xl border text-sm font-medium transition ${
                search.in_stock
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border bg-surface text-foreground/80 hover:border-brand/50"
              }`}
            >
              <PackageCheck className="h-4 w-4" /> Только в наличии
            </button>

            {/* Сортировка */}
            <label className="flex items-center gap-2 ml-auto text-sm">
              <span className="text-muted-foreground hidden sm:inline">Сортировка:</span>
              <select
                value={search.sort ?? "relevance"}
                onChange={(e) => upd({ sort: e.target.value as SortKey })}
                className="h-10 px-3 rounded-xl border border-border bg-surface text-sm outline-none focus:border-brand cursor-pointer"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Активные фильтры + сброс */}
          {hasFilters && (
            <div className="mt-3 pt-3 border-t border-border/70 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Активные:
              </span>
              {search.q && (
                <FilterChip label={`«${search.q}»`} onClear={() => upd({ q: undefined })} />
              )}
              {search.category && (
                <FilterChip
                  label={
                    catsQuery.data?.find((c) => c.slug === search.category)?.name ??
                    search.category
                  }
                  onClear={() => upd({ category: undefined })}
                />
              )}
              {(search.min || search.max) && (
                <FilterChip
                  label={`${search.min ? formatPrice(search.min * 100) : "0"} — ${search.max ? formatPrice(search.max * 100) : "∞"}`}
                  onClear={() => upd({ min: undefined, max: undefined })}
                />
              )}
              {search.rating && (
                <FilterChip
                  label={`от ${search.rating} ★`}
                  onClear={() => upd({ rating: undefined })}
                />
              )}
              {search.seller && (
                <FilterChip
                  label={
                    sellersQuery.data?.find((s) => s.id === search.seller)?.name ??
                    "Продавец"
                  }
                  onClear={() => upd({ seller: undefined })}
                />
              )}
              {search.in_stock && (
                <FilterChip
                  label="В наличии"
                  onClear={() => upd({ in_stock: undefined })}
                />
              )}
              <button
                type="button"
                onClick={resetAll}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand/10 text-brand px-3 py-1.5 text-xs font-semibold hover:bg-brand hover:text-brand-foreground transition"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Сбросить все фильтры
              </button>
            </div>
          )}
        </div>

        {/* Счётчик */}
        <div className="mb-3 text-sm text-muted-foreground">
          {productsQuery.isLoading
            ? "Ищем товары…"
            : total > 0
              ? `Найдено товаров: ${total}`
              : "Ничего не найдено"}
        </div>

        {/* Сетка */}
        {productsQuery.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-white overflow-hidden animate-pulse"
              >
                <div className="aspect-square bg-surface-strong" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-3/4 bg-surface-strong rounded" />
                  <div className="h-4 w-1/2 bg-surface-strong rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 animate-fade-in">
            {items.map((p) => (
              <div key={p.id} className="flex flex-col">
                <ProductCard {...p} />
                {(p.reviews_count > 0 || p.seller_name) && (
                  <div className="px-1 pt-1 pb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <Link
                      to="/seller/$id"
                      params={{ id: p.seller_id }}
                      onClick={(e) => e.stopPropagation()}
                      className="truncate hover:text-brand transition"
                    >
                      {p.seller_name}
                    </Link>
                    {p.reviews_count > 0 && (
                      <span className="inline-flex items-center gap-0.5 shrink-0">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="font-semibold text-foreground/80">
                          {p.rating.toFixed(1)}
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-white p-10 md:p-16 text-center animate-fade-in">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
              <Search className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold mb-1">Ничего не найдено</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Попробуйте изменить фильтры или запрос.
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-1 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 shadow-sm transition"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface pl-3 pr-1 py-1 text-xs font-medium text-foreground/80">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="grid place-items-center h-5 w-5 rounded-full hover:bg-white text-muted-foreground hover:text-destructive transition"
        aria-label="Убрать фильтр"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
