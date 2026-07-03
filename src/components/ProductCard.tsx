// Карточка товара — Askona-style: мягкий серый фон под фото, минимализм
import { Link } from "@tanstack/react-router";
import { formatPrice } from "@/lib/format";

export type ProductCardProps = {
  id: string;
  title: string;
  price_kopecks: number;
  image_url: string | null;
  stock: number;
};

export function ProductCard(p: ProductCardProps) {
  const out = p.stock === 0;
  return (
    <Link
      to="/product/$id"
      params={{ id: p.id }}
      className="group flex flex-col rounded-2xl overflow-hidden bg-white hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.15)] transition-all duration-300"
    >
      {/* Фото на мягком сером фоне — как у Askona */}
      <div className="relative aspect-square bg-surface rounded-2xl overflow-hidden">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-5xl opacity-30">🛍️</div>
        )}
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
