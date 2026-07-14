// Главная страница — Askona-style: промо-баннер, круговые категории,
// «Подборщик»-плитки с картинкой в углу, витрина новинок.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/ProductCard";
import { ArrowRight, Truck, ShieldCheck, RotateCcw, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kupiks — маркетплейс товаров от проверенных продавцов" },
      {
        name: "description",
        content:
          "Тысячи товаров для дома, отдыха и стиля. Честные цены, быстрая доставка по всей России.",
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
  // Загружаем категории
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Загружаем последние товары
  const productsQuery = useQuery({
    queryKey: ["home-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,title,price_kopecks,image_url,stock")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppLayout>
      {/* Промо-баннер Kupiks */}
      <section className="mx-auto max-w-7xl px-4 pt-2">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="aspect-square rounded-2xl bg-surface animate-pulse" />
                <div className="h-4 w-20 rounded bg-surface animate-pulse" />
                <div className="h-3 w-full rounded bg-surface animate-pulse" />
              </div>
            ))}
          </div>
        ) : productsQuery.data && productsQuery.data.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
            {productsQuery.data.map((p) => (
              <ProductCard key={p.id} {...p} />
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
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="aspect-square w-full rounded-2xl bg-surface animate-pulse" />
                <div className="h-3 w-16 rounded bg-surface animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-5">
            {categoriesQuery.data?.map((c) => (
              <Link
                key={c.id}
                to="/catalog"
                search={{ category: c.slug }}
                className="group flex flex-col items-center gap-2"
              >
                <div className="aspect-square w-full rounded-2xl bg-surface flex items-center justify-center text-5xl md:text-6xl transition group-hover:bg-surface-strong group-hover:scale-[1.02]">
                  {c.icon ?? "📦"}
                </div>
                <span className="text-xs md:text-sm font-medium text-center text-foreground/90 line-clamp-2">
                  {c.name}
                </span>
              </Link>
            ))}
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
    </AppLayout>
  );
}
