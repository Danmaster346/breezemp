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
      {/* Герой-блок */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 py-10 md:py-16 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground mb-4">
              Новый маркетплейс
            </div>
            <h1 className="text-4xl md:text-6xl font-black leading-tight">
              Всё, что нужно —<br />
              <span className="bg-gradient-to-r from-primary to-fuchsia-500 bg-clip-text text-transparent">
                в одном месте
              </span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-md">
              Тысячи товаров от продавцов со всей страны. Простая корзина и быстрый заказ.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/catalog"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90"
              >
                Открыть каталог <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 font-semibold hover:bg-accent"
              >
                Стать продавцом
              </Link>
            </div>
          </div>
          {/* Декоративная плитка */}
          <div className="hidden md:grid grid-cols-3 gap-3">
            {["🛍️", "📱", "👗", "🏠", "💄", "⚽"].map((e, i) => (
              <div
                key={i}
                className="aspect-square rounded-2xl bg-gradient-to-br from-accent to-secondary flex items-center justify-center text-5xl shadow-sm"
              >
                {e}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Сетка категорий */}
      <section className="mx-auto max-w-7xl px-4 py-6">
        <h2 className="text-2xl font-bold mb-4">Категории</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-3">
          {categoriesQuery.data?.map((c) => (
            <Link
              key={c.id}
              to="/catalog"
              search={{ category: c.slug }}
              className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-3 hover:bg-accent transition"
            >
              <span className="text-3xl">{c.icon ?? "📦"}</span>
              <span className="text-xs font-medium text-center">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Витрина товаров */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Новинки</h2>
          <Link to="/catalog" className="text-sm text-primary hover:underline">
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
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            Пока нет товаров. Станьте первым продавцом!
          </div>
        )}
      </section>
    </AppLayout>
  );
}
