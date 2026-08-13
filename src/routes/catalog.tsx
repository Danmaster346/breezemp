// Каталог: умный поиск + расширенные фильтры + сортировка. Всё состояние в URL.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { AppLayout } from "@/components/AppLayout";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProductCard } from "@/components/ProductCard";
import { CatalogSearchBar } from "@/components/CatalogSearchBar";
import { BottomSheet } from "@/components/BottomSheet";
import { formatPrice } from "@/lib/format";
import { getCategoryEmoji } from "@/lib/category-emoji";
import { categoriesQueryOptions } from "@/lib/categories-query";
import { ProductGridSkeleton } from "@/components/Skeletons";
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
  ArrowUpDown,
  Tag,
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
  discount: z.coerce.boolean().optional(),
  sort: z.enum(SORT_KEYS).optional(),
  page: z.coerce.number().int().min(1).optional(),
});
type SearchParams = z.infer<typeof searchSchema>;

const PAGE_SIZE = 20;
const SORT_STORAGE_KEY = "kupiks:catalog-sort";


const SITE_URL = "https://kupiks-marketplace.ru";

export const Route = createFileRoute("/catalog")({
  validateSearch: (s) => searchSchema.parse(s),
  // Мета-данные зависят от выбранной категории, поискового запроса и страницы
  loaderDeps: ({ search }) => ({
    category: search.category,
    q: search.q,
    page: search.page,
    hasFilters: Boolean(
      search.min || search.max || search.rating || search.seller || search.in_stock || search.discount,
    ),
  }),
  loader: async ({ deps, context }) => {
    let categoryName: string | null = null;
    let categorySlug: string | null = null;
    if (deps.category) {
      const cats = await context.queryClient
        .ensureQueryData(categoriesQueryOptions())
        .catch(() => null);
      const found = cats?.find((c) => c.slug === deps.category);
      categoryName = found?.name ?? null;
      categorySlug = found?.slug ?? null;
    }
    return {
      categoryName,
      categorySlug,
      q: deps.q ?? null,
      page: deps.page ?? 1,
      hasFilters: deps.hasFilters,
    };
  },
  head: ({ loaderData }) => {
    const catName = loaderData?.categoryName ?? null;
    const slug = loaderData?.categorySlug ?? null;
    const q = loaderData?.q ?? null;
    const page = loaderData?.page ?? 1;
    const hasFilters = loaderData?.hasFilters ?? false;

    // Заголовок и описание строим по выбранной категории / запросу
    const pageSuffix = page > 1 ? ` — страница ${page}` : "";
    const title = catName
      ? `${catName} — купить с доставкой${pageSuffix} | Kupiks`
      : q
        ? `Поиск «${q}» в каталоге${pageSuffix} | Kupiks`
        : `Каталог товаров${pageSuffix} — Kupiks`;
    const description = catName
      ? `${catName} на Kupiks: подборка проверенных предложений с доставкой по России. Фильтры по цене, рейтингу, наличию и скидкам, отзывы покупателей.`
      : q
        ? `Результаты поиска «${q}» в каталоге Kupiks: цены, рейтинги продавцов и доставка по России.`
        : "Умный поиск по товарам, продавцам и категориям маркетплейса Kupiks: фильтры по цене, рейтингу, наличию и скидкам.";

    // Canonical всегда указывает на чистый URL категории (без фильтров и пагинации)
    const canonical = slug
      ? `${SITE_URL}/catalog?category=${encodeURIComponent(slug)}`
      : `${SITE_URL}/catalog`;

    // Страницы с поиском, фильтрами и пагинацией не индексируем, но ссылки обходим
    const noindex = Boolean(q) || hasFilters || page > 1;

    const breadcrumbs = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Каталог", item: `${SITE_URL}/catalog` },
        ...(catName && slug
          ? [{ "@type": "ListItem", position: 3, name: catName, item: canonical }]
          : []),
      ],
    };

    return {
      meta: [
        { title },
        { name: "description", content: description },
        ...(catName ? [{ name: "keywords", content: `${catName}, купить ${catName.toLowerCase()}, Kupiks, маркетплейс` }] : []),
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        { property: "og:site_name", content: "Kupiks" },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(noindex ? [{ name: "robots", content: "noindex,follow" }] : []),
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: catName ?? "Каталог товаров",
            description,
            url: canonical,
            isPartOf: { "@type": "WebSite", name: "Kupiks", url: SITE_URL },
          }),
        },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbs) },
      ],
    };
  },

  component: CatalogPage,
});


function CatalogPage() {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);

  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const doSearch = useServerFn(searchCatalog);
  const loadSellers = useServerFn(listCatalogSellers);

  const upd = (patch: Partial<SearchParams>) => {
    // Запоминаем сортировку между визитами
    if (patch.sort && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(SORT_STORAGE_KEY, patch.sort);
      } catch {
        /* приватный режим — игнорируем */
      }
    }
    navigate({
      search: (prev: SearchParams) => ({
        ...prev,
        ...patch,
        // Любое изменение фильтров сбрасывает страницу; сам page можно менять явно
        page: "page" in patch ? patch.page : 1,
      }),
    });
  };

  // При первом визите без sort в URL — применяем сохранённую сортировку
  useEffect(() => {
    if (search.sort) return;
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(SORT_STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (!saved || !SORT_KEYS.includes(saved as SortKey) || saved === "relevance") return;
    navigate({
      search: (prev: SearchParams) => ({ ...prev, sort: saved as SortKey, page: 1 }),
      replace: true,
      resetScroll: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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

  const catsQuery = useQuery(categoriesQueryOptions());

  const sellersQuery = useQuery({
    queryKey: ["catalog-sellers"],
    queryFn: () => loadSellers(),
    staleTime: 30 * 60 * 1000,
  });

  // Ключ без page — датасет один, страницы нарезаются на клиенте
  const queryKey = {
    q: search.q,
    category: search.category,
    min: search.min,
    max: search.max,
    rating: search.rating,
    seller: search.seller,
    in_stock: search.in_stock,
    discount: search.discount,
    sort: search.sort,
  };
  const productsQuery = useQuery({
    queryKey: ["catalog", queryKey],
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
          discount: search.discount || undefined,
          sort: (search.sort ?? "relevance") as SortKey,
          limit: 120,
        },
      }),
    placeholderData: (prev) => prev,
    // Товары считаем свежими 5 минут — повторный вход в каталог мгновенный
    staleTime: 5 * 60 * 1000,
  });

  const allItems = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
  const page = search.page ?? 1;
  const visibleCount = Math.min(page * PAGE_SIZE, allItems.length);
  const items = allItems.slice(0, visibleCount);
  const hasMore = visibleCount < allItems.length;

  // Infinite scroll — подгружаем следующую страницу при появлении сентинела
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore || productsQuery.isLoading) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          navigate({
            search: (prev: SearchParams) => ({ ...prev, page: (prev.page ?? 1) + 1 }),
            replace: true,
            resetScroll: false,
          });
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, productsQuery.isLoading, navigate, page]);

  const loadMore = useCallback(
    () =>
      navigate({
        search: (prev: SearchParams) => ({ ...prev, page: (prev.page ?? 1) + 1 }),
        replace: true,
        resetScroll: false,
      }),
    [navigate],
  );

  const hasFilters = Boolean(
    search.q ||
      search.category ||
      search.min ||
      search.max ||
      search.rating ||
      search.seller ||
      search.in_stock ||
      search.discount,
  );

  const resetAll = () =>
    navigate({ search: { sort: search.sort, page: 1 } as SearchParams });

  const activeCat = catsQuery.data?.find((c) => c.slug === search.category);
  const qcRefresh = useQueryClient();

  return (
    <AppLayout>
     <PullToRefresh onRefresh={() => qcRefresh.refetchQueries({ type: "active" })}>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Breadcrumbs
          items={
            activeCat
              ? [{ label: "Каталог", to: "/catalog" }, { label: activeCat.name }]
              : [{ label: "Каталог" }]
          }
          className="mb-4"
        />
        {/* Hero-header каталога */}
        <div className="mb-5">
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
                {activeCat ? activeCat.name : search.q ? `Поиск: «${search.q}»` : "Каталог"}
              </h1>

              <p className="text-sm text-muted-foreground mt-1">
                {productsQuery.isLoading
                  ? "Ищем товары…"
                  : total > 0
                    ? `${total.toLocaleString("ru-RU")} ${plural(total, ["товар", "товара", "товаров"])} найдено`
                    : "Пока ничего не найдено"}
              </p>
            </div>
          </div>

          {/* Поиск с автодополнением */}
          <CatalogSearchBar
            value={search.q ?? ""}
            onSubmit={(v: string) => upd({ q: v || undefined })}
          />
        </div>

        {/* Категории — круглые плитки Askona-style */}
        <div className="mb-5 -mx-4 px-4">
          <div className="flex gap-3 md:gap-4 overflow-x-auto no-scrollbar pb-2">
            <CategoryTile
              active={!search.category}
              onClick={() => upd({ category: undefined })}
              label="Все"
              emoji="✨"
            />
            {catsQuery.data?.map((c) => (
              <CategoryTile
                key={c.id}
                active={search.category === c.slug}
                onClick={() => upd({ category: c.slug })}
                label={c.name}
                emoji={getCategoryEmoji(c.slug, c.name)}
                imageUrl={c.icon_url}
              />
            ))}
          </div>
        </div>

        {/* Мобильная панель: 2 кнопки — фильтры и сортировка */}
        <div className="md:hidden flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className={`flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${
              hasFilters
                ? "border-brand bg-brand/10 text-brand"
                : "border-border bg-white text-foreground/80"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Фильтры
            {hasFilters && (
              <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-brand text-brand-foreground text-[11px] font-bold grid place-items-center">
                {[
                  search.category,
                  search.min,
                  search.max,
                  search.rating,
                  search.seller,
                  search.in_stock,
                  search.discount,
                ].filter(Boolean).length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileSortOpen(true)}
            className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm font-semibold text-foreground/80"
          >
            <ArrowUpDown className="h-4 w-4" />
            {SORT_OPTIONS.find((s) => s.key === (search.sort ?? "relevance"))?.label ?? "Сортировка"}
          </button>
        </div>

        {/* Панель фильтров (desktop) */}
        <div className="hidden md:block rounded-2xl border border-border bg-white p-3 md:p-4 mb-4 shadow-sm">

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

            <button
              type="button"
              onClick={() => upd({ discount: search.discount ? undefined : true })}
              className={`h-10 px-4 inline-flex items-center gap-2 rounded-xl border text-sm font-semibold transition ${
                search.discount
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border bg-white text-foreground/80 hover:border-brand/50"
              }`}
            >
              <Tag className="h-4 w-4" /> Со скидкой
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
              {search.discount && (
                <FilterChip
                  label="Со скидкой"
                  onClear={() => upd({ discount: undefined })}
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

        {/* Быстрая сортировка (chips) */}
        <div className="mb-4 -mx-4 px-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {SORT_OPTIONS.map((s) => {
              const active = (search.sort ?? "relevance") === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => upd({ sort: s.key })}
                  className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold transition border ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-white text-foreground/75 border-border hover:border-foreground/40"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>


        {/* Счётчик результатов */}
        <div className="mb-3">
          {productsQuery.isLoading ? (
            <div className="h-4 w-40 rounded bg-muted animate-pulse" />
          ) : (
            <div className="text-xs text-muted-foreground">
              Найдено {total.toLocaleString("ru-RU")}{" "}
              {plural(total, ["товар", "товара", "товаров"])}
            </div>
          )}
        </div>

        {/* Сетка */}
        {productsQuery.isLoading ? (

          <ProductGridSkeleton count={10} />
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 animate-fade-in">
            {items.map((p, i) => (
              <div key={p.id} className="flex flex-col">
                <ProductCard {...p} priority={i < 5} />
                {p.seller_name && (
                  <div className="px-1 pt-1 pb-2 text-[11px] text-muted-foreground">
                    <Link
                      to="/seller/$id"
                      params={{ id: p.seller_id }}
                      onClick={(e) => e.stopPropagation()}
                      className="truncate hover:text-brand transition"
                    >
                      {p.seller_name}
                    </Link>
                  </div>
                )}

              </div>
            ))}
          </div>
        ) : null}

        {/* Infinite scroll sentinel + fallback-кнопка */}
        {!productsQuery.isLoading && items.length > 0 && hasMore && (
          <>
            <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="w-full">
                <ProductGridSkeleton count={5} />
              </div>
              <button
                type="button"
                onClick={loadMore}
                className="inline-flex items-center gap-2 rounded-full bg-white border border-border px-6 py-3 text-sm font-semibold text-foreground/80 hover:border-brand hover:text-brand transition shadow-sm"
              >
                Показать ещё
              </button>
            </div>
          </>
        )}

        {!productsQuery.isLoading && items.length > 0 && !hasMore && total > PAGE_SIZE && (
          <div className="mt-8 text-center text-sm text-muted-foreground">
            Показаны все {total.toLocaleString("ru-RU")} {plural(total, ["товар", "товара", "товаров"])}
          </div>
        )}

        {!productsQuery.isLoading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-white p-10 md:p-16 text-center animate-fade-in">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
              <Search className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold mb-1">
              {search.q ? `По запросу «${search.q}» ничего не найдено` : "Ничего не найдено"}
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Попробуйте изменить запрос или посмотрите популярные категории.
            </p>

            {/* Популярные категории */}
            {(catsQuery.data?.length ?? 0) > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-5">
                {catsQuery.data!.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => upd({ q: undefined, category: c.slug })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground/80 hover:border-brand hover:text-brand transition"
                  >
                    <span aria-hidden>{getCategoryEmoji(c.slug, c.name)}</span>
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {hasFilters && (
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 shadow-sm transition"
              >
                <RotateCcw className="h-4 w-4" /> Сбросить фильтры
              </button>
            )}
          </div>
        )}

      </div>

      {/* Мобильный Bottom Sheet: фильтры */}
      <BottomSheet
        open={mobileFiltersOpen}
        onOpenChange={setMobileFiltersOpen}
        title="Фильтры"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                resetAll();
                setMobileFiltersOpen(false);
              }}
              className="flex-1 h-12 rounded-xl border border-border font-semibold text-foreground/80"
            >
              Сбросить
            </button>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="flex-[2] h-12 rounded-xl bg-brand text-brand-foreground font-semibold"
            >
              Показать {total > 0 ? total : ""}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <div className="text-sm font-semibold mb-2">Цена, ₽</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                placeholder="от"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                onBlur={applyPrice}
                className="w-full h-12 px-3 rounded-xl border border-border bg-surface text-base"
              />
              <span className="text-muted-foreground">—</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="до"
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                onBlur={applyPrice}
                className="w-full h-12 px-3 rounded-xl border border-border bg-surface text-base"
              />
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">Рейтинг</div>
            <div className="grid grid-cols-4 gap-2">
              {RATING_OPTIONS.map((r) => {
                const active = (search.rating ?? 0) === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => upd({ rating: r || undefined })}
                    className={`h-11 rounded-xl border text-sm font-medium transition ${
                      active
                        ? "border-brand bg-brand text-brand-foreground"
                        : "border-border bg-white"
                    }`}
                  >
                    {r === 0 ? "Любой" : `${r}★+`}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Store className="h-4 w-4 text-brand" /> Продавец
            </div>
            <select
              value={search.seller ?? ""}
              onChange={(e) => upd({ seller: e.target.value || undefined })}
              className="w-full h-12 px-3 rounded-xl border border-border bg-surface text-base"
            >
              <option value="">Все продавцы</option>
              {sellersQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.products_count})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => upd({ in_stock: search.in_stock ? undefined : true })}
            className={`w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl border font-semibold transition ${
              search.in_stock
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border bg-white text-foreground/80"
            }`}
          >
            <PackageCheck className="h-4 w-4" /> Только в наличии
          </button>

          <button
            type="button"
            onClick={() => upd({ discount: search.discount ? undefined : true })}
            className={`w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl border font-semibold transition ${
              search.discount
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border bg-white text-foreground/80"
            }`}
          >
            <Tag className="h-4 w-4" /> Только со скидкой
          </button>
        </div>
      </BottomSheet>

      {/* Мобильный Bottom Sheet: сортировка */}
      <BottomSheet
        open={mobileSortOpen}
        onOpenChange={setMobileSortOpen}
        title="Сортировка"
      >
        <div className="space-y-1">
          {SORT_OPTIONS.map((o) => {
            const active = (search.sort ?? "relevance") === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  upd({ sort: o.key });
                  setMobileSortOpen(false);
                }}
                className={`w-full h-14 px-4 rounded-xl flex items-center justify-between text-base font-medium transition ${
                  active
                    ? "bg-brand/10 text-brand"
                    : "hover:bg-surface text-foreground/85"
                }`}
              >
                <span>{o.label}</span>
                {active && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
              </button>
            );
          })}
        </div>
      </BottomSheet>
     </PullToRefresh>
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

function plural(n: number, forms: [string, string, string]) {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

function CategoryTile({
  active,
  onClick,
  label,
  emoji,
  imageUrl,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  emoji: string;
  imageUrl?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 flex flex-col items-center gap-2 group w-[76px] md:w-[92px]"
    >
      <div
        className={`grid place-items-center rounded-2xl transition-all duration-200 h-[68px] w-[68px] md:h-[80px] md:w-[80px] ${
          active
            ? "bg-brand text-brand-foreground shadow-[0_8px_20px_-8px_var(--brand)]"
            : "bg-surface text-foreground/80 group-hover:bg-surface-strong"
        }`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-10 w-10 md:h-12 md:w-12 object-contain"
          />
        ) : (
          <span className="text-2xl md:text-3xl">{emoji}</span>
        )}
      </div>
      <span
        className={`text-[11px] md:text-xs leading-tight text-center line-clamp-2 transition ${
          active ? "text-brand font-semibold" : "text-foreground/75"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

