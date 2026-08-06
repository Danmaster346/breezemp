// Карточка товара — Askona-style + кнопка «В избранное»
// Оптимизации: ленивое изображение (IntersectionObserver + width/height)
// и prefetch данных страницы товара при наведении.
import { Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { Heart } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { useFavoriteHandler, useIsFavorite } from "@/lib/favorites-client";
import { SmartImage } from "@/components/SmartImage";
import { productQueryOptions } from "@/lib/product-query";

export type ProductCardProps = {
  id: string;
  title: string;
  price_kopecks: number;
  image_url: string | null;
  stock: number;
  /** LCP-карточка (первые в сетке) — грузим фото сразу */
  priority?: boolean;
};

export function ProductCard(p: ProductCardProps) {
  const out = p.stock === 0;
  const favored = useIsFavorite(p.id);
  const { toggle, isPending } = useFavoriteHandler(p.id);
  const qc = useQueryClient();
  const router = useRouter();

  // Prefetch: при наведении/тапе начинаем грузить данные страницы товара
  const prefetch = useCallback(() => {
    qc.prefetchQuery(productQueryOptions(p.id));
    void router.preloadRoute({ to: "/product/$id", params: { id: p.id } }).catch(() => {});
  }, [qc, router, p.id]);

  return (
    <Link
      to="/product/$id"
      params={{ id: p.id }}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onTouchStart={prefetch}
      className="group flex flex-col rounded-2xl overflow-hidden bg-white hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.15)] transition-all duration-300"
    >
      {/* Фото на мягком сером фоне — как у Askona */}
      <div className="relative aspect-square bg-surface rounded-2xl overflow-hidden">
        <SmartImage
          src={p.image_url}
          alt={p.title}
          width={400}
          height={400}
          priority={p.priority}
          wrapperClassName="h-full w-full"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />
        {/* Кнопка избранного */}
        <button
          type="button"
          onClick={toggle}
          disabled={isPending}
          aria-label={favored ? "Убрать из избранного" : "В избранное"}
          aria-pressed={favored}
          className={`absolute top-2 right-2 h-9 w-9 grid place-items-center rounded-full backdrop-blur-md border transition-all shadow-sm ${
            favored
              ? "bg-brand text-brand-foreground border-brand"
              : "bg-white/85 text-foreground/70 border-white/70 hover:bg-white hover:text-brand"
          } ${isPending ? "opacity-70" : ""}`}
        >
          <Heart className={`h-4 w-4 ${favored ? "fill-current" : ""}`} />
        </button>
        {out && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-destructive shadow-sm">
              Нет в наличии
            </span>
          </div>
        )}
      </div>
      {/* Инфо */}
      <div className="pt-3 pb-1 px-1 flex flex-col gap-1">
        <div className="text-lg md:text-xl font-extrabold text-foreground tracking-tight leading-none">
          {formatPrice(p.price_kopecks)}
        </div>
        <div className="text-sm text-foreground/80 line-clamp-2 min-h-[2.5rem] leading-snug">
          {p.title}
        </div>
      </div>
    </Link>
  );
}
