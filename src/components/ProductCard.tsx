// Карточка товара — премиальный e-commerce стиль
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
      className="group flex flex-col overflow-hidden rounded-xl bg-card border border-border hover:border-brand/40 hover:shadow-[0_8px_24px_-8px_rgba(23,135,155,0.25)] transition-all duration-200"
    >
      {/* Фото */}
      <div className="relative aspect-square bg-surface overflow-hidden">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-5xl opacity-40">🛍️</div>
        )}
        {out && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-destructive border border-destructive/20 shadow-sm">
              Нет в наличии
            </span>
          </div>
        )}
      </div>
      {/* Инфо */}
      <div className="p-3 md:p-4 flex flex-col gap-1.5">
        <div className="text-sm text-foreground/80 line-clamp-2 min-h-[2.5rem] leading-snug">
          {p.title}
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <div className="text-lg md:text-xl font-bold text-foreground tracking-tight">
            {formatPrice(p.price_kopecks)}
          </div>
        </div>
        {!out && (
          <div className="text-[11px] font-medium text-emerald-600 mt-0.5">
            В наличии
          </div>
        )}
      </div>
    </Link>
  );
}
