// Карточка товара — Askona-style + кнопка «В избранное»
// Оптимизации: ленивое изображение (IntersectionObserver + width/height)
// и prefetch данных страницы товара при наведении.
// На мобиле свайп влево открывает быстрое действие «В избранное».
import { Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
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

const SWIPE_WIDTH = 92; // ширина открывающегося действия

export function ProductCard(p: ProductCardProps) {
  const out = p.stock === 0;
  const favored = useIsFavorite(p.id);
  const { toggle, isPending } = useFavoriteHandler(p.id);
  const qc = useQueryClient();
  const router = useRouter();

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
                : "bg-card/85 text-foreground/70 border-border hover:bg-card hover:text-brand"
            } ${isPending ? "opacity-70" : ""}`}
          >
            <Heart className={`h-4 w-4 ${favored ? "fill-current" : ""}`} />
          </button>
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
          <div className="text-lg md:text-xl font-extrabold text-foreground tracking-tight leading-none">
            {formatPrice(p.price_kopecks)}
          </div>
          <div className="text-sm text-foreground/80 line-clamp-2 min-h-[2.5rem] leading-snug">
            {p.title}
          </div>
        </div>
      </Link>
    </div>
  );
}
