// Главная страница — Askona-style: промо-баннер, круговые категории,
// «Подборщик»-плитки с картинкой в углу, витрина новинок.
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ProductCard } from "@/components/ProductCard";
import { ArrowRight, Truck, ShieldCheck, RotateCcw, Sparkles } from "lucide-react";
import { getCategoryIcon } from "@/lib/category-icons";
import { categoriesQueryOptions } from "@/lib/categories-query";
import { listPublicBanners, type PublicBanner } from "@/lib/admin/banners.functions";
import { ProductGridSkeleton, CategoryTilesSkeleton } from "@/components/Skeletons";

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

// Иконки-эмодзи для витринных подборок (fallback, если фото товара нет)
const PICKS = [
  {
    to: "matrasy",
    title: "Подборщик товаров",
    subtitle: "создайте идеальное место для отдыха",
    emoji: "🛍️",
  },
  {
    to: "krovati",
    title: "Топ-подборка",
    subtitle: "более 100 моделей — от бюджета до премиум",
    emoji: "✨",
  },
  {
    to: "podushki",
    title: "Каталог новинок",
    subtitle: "свежие поступления от продавцов",
    emoji: "🆕",
  },
  {
    to: "divany",
    title: "Идеи для дома",
    subtitle: "мебель, декор, уют",
    emoji: "🏡",
  },
];

function HomePage() {
  const router = useRouter();
  // Загружаем категории
  const categoriesQuery = useQuery(categoriesQueryOptions());

  // Баннеры главной страницы (публично, без авторизации)
  const bannersQuery = useQuery({
    queryKey: ["public-banners"],
    queryFn: () => listPublicBanners(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
  const banners: PublicBanner[] =
    !bannersQuery.isError && bannersQuery.data ? bannersQuery.data : [];

  // Загружаем последние товары
  const productsQuery = useQuery({
    queryKey: ["home-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, price_kopecks, image_url, stock")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const qcRefresh = useQueryClient();

  return (
    <AppLayout>
     <PullToRefresh onRefresh={() => qcRefresh.refetchQueries({ type: "active" })}>
      {/* Промо-баннер(ы) Kupiks */}
      <section className="mx-auto max-w-7xl px-4 pt-2">
        {banners.length > 0 ? (
          <div
            className={
              banners.length === 1
                ? ""
                : "flex gap-4 overflow-x-auto pb-1 snap-x snap-mandatory md:grid md:grid-cols-2 md:overflow-visible"
            }
          >
            {banners.map((b) => {
              const content = (
                <div
                  className="relative overflow-hidden rounded-3xl min-h-[220px] md:min-h-[340px] p-6 md:p-12 flex flex-col justify-between text-white h-full"
                  style={{ backgroundColor: b.bg_color }}
                >
                  <div className="relative z-10 max-w-md">
                    {b.promo_code && (
                      <div className="inline-flex items-center rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs font-bold text-white mb-4 shadow-sm">
                        Промокод {b.promo_code}
                      </div>
                    )}
                    <h2 className="font-display font-extrabold tracking-tight leading-[1.05] text-2xl md:text-4xl">
                      {b.title}
                    </h2>
                    {b.subtitle && (
                      <p className="mt-3 text-sm md:text-base text-white/80 max-w-xs">
                        {b.subtitle}
                      </p>
                    )}
                    <span className="inline-flex mt-5 items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-foreground hover:bg-white/90 shadow-md transition">
                      За покупками <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="absolute -right-16 -bottom-16 h-64 w-64 md:h-96 md:w-96 rounded-full bg-white/10 blur-2xl" />
                </div>
              );
              const wrapperClass =
                banners.length === 1
                  ? "block"
                  : "block shrink-0 w-[85vw] sm:w-[60vw] md:w-auto snap-start";
              if (b.link && b.link.startsWith("/")) {
                return (
                  <Link key={b.id} to={b.link} className={wrapperClass}>
                    {content}
                  </Link>
                );
              }
              if (b.link) {
                return (
                  <a key={b.id} href={b.link} target="_blank" rel="noopener noreferrer" className={wrapperClass}>
                    {content}
                  </a>
                );
              }
              return (
                <div key={b.id} className={wrapperClass}>
                  {content}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#fff1ec] via-[#ffe0d4] to-[#ffd0be] min-h-[220px] md:min-h-[340px] p-6 md:p-12 flex flex-col justify-between">
            <div className="relative z-10 max-w-md">
              <div className="inline-flex items-center rounded-full bg-white/90 backdrop-blur px-3 py-1 text-xs font-bold text-foreground/80 mb-4 shadow-sm">
                Только сейчас
              </div>
              <h1 className="font-display font-extrabold tracking-tight text-foreground leading-[0.95]">
                <span className="block text-6xl md:text-8xl text-brand drop-shadow-sm">
                  −15%
                </span>
                <span className="block text-xl md:text-3xl mt-2">
                  на первые заказы в Kupiks
                </span>
              </h1>
              <p className="mt-3 text-sm md:text-base text-foreground/70 max-w-xs">
                Промокод <span className="font-bold text-foreground">KUPIKS</span> для новых покупателей.
              </p>
              <Link
                to="/catalog"
                className="inline-flex mt-5 items-center gap-2 rounded-full bg-foreground px-6 py-3 font-semibold text-white hover:bg-foreground/90 shadow-md transition"
              >
                За покупками <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="absolute -right-16 -bottom-16 h-64 w-64 md:h-96 md:w-96 rounded-full bg-white/40 blur-2xl" />
            <div className="absolute right-8 top-8 hidden md:flex h-32 w-32 rounded-full bg-white/80 backdrop-blur items-center justify-center text-6xl shadow-sm">
              🛍️
            </div>
          </div>
        )}
      </section>

      {/* Витрина товаров — сразу после баннера */}
      <section className="mx-auto max-w-7xl px-4 pt-8 md:pt-12">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-display text-xl md:text-2xl font-extrabold tracking-tight">
            Популярное сейчас
          </h2>
          <Link
            to="/catalog"
            className="text-sm font-semibold text-brand hover:text-brand-strong"
          >
            Все товары →
          </Link>
        </div>
        {productsQuery.isLoading ? (
          <ProductGridSkeleton count={10} />
        ) : productsQuery.data && productsQuery.data.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
            {productsQuery.data.map((p, i) => (
              <ProductCard key={p.id} {...p} priority={i < 5} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-surface p-10 text-center text-muted-foreground">
            Пока нет товаров. Станьте первым продавцом!
          </div>
        )}
      </section>

      {/* Категории */}
      <section className="mx-auto max-w-7xl px-4 pt-10 md:pt-14">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-display text-xl md:text-2xl font-extrabold tracking-tight">
            Категории
          </h2>
          <Link
            to="/catalog"
            className="text-sm font-semibold text-brand hover:text-brand-strong"
          >
            Все →
          </Link>
        </div>
        {categoriesQuery.isLoading ? (
          <CategoryTilesSkeleton count={8} />
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
            {categoriesQuery.data?.map((c) => {
              const Icon = getCategoryIcon(c.slug);
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
                  <div className="aspect-square w-full rounded-2xl bg-surface flex items-center justify-center ui-transition group-hover:bg-brand/10 group-hover:-translate-y-0.5 group-hover:shadow-sm">
                    <Icon
                      className="h-8 w-8 md:h-9 md:w-9 text-foreground/70 group-hover:text-brand ui-transition"
                      strokeWidth={1.5}
                    />
                  </div>
                  <span className="text-xs md:text-sm font-medium text-center text-foreground/85 group-hover:text-foreground line-clamp-2">
                    {c.name}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>


      {/* Подборки */}
      <section className="mx-auto max-w-7xl px-4 pt-10 md:pt-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {PICKS.map((pick, i) => (
            <Link
              key={i}
              to="/catalog"
              className="group relative overflow-hidden rounded-2xl bg-surface p-5 md:p-6 min-h-[160px] md:min-h-[200px] flex flex-col hover:bg-surface-strong transition"
            >
              <div className="relative z-10 max-w-[70%]">
                <div className="text-base md:text-xl font-extrabold text-foreground leading-tight">
                  {pick.title}
                </div>
                <div className="mt-1.5 text-xs md:text-sm text-foreground/60 leading-snug">
                  {pick.subtitle}
                </div>
              </div>
              <div className="absolute right-4 bottom-4 md:right-6 md:bottom-6 h-20 w-20 md:h-32 md:w-32 rounded-2xl bg-white flex items-center justify-center text-5xl md:text-6xl shadow-sm group-hover:scale-105 transition">
                {pick.emoji}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Преимущества */}
      <section className="mx-auto max-w-7xl px-4 pt-10 md:pt-14 pb-10 md:pb-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { icon: RotateCcw, title: "Лёгкий обмен", hint: "в течение 14 дней" },
            { icon: ShieldCheck, title: "Гарантия", hint: "на весь ассортимент" },
            { icon: Truck, title: "Доставка", hint: "по всей России" },
            { icon: Sparkles, title: "Честная цена", hint: "без наценок" },
          ].map((b, i) => {
            const Icon = b.icon;
            return (
              <div
                key={i}
                className="flex flex-col items-center text-center gap-2 rounded-2xl bg-surface p-4 md:p-6"
              >
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-brand-soft flex items-center justify-center">
                  <Icon className="h-6 w-6 text-brand-strong" strokeWidth={2} />
                </div>
                <div className="text-sm md:text-base font-bold">{b.title}</div>
                <div className="text-[11px] md:text-xs text-foreground/60 leading-snug">
                  {b.hint}
                </div>
              </div>
            );
          })}
        </div>
      </section>
     </PullToRefresh>
    </AppLayout>
  );
}
