// Страница карточки конкретного товара
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart-store";
import { toast } from "sonner";
import { ShoppingCart, ArrowLeft } from "lucide-react";

// Определяем маршрут «/product/$id»
export const Route = createFileRoute("/product/$id")({
  component: ProductPage,
});

// Компонент страницы товара
function ProductPage() {
  // Получаем id из URL
  const { id } = Route.useParams();
  // Хуки корзины
  const add = useCart((s) => s.add);
  const [activeImg, setActiveImg] = useState(0);

  // Загружаем данные товара
  const { data: product, isLoading, error } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name,slug)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Возврат в каталог */}
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Назад в каталог
        </Link>

        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground">Загрузка...</div>
        ) : error || !product ? (
          <div className="py-20 text-center text-muted-foreground">Товар не найден</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Изображение товара */}
            <div className="aspect-square rounded-2xl bg-muted overflow-hidden">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-8xl">🛍️</div>
              )}
            </div>

            {/* Информация о товаре */}
            <div>
              {product.categories && (
                <div className="text-sm text-muted-foreground mb-1">
                  {product.categories.name}
                </div>
              )}
              <h1 className="text-2xl md:text-3xl font-bold">{product.title}</h1>
              <div className="mt-4 text-4xl font-black text-primary">
                {formatPrice(product.price_kopecks)}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {product.stock > 0 ? `В наличии: ${product.stock} шт.` : "Нет в наличии"}
              </div>

              {product.description && (
                <div className="mt-6">
                  <h2 className="font-semibold mb-2">Описание</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Кнопка добавления в корзину */}
              <button
                disabled={product.stock === 0}
                onClick={() => {
                  add({
                    id: product.id,
                    title: product.title,
                    price_kopecks: product.price_kopecks,
                    image_url: product.image_url,
                    seller_id: product.seller_id,
                    stock: product.stock,
                  });
                  toast.success("Товар добавлен в корзину");
                }}
                className="mt-8 w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="h-5 w-5" />
                {product.stock === 0 ? "Нет в наличии" : "В корзину"}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
