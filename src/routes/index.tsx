// Главная страница маркетплейса
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/ProductCard";
import { ArrowRight } from "lucide-react";

// Определяем маршрут «/»
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BreezeMarket — тысячи товаров от продавцов со всей страны" },
      {
        name: "description",
        content: "Электроника, одежда, товары для дома. Свободный маркетплейс с честной комиссией.",
      },
    ],
  }),
  component: HomePage,
});

// Компонент главной
function HomePage() {
  // Загружаем список категорий
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Загружаем последние товары для витрины
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
      {/* Герой-баннер */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-soft via-white to-surface border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-12 md:py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center rounded-full bg-white border border-border px-3 py-1 text-xs font-semibold text-brand mb-5 shadow-sm">
              Новый премиальный маркетплейс
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight text-foreground">
              Всё для дома и жизни —<br />
              <span className="text-brand">на BREEZE</span>
            </h1>
            <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-md leading-relaxed">
              Тысячи товаров от проверенных продавцов. Быстрая доставка по всей России, честные цены и понятная корзина.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/catalog"
                className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 font-semibold text-brand-foreground hover:bg-brand/90 shadow-sm hover:shadow-md transition"
              >
                Открыть каталог <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-6 py-3 font-semibold text-foreground hover:border-brand hover:text-brand transition"
              >
                Стать продавцом
              </Link>
            </div>
          </div>
          {/* Плитка категорий-превью */}
          <div className="hidden md:grid grid-cols-3 gap-3">
            {["🛋️", "📱", "👗", "🏠", "💄", "⚽"].map((e, i) => (
              <div
                key={i}
                className="aspect-square rounded-2xl bg-white border border-border flex items-center justify-center text-5xl shadow-[0_4px_16px_-8px_rgba(23,135,155,0.15)] hover:shadow-[0_8px_24px_-8px_rgba(23,135,155,0.3)] hover:-translate-y-0.5 transition"
              >
                {e}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Категории */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Категории</h2>
          <Link to="/catalog" className="text-sm font-semibold text-brand hover:underline">
            Все категории →
          </Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-3">
          {categoriesQuery.data?.map((c) => (
            <Link
              key={c.id}
              to="/catalog"
              search={{ category: c.slug }}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-4 hover:border-brand hover:shadow-md hover:-translate-y-0.5 transition"
            >
              <span className="text-3xl">{c.icon ?? "📦"}</span>
              <span className="text-xs font-semibold text-center text-foreground">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Витрина */}
      <section className="mx-auto max-w-7xl px-4 pb-14">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Новинки</h2>
          <Link to="/catalog" className="text-sm font-semibold text-brand hover:underline">
            Все товары →
          </Link>
        </div>
        {productsQuery.data && productsQuery.data.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {productsQuery.data.map((p) => (
              <ProductCard key={p.id} {...p} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-muted-foreground">
            Пока нет товаров. Станьте первым продавцом!
          </div>
        )}
      </section>
    </AppLayout>
  );
}
