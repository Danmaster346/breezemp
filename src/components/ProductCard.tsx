// Карточка товара в каталоге
import { Link } from "@tanstack/react-router";
import { formatPrice } from "@/lib/format";

// Тип входных данных
export type ProductCardProps = {
  id: string;
  title: string;
  price_kopecks: number;
  image_url: string | null;
  stock: number;
};

// Компонент карточки товара
export function ProductCard(p: ProductCardProps) {
  return (
    <Link
      to="/product/$id"
      params={{ id: p.id }}
      className="group flex flex-col overflow-hidden rounded-2xl bg-card border transition hover:shadow-lg hover:-translate-y-0.5"
    >
      {/* Изображение или заглушка */}
      <div className="aspect-square bg-muted overflow-hidden">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.title}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-4xl">🛍️</div>
        )}
      </div>
      {/* Инфо-блок */}
      <div className="p-3 flex flex-col gap-1">
        <div className="text-lg font-bold">{formatPrice(p.price_kopecks)}</div>
        <div className="text-sm text-foreground line-clamp-2 min-h-[2.5rem]">{p.title}</div>
        {p.stock === 0 && (
          <div className="text-xs text-destructive font-medium mt-1">Нет в наличии</div>
        )}
      </div>
    </Link>
  );
}
