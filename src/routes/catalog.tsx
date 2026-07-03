// Общий каталог товаров с поиском и фильтрами
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/ProductCard";
import { Search } from "lucide-react";

// Схема параметров поиска в URL
const searchSchema = z.object({
  q: z.string().optional(), // поисковый запрос
  category: z.string().optional(), // slug категории
  min: z.coerce.number().optional(), // мин. цена в рублях
  max: z.coerce.number().optional(), // макс. цена в рублях
});

// Определяем маршрут «/catalog»
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

// Страница каталога
function CatalogPage() {
  // Читаем параметры фильтра из URL
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  // Загружаем категории для фильтра
  const catsQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });

  // Загружаем товары с учётом фильтров
  const productsQuery = useQuery({
    queryKey: ["catalog", search],
    queryFn: async () => {
      // Строим запрос к таблице products
      let q = supabase
        .from("products")
        .select("id,title,price_kopecks,image_url,stock,category_id,categories(slug)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(60);
      // Фильтр по названию
      if (search.q) q = q.ilike("title", `%${search.q}%`);
      // Фильтр по категории
      if (search.category) {
        const cat = catsQuery.data?.find((c) => c.slug === search.category);
        if (cat) q = q.eq("category_id", cat.id);
      }
      // Фильтр по минимальной цене
      if (search.min) q = q.gte("price_kopecks", search.min * 100);
      // Фильтр по максимальной цене
      if (search.max) q = q.lte("price_kopecks", search.max * 100);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !catsQuery.isLoading, // ждём категории для маппинга slug→id
  });

  // Обновляем параметр в URL
  const upd = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, ...patch }) });

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Заголовок */}
        <h1 className="text-2xl md:text-3xl font-bold mb-4">Каталог товаров</h1>

        {/* Поисковая строка */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Найти товар..."
            defaultValue={search.q ?? ""}
            onChange={(e) => upd({ q: e.target.value || undefined })}
            className="w-full h-12 pl-10 pr-4 rounded-xl border bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Чипы категорий */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
          <button
            onClick={() => upd({ category: undefined })}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium ${
              !search.category ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent"
            }`}
          >
            Все
          </button>
          {catsQuery.data?.map((c) => (
            <button
              key={c.id}
              onClick={() => upd({ category: c.slug })}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium ${
                search.category === c.slug
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-accent"
              }`}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        {/* Ценовые фильтры */}
        <div className="flex gap-2 mb-6">
          <input
            type="number"
            placeholder="Цена от, ₽"
            defaultValue={search.min ?? ""}
            onChange={(e) => upd({ min: e.target.value ? Number(e.target.value) : undefined })}
            className="w-32 h-10 px-3 rounded-lg border bg-card text-sm"
          />
          <input
            type="number"
            placeholder="Цена до, ₽"
            defaultValue={search.max ?? ""}
            onChange={(e) => upd({ max: e.target.value ? Number(e.target.value) : undefined })}
            className="w-32 h-10 px-3 rounded-lg border bg-card text-sm"
          />
          {(search.min || search.max || search.category || search.q) && (
            <Link
              to="/catalog"
              className="h-10 inline-flex items-center px-3 rounded-lg text-sm text-muted-foreground hover:bg-accent"
            >
              Сбросить
            </Link>
          )}
        </div>

        {/* Сетка товаров */}
        {productsQuery.isLoading ? (
          <div className="text-center py-10 text-muted-foreground">Загрузка...</div>
        ) : productsQuery.data && productsQuery.data.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {productsQuery.data.map((p) => (
              <ProductCard key={p.id} {...p} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            Ничего не найдено. Попробуйте изменить фильтры.
          </div>
        )}
      </div>
    </AppLayout>
  );
}
