// Главная страница: hero-слайдер, преимущества, категории со счётчиками,
// хиты, новинки, акции с таймером, рекомендации, недавно смотрели и SEO-блок.
import { useMemo } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { PullToRefresh } from "@/components/PullToRefresh";
import { HeroSlider } from "@/components/home/HeroSlider";
import { ProductRow, SectionHeader, ShowAllLink } from "@/components/home/ProductRow";
import { DealsCountdown } from "@/components/home/DealsCountdown";
import { RecentlyViewedRow } from "@/components/home/RecentlyViewedRow";
import { HomeSeoText } from "@/components/home/HomeSeoText";
import { Truck, ShieldCheck, RotateCcw, BadgePercent } from "lucide-react";
import { getCategoryIcon } from "@/lib/category-icons";
import { categoriesQueryOptions } from "@/lib/categories-query";
import { listPublicBanners, type PublicBanner } from "@/lib/admin/banners.functions";
import { CategoryTilesSkeleton } from "@/components/Skeletons";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kupiks — маркетплейс товаров для дома, отдыха и стиля" },
      {
        name: "description",
        content:
          "Покупайте и продавайте товары на Kupiks. Доставка по всей России.",
      },
      { property: "og:title", content: "Kupiks — маркетплейс товаров для дома, отдыха и стиля" },
      {
        property: "og:description",
        content: "Покупайте и продавайте товары на Kupiks. Доставка по всей России.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kupiks-marketplace.ru/" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://kupiks-marketplace.ru/og-default.jpg" },
      { property: "og:image:alt", content: "Kupiks — маркетплейс" },
      { name: "twitter:image", content: "https://kupiks-marketplace.ru/og-default.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://kupiks-marketplace.ru/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Kupiks",
          url: "https://kupiks-marketplace.ru",
          logo: "https://kupiks-marketplace.ru/og-default.jpg",
          description: "Маркетплейс товаров для дома, отдыха и стиля",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Kupiks",
          url: "https://kupiks-marketplace.ru",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://kupiks-marketplace.ru/catalog?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  }),

  component: HomePage,
});

const ADVANTAGES = [
  { icon: Truck, title: "Быстрая доставка", hint: "по всей России, от 3000 ₽ — бесплатно" },
  { icon: BadgePercent, title: "Лучшие цены", hint: "честные цены без скрытых наценок" },
  { icon: ShieldCheck, title: "Гарантия качества", hint: "модерация каждого товара" },
  { icon: RotateCcw, title: "Лёгкий возврат", hint: "обмен и возврат 14 дней" },
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function HomePage() {
  const router = useRouter();
  const qcRefresh = useQueryClient();
  const categoriesQuery = useQuery(categoriesQueryOptions());

  const bannersQuery = useQuery({
    queryKey: ["public-banners"],
    queryFn: () => listPublicBanners(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
  const banners: PublicBanner[] =
    !bannersQuery.isError && bannersQuery.data ? bannersQuery.data : [];

  // Один запрос витрины — секции формируются на клиенте
  const productsQuery = useQuery({
    queryKey: ["home-showcase"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, title, price_kopecks, image_url, stock, compare_at_price_kopecks, created_at, category_id, badges",
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const all = productsQuery.data ?? [];

  const sections = useMemo(() => {
    const discounted = all
      .filter((p) => (p.compare_at_price_kopecks ?? 0) > p.price_kopecks)
      .sort((a, b) => {
        const da = ((a.compare_at_price_kopecks ?? 0) - a.price_kopecks) / (a.compare_at_price_kopecks || 1);
        const db = ((b.compare_at_price_kopecks ?? 0) - b.price_kopecks) / (b.compare_at_price_kopecks || 1);
        return db - da;
      });
    const hits = all
      .filter((p) => p.stock > 0)
      .filter((p) => (p.badges ?? []).length > 0 || (p.compare_at_price_kopecks ?? 0) > 0)
      .concat(all.filter((p) => p.stock > 0))
      .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
      .slice(0, 10);
    const fresh = all
      .filter((p) => p.created_at && Date.now() - new Date(p.created_at).getTime() < WEEK_MS)
      .slice(0, 10);
    return {
      hits,
      fresh: fresh.length > 0 ? fresh : all.slice(0, 10),
      discounted: discounted.slice(0, 10),
      recommended: [...all].reverse().slice(0, 10),
    };
  }, [all]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of all) if (p.category_id) map.set(p.category_id, (map.get(p.category_id) ?? 0) + 1);
    return map;
  }, [all]);

  return (
    <AppLayout>
      <PullToRefresh onRefresh={() => qcRefresh.refetchQueries({ type: "active" })}>
        {/* Hero-слайдер */}
        <section className="mx-auto max-w-7xl px-4 pt-2">
          <HeroSlider banners={banners} />
        </section>

        {/* 4 преимущества */}
        <section className="mx-auto max-w-7xl px-4 pt-6 md:pt-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {ADVANTAGES.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-surface p-4 text-center md:p-6"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft md:h-14 md:w-14">
                    <Icon className="h-6 w-6 text-brand-strong" strokeWidth={2} />
                  </div>
                  <div className="text-sm font-bold md:text-base">{b.title}</div>
                  <div className="text-[11px] leading-snug text-muted-foreground md:text-xs">
                    {b.hint}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Категории со счётчиком товаров */}
        <section className="mx-auto max-w-7xl px-4 pt-10 md:pt-14">
          <SectionHeader
            title="Категории"
            subtitle="Выберите раздел и переходите к товарам"
            aside={<ShowAllLink to="/catalog" label="Все категории →" />}
          />
          {categoriesQuery.isLoading ? (
            <CategoryTilesSkeleton count={8} />
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 md:gap-4 lg:grid-cols-8">
              {categoriesQuery.data?.slice(0, 12).map((c) => {
                const Icon = getCategoryIcon(c.slug);
                const n = counts.get(c.id) ?? 0;
                return (
                  <Link
                    key={c.id}
                    to="/catalog"
                    search={{ category: c.slug }}
                    onMouseEnter={() => {
                      void router
                        .preloadRoute({ to: "/catalog", search: { category: c.slug } })
                        .catch(() => {});
                    }}
                    className="group flex flex-col items-center gap-2"
                  >
                    <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-surface ui-transition group-hover:-translate-y-0.5 group-hover:bg-brand/10 group-hover:shadow-sm">
                      <Icon
                        className="h-8 w-8 text-foreground/70 ui-transition group-hover:text-brand md:h-9 md:w-9"
                        strokeWidth={1.5}
                      />
                    </div>
                    <span className="line-clamp-2 text-center text-xs font-medium text-foreground/85 group-hover:text-foreground md:text-sm">
                      {c.name}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {n} товар{n % 10 === 1 && n % 100 !== 11 ? "" : "ов"}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Хиты продаж */}
        <section className="mx-auto max-w-7xl px-4 pt-10 md:pt-14">
          <SectionHeader
            title="Хиты продаж"
            subtitle="Товары, которые чаще всего выбирают покупатели"
            aside={<ShowAllLink to="/catalog" />}
          />
          <ProductRow items={sections.hits} loading={productsQuery.isLoading} priority />
        </section>

        {/* Акции и скидки */}
        {(productsQuery.isLoading || sections.discounted.length > 0) && (
          <section className="mx-auto max-w-7xl px-4 pt-10 md:pt-14">
            <SectionHeader
              title="Акции и скидки"
              aside={
                <div className="flex items-center gap-3">
                  <DealsCountdown />
                  <ShowAllLink to="/catalog" />
                </div>
              }
            />
            <ProductRow
              items={sections.discounted}
              loading={productsQuery.isLoading}
              emptyText="Акций пока нет — заходите позже"
            />
          </section>
        )}

        {/* Новинки */}
        <section className="mx-auto max-w-7xl px-4 pt-10 md:pt-14">
          <SectionHeader
            title="Новинки"
            subtitle="Свежие поступления от продавцов"
            aside={<ShowAllLink to="/catalog" />}
          />
          <ProductRow items={sections.fresh} loading={productsQuery.isLoading} />
        </section>

        {/* Рекомендации */}
        <section className="mx-auto max-w-7xl px-4 pt-10 md:pt-14">
          <SectionHeader
            title="Рекомендуем"
            subtitle="Вам может понравиться"
            aside={<ShowAllLink to="/catalog" />}
          />
          <ProductRow items={sections.recommended} loading={productsQuery.isLoading} />
        </section>

        {/* Недавно смотрели */}
        <RecentlyViewedRow />

        {/* SEO-блок */}
        <HomeSeoText categories={categoriesQuery.data ?? []} />
      </PullToRefresh>
    </AppLayout>
  );
}
