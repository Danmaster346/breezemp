// Карточка товара — Askona-style: бейджи скидки/новинки, рейтинг,
// избранное и быстрое добавление в корзину (hover на десктопе, «+» на мобиле).
// Оптимизации: ленивое изображение (IntersectionObserver + width/height)
// и prefetch данных страницы товара при наведении.
// На мобиле свайп влево открывает быстрое действие «В избранное».
import { Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { Heart, Plus, ShoppingCart, Star } from "lucide-react";
import { toast } from "sonner";
import { toastAddedToCart } from "@/lib/toasts";
import { formatPrice } from "@/lib/format";
import { useFavoriteHandler, useIsFavorite } from "@/lib/favorites-client";
import { SmartImage } from "@/components/SmartImage";
import { productQueryOptions } from "@/lib/product-query";
import { useCart } from "@/lib/cart-store";

export type ProductCardProps = {
  id: string;
  title: string;
  price_kopecks: number;
  image_url: string | null;
  stock: number;
  /** Старая цена — для бейджа скидки */
  compare_at_price_kopecks?: number | null;
  /** Дата создания — для бейджа «NEW» (младше 7 дней) */
  created_at?: string | null;
  rating?: number;
  reviews_count?: number;
  seller_id?: string;
  /** LCP-карточка (первые в сетке) — грузим фото сразу */
  priority?: boolean;
};

const SWIPE_WIDTH = 92; // ширина открывающегося действия
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function ProductCard(p: ProductCardProps) {
  const out = p.stock === 0;
  const favored = useIsFavorite(p.id);
  const { toggle, isPending } = useFavoriteHandler(p.id);
  const qc = useQueryClient();
  const router = useRouter();
  const addToCart = useCart((s) => s.add);

  // Бейджи
  const oldPrice = p.compare_at_price_kopecks ?? 0;
  const discountPercent =
    oldPrice > p.price_kopecks
      ? Math.round(((oldPrice - p.price_kopecks) / oldPrice) * 100)
      : 0;
  const isNew = p.created_at
    ? Date.now() - new Date(p.created_at).getTime() < WEEK_MS
    : false;

  const rating = p.rating ?? 0;
  const reviewsCount = p.reviews_count ?? 0;

  // Свайп влево (только сенсорные устройства)
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const locked = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    prefetch();
    if (e.touches.length !== 1) return;
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    locked.current = false;
    setDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    const dx = e.touches[0].clientX - start.current.x;
    const dy = e.touches[0].clientY - start.current.y;
    // Вертикальный скролл — не мешаем
    if (!locked.current && Math.abs(dy) > Math.abs(dx)) {
      start.current = null;
      setDragging(false);
      setOffset(0);
      return;
    }
    if (Math.abs(dx) > 6) locked.current = true;
    if (dx < 0) setOffset(Math.max(-SWIPE_WIDTH, dx));
    else setOffset(0);
  };

  const onTouchEnd = () => {
    setDragging(false);
    start.current = null;
    setOffset((o) => (o < -SWIPE_WIDTH / 2 ? -SWIPE_WIDTH : 0));
  };

  // Prefetch: при наведении/тапе начинаем грузить данные страницы товара
  const prefetch = useCallback(() => {
    qc.prefetchQuery(productQueryOptions(p.id));
    void router.preloadRoute({ to: "/product/$id", params: { id: p.id } }).catch(() => {});
  }, [qc, router, p.id]);

  // Быстрое добавление в корзину
  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (out) return;
    addToCart(
      {
        id: p.id,
        title: p.title,
        price_kopecks: p.price_kopecks,
        image_url: p.image_url,
        seller_id: p.seller_id ?? "",
        stock: p.stock,
      },
      1,
    );
    toastAddedToCart(p.title, () => router.navigate({ to: "/cart" }));
  };

  return (
    <div className="relative">
      {/* Быстрое действие под карточкой (видно после свайпа влево, только мобила) */}
      <button
        type="button"
        onClick={(e) => {
          void toggle(e);
          setOffset(0);
        }}
        aria-hidden={offset === 0}
        tabIndex={-1}
        className={`md:hidden absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1 rounded-2xl bg-brand text-brand-foreground text-[11px] font-semibold transition-opacity ${
          offset === 0 ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={{ width: SWIPE_WIDTH }}
      >
        <Heart className={`h-5 w-5 ${favored ? "fill-current" : ""}`} />
        {favored ? "В избранном" : "В избранное"}
      </button>

      <Link
        to="/product/$id"
        params={{ id: p.id }}
        onMouseEnter={prefetch}
        onFocus={prefetch}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClick={(e) => {
          // Если карточка свайпнута — тап закрывает действие, а не открывает товар
          if (offset !== 0) {
            e.preventDefault();
            setOffset(0);
          }
        }}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 200ms ease",
        }}
        className="group relative flex flex-col rounded-2xl overflow-hidden bg-card hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.15)] transition-all duration-300"
      >
        {/* Фото на мягком сером фоне — как у Askona */}
        <div className="relative aspect-square bg-surface rounded-2xl overflow-hidden">
          <SmartImage
            src={p.image_url}
            alt={p.title}
            width={400}
            height={400}
            priority={p.priority}
            sizes="(max-width: 640px) 50vw, 25vw"
            wrapperClassName="h-full w-full"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />

          {/* Бейджи скидки и новинки */}
          <div className="absolute top-2 left-2 flex flex-col items-start gap-1.5">
            {discountPercent > 0 && (
              <span className="rounded-full bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground shadow-sm">
                −{discountPercent}%
              </span>
            )}
            {isNew && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                NEW
              </span>
            )}
          </div>

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
                : "bg-card/85 text-foreground/70 border-border hover:bg-card hover:text-brand"
            } ${isPending ? "opacity-70" : ""}`}
          >
            <Heart className={`h-4 w-4 ${favored ? "fill-current" : ""}`} />
          </button>

          {/* Быстрое добавление: снекбар снизу (десктоп, hover) */}
          {!out && (
            <button
              type="button"
              onClick={quickAdd}
              className="hidden md:flex absolute inset-x-2 bottom-2 h-10 items-center justify-center gap-2 rounded-xl bg-brand text-brand-foreground text-sm font-semibold shadow-lg translate-y-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 hover:bg-brand/90"
            >
              <ShoppingCart className="h-4 w-4" />В корзину
            </button>
          )}

          {/* Быстрое добавление: «+» (мобила) */}
          {!out && (
            <button
              type="button"
              onClick={quickAdd}
              aria-label="Добавить в корзину"
              className="md:hidden absolute bottom-2 right-2 h-9 w-9 grid place-items-center rounded-full bg-brand text-brand-foreground shadow-md active:scale-95 transition"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}

          {out && (
            <div className="absolute inset-0 bg-card/70 flex items-center justify-center">
              <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-destructive shadow-sm">
                Нет в наличии
              </span>
            </div>
          )}
        </div>
        {/* Инфо */}
        <div className="pt-3 pb-1 px-1 flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <div className="text-lg md:text-xl font-extrabold text-foreground tracking-tight leading-none">
              {formatPrice(p.price_kopecks)}
            </div>
            {discountPercent > 0 && (
              <div className="text-xs text-muted-foreground line-through">
                {formatPrice(oldPrice)}
              </div>
            )}
          </div>
          <div className="text-sm text-foreground/80 line-clamp-2 min-h-[2.5rem] leading-snug">
            {p.title}
          </div>
          {rating > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-foreground/70">{rating.toFixed(1)}</span>
              {reviewsCount > 0 && <span>({reviewsCount})</span>}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}
