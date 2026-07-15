// Избранное покупателя
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Heart, Trash2, ShoppingBag } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/ProductCard";
import { listFavorites } from "@/lib/favorites.functions";
import { useToggleFavorite } from "@/lib/favorites.client";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({
    meta: [{ title: "Избранное — Kupiks" }, { name: "robots", content: "noindex" }],
  }),
  component: FavoritesPage,
  errorComponent: ({ error }) => (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <p className="text-destructive">{error.message}</p>
      </div>
    </AppLayout>
  ),
});

function FavoritesPage() {
  const load = useServerFn(listFavorites);
  const q = useQuery({ queryKey: ["favorites", "list"], queryFn: () => load() });
  const { mutate: toggle } = useToggleFavorite();
  const items = q.data ?? [];

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex items-end justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3">
              <span className="inline-grid place-items-center h-10 w-10 rounded-2xl bg-brand-soft text-brand">
                <Heart className="h-5 w-5 fill-current" />
              </span>
              Избранное
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {q.isLoading
                ? "Загружаем…"
                : items.length > 0
                  ? `${items.length} товар${items.length % 10 === 1 && items.length % 100 !== 11 ? "" : items.length % 10 >= 2 && items.length % 10 <= 4 && (items.length % 100 < 10 || items.length % 100 >= 20) ? "а" : "ов"} в избранном`
                  : "Здесь появятся сохранённые товары"}
            </p>
          </div>
          <Link
            to="/account"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/70 hover:text-brand transition"
          >
            ← К заказам
          </Link>
        </div>

        {q.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white overflow-hidden animate-pulse">
                <div className="aspect-square bg-surface-strong" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-3/4 bg-surface-strong rounded" />
                  <div className="h-4 w-1/2 bg-surface-strong rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-10 md:p-16 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
              <Heart className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold mb-1">Пока пусто</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Нажимайте на сердечко на карточках, чтобы сохранить товар.
            </p>
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 shadow-sm transition"
            >
              <ShoppingBag className="h-4 w-4" /> Перейти в каталог
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 animate-fade-in">
            {items.map((p) => (
              <div key={p.id} className="flex flex-col group/fav relative">
                <ProductCard
                  id={p.id}
                  title={p.title}
                  price_kopecks={p.price_kopecks}
                  image_url={p.image_url}
                  stock={p.stock}
                />
                <div className="px-1 pt-1 pb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <Link
                    to="/seller/$id"
                    params={{ id: p.seller_id }}
                    className="truncate hover:text-brand transition"
                  >
                    {p.seller_name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive transition"
                    aria-label="Удалить из избранного"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
