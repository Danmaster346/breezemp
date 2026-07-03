// Публичная страница продавца: /seller/$id
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star, Store, Package, MessageSquare, ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/ProductCard";
import { getSellerProfile } from "@/lib/seller-profile.functions";

export const Route = createFileRoute("/seller/$id")({
  head: () => ({
    meta: [
      { title: "Магазин продавца — BreezeMarket" },
      { name: "description", content: "Публичная страница продавца: товары, рейтинг и отзывы." },
    ],
  }),
  component: SellerPage,
});

function pluralReviews(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return "отзыв";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "отзыва";
  return "отзывов";
}
function pluralProducts(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return "товар";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "товара";
  return "товаров";
}

function SellerPage() {
  const { id } = Route.useParams();
  const fetchProfile = useServerFn(getSellerProfile);

  const { data, isLoading, error } = useQuery({
    queryKey: ["seller-profile", id],
    queryFn: () => fetchProfile({ data: { id } }),
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-4 md:py-6 pb-28 md:pb-10">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand transition mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> В каталог
        </Link>

        {isLoading ? (
          <div className="animate-pulse space-y-6">
            <div className="h-40 rounded-3xl bg-surface" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl bg-surface" />
              ))}
            </div>
          </div>
        ) : error || !data ? (
          <div className="py-20 text-center">
            <div className="text-5xl mb-3">🏪</div>
            <div className="text-lg font-semibold">Продавец не найден</div>
            <p className="text-sm text-muted-foreground mt-1">
              Возможно, магазин удалён или ссылка неверна.
            </p>
          </div>
        ) : (
          <>
            {/* Шапка магазина */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-soft via-white to-white border border-brand/20 p-6 md:p-8">
              <div className="flex items-start gap-4 md:gap-6">
                <div className="grid h-16 w-16 md:h-20 md:w-20 shrink-0 place-items-center rounded-2xl bg-brand text-brand-foreground shadow-sm">
                  <Store className="h-8 w-8 md:h-10 md:w-10" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-brand">
                    Магазин продавца
                  </div>
                  <h1 className="mt-1 text-2xl md:text-4xl font-extrabold tracking-tight leading-tight truncate">
                    {data.name}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-3 md:gap-4 text-sm">
                    {data.reviewsCount > 0 ? (
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 border border-border">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="font-bold">{data.avgRating.toFixed(1)}</span>
                        <span className="text-muted-foreground">
                          · {data.reviewsCount} {pluralReviews(data.reviewsCount)}
                        </span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 border border-border text-muted-foreground">
                        <Star className="h-4 w-4" />
                        <span>Ещё нет отзывов</span>
                      </div>
                    )}
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 border border-border">
                      <Package className="h-4 w-4 text-brand" />
                      <span className="font-semibold">{data.productsCount}</span>
                      <span className="text-muted-foreground">
                        {pluralProducts(data.productsCount)}
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 border border-border">
                      <MessageSquare className="h-4 w-4 text-brand" />
                      <span className="font-semibold">{data.reviewsCount}</span>
                      <span className="text-muted-foreground">
                        {pluralReviews(data.reviewsCount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Товары */}
            <section className="mt-8">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-lg md:text-xl font-extrabold tracking-tight">
                  Товары магазина
                </h2>
                <span className="text-sm text-muted-foreground">
                  {data.productsCount} {pluralProducts(data.productsCount)}
                </span>
              </div>
              {data.products.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
                  {data.products.map((p) => (
                    <ProductCard key={p.id} {...p} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-surface p-10 text-center text-muted-foreground">
                  У этого продавца пока нет активных товаров.
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}
