// Страница карточки товара — премиальный e-commerce стиль
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart-store";
import { toast } from "sonner";
import { ShoppingCart, ArrowLeft, Truck, ShieldCheck, RotateCcw, Star, Store, MessageCircle } from "lucide-react";
import { ProductReviews } from "@/components/ProductReviews";
import { useServerFn } from "@tanstack/react-start";
import { getProductReviews } from "@/lib/reviews.functions";
import { getSellerProfile } from "@/lib/seller-profile.functions";
import { getOrCreateChat } from "@/lib/chat.functions";
import { useAuth } from "@/lib/use-auth";
import { useNavigate } from "@tanstack/react-router";


export const Route = createFileRoute("/product/$id")({
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const add = useCart((s) => s.add);
  const [activeImg, setActiveImg] = useState(0);
  const fetchReviews = useServerFn(getProductReviews);
  const fetchSeller = useServerFn(getSellerProfile);
  const openChat = useServerFn(getOrCreateChat);
  const { user } = useAuth();
  const navigate = useNavigate();



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

  const ratingQuery = useQuery({
    queryKey: ["product-reviews", id],
    queryFn: () => fetchReviews({ data: { product_id: id } }),
  });
  const avg = ratingQuery.data?.avg ?? 0;
  const reviewsCount = ratingQuery.data?.count ?? 0;

  const sellerQuery = useQuery({
    queryKey: ["seller-profile-mini", product?.seller_id],
    enabled: !!product?.seller_id,
    queryFn: () => fetchSeller({ data: { id: product!.seller_id } }),
  });


  const addToCart = () => {
    if (!product) return;
    add({
      id: product.id,
      title: product.title,
      price_kopecks: product.price_kopecks,
      image_url: product.image_url,
      seller_id: product.seller_id,
      stock: product.stock,
    });
    toast.success("Товар добавлен в корзину");
  };
  const writeSeller = async () => {
    if (!product) return;
    if (!user) {
      toast.error("Войдите, чтобы написать продавцу");
      navigate({ to: "/auth" });
      return;
    }
    if (user.id === product.seller_id) {
      toast.error("Это ваш собственный товар");
      return;
    }
    try {
      const res = await openChat({
        data: { seller_id: product.seller_id, product_id: product.id },
      });
      navigate({ to: "/messages/$chatId", params: { chatId: res.id } });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };


  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-4 md:py-6 pb-28 md:pb-6">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand transition mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Назад в каталог
        </Link>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-8 animate-pulse">
            <div className="aspect-square rounded-2xl bg-surface-strong" />
            <div className="space-y-4">
              <div className="h-4 w-20 bg-surface-strong rounded" />
              <div className="h-8 w-3/4 bg-surface-strong rounded" />
              <div className="h-10 w-40 bg-surface-strong rounded" />
              <div className="h-4 w-32 bg-surface-strong rounded" />
              <div className="h-24 bg-surface-strong rounded" />
            </div>
          </div>
        ) : error || !product ? (
          <div className="py-20 text-center text-muted-foreground">Товар не найден</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 md:gap-10 animate-fade-in">
            {/* Галерея */}
            {(() => {
              const gallery: string[] =
                (product as { image_urls?: string[] }).image_urls?.length
                  ? (product as { image_urls: string[] }).image_urls
                  : product.image_url
                    ? [product.image_url]
                    : [];
              const current = gallery[activeImg] ?? gallery[0];
              return (
                <div>
                  <div className="aspect-square rounded-2xl bg-white border border-border overflow-hidden">
                    {current ? (
                      <img
                        src={current}
                        alt={product.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-8xl opacity-30">
                        🛍️
                      </div>
                    )}
                  </div>
                  {gallery.length > 1 && (
                    <div className="mt-3 grid grid-cols-5 gap-2">
                      {gallery.map((url, i) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setActiveImg(i)}
                          className={`aspect-square rounded-xl overflow-hidden border-2 transition ${
                            i === activeImg
                              ? "border-brand shadow-sm"
                              : "border-transparent hover:border-border"
                          }`}
                        >
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Информация */}
            <div>
              {product.categories && (
                <Link
                  to="/catalog"
                  search={{ category: product.categories.slug }}
                  className="inline-flex text-xs font-semibold uppercase tracking-wider text-brand hover:underline mb-2"
                >
                  {product.categories.name}
                </Link>
              )}
              <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight leading-tight">
                {product.title}
              </h1>

              {reviewsCount > 0 && (
                <a
                  href="#reviews"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm hover:underline"
                >
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold">{avg.toFixed(1)}</span>
                  <span className="text-muted-foreground">
                    · {reviewsCount}{" "}
                    {reviewsCount === 1
                      ? "отзыв"
                      : reviewsCount < 5
                        ? "отзыва"
                        : "отзывов"}
                  </span>
                </a>
              )}

              {sellerQuery.data && (
                <Link
                  to="/seller/$id"
                  params={{ id: sellerQuery.data.id }}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface hover:bg-surface-strong px-3 py-1.5 text-sm transition group"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-brand-foreground">
                    <Store className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-muted-foreground">Продавец:</span>
                  <span className="font-semibold text-foreground group-hover:text-brand transition">
                    {sellerQuery.data.name}
                  </span>
                  {sellerQuery.data.reviewsCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {sellerQuery.data.avgRating.toFixed(1)}
                    </span>
                  )}
                </Link>
              )}



              <div className="mt-6 flex items-baseline gap-3">
                <div className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                  {formatPrice(product.price_kopecks)}
                </div>
              </div>
              <div
                className={`mt-2 text-sm font-medium ${
                  product.stock > 0 ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {product.stock > 0 ? `В наличии: ${product.stock} шт.` : "Нет в наличии"}
              </div>

              {/* Кнопка добавления в корзину (desktop) */}
              <button
                disabled={product.stock === 0}
                onClick={addToCart}
                className="hidden md:inline-flex mt-6 items-center justify-center gap-2 rounded-full bg-brand px-8 py-3.5 text-base font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition"
              >
                <ShoppingCart className="h-5 w-5" />
                {product.stock === 0 ? "Нет в наличии" : "Добавить в корзину"}
              </button>

              {/* Иконки-бенефиты */}
              <div className="mt-6 grid grid-cols-3 gap-2 md:gap-3 rounded-2xl border border-border bg-white p-3 md:p-4">
                {[
                  { icon: Truck, label: "Доставка", hint: "по всей России" },
                  { icon: ShieldCheck, label: "Безопасно", hint: "оплата защищена" },
                  { icon: RotateCcw, label: "Возврат", hint: "в течение 14 дней" },
                ].map((b, i) => {
                  const Icon = b.icon;
                  return (
                    <div key={i} className="flex flex-col items-center text-center gap-1">
                      <Icon className="h-5 w-5 text-brand" />
                      <div className="text-xs font-semibold">{b.label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">
                        {b.hint}
                      </div>
                    </div>
                  );
                })}
              </div>

              {product.description && (
                <div className="mt-6">
                  <h2 className="font-semibold mb-2">Описание</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                    {product.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {product && (
          <div id="reviews">
            <ProductReviews productId={product.id} />
          </div>
        )}
      </div>

      {/* Мобильная sticky-кнопка */}
      {product && (
        <div className="md:hidden fixed bottom-16 inset-x-0 z-30 border-t border-border bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-8px_20px_-8px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground leading-none">Цена</div>
              <div className="text-lg font-extrabold tracking-tight">
                {formatPrice(product.price_kopecks)}
              </div>
            </div>
            <button
              disabled={product.stock === 0}
              onClick={addToCart}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50 shadow-sm transition"
            >
              <ShoppingCart className="h-4 w-4" />
              {product.stock === 0 ? "Нет в наличии" : "В корзину"}
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
