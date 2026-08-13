// Горизонтальная витрина товаров: скролл-снап на мобиле, сетка на десктопе.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ProductCard, type ProductCardProps } from "@/components/ProductCard";
import { ProductGridSkeleton } from "@/components/Skeletons";

export function SectionHeader({
  title,
  subtitle,
  aside,
}: {
  title: string;
  subtitle?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-extrabold tracking-tight md:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}

export function ProductRow({
  items,
  loading,
  emptyText = "Товаров пока нет",
  priority = false,
}: {
  items: ProductCardProps[];
  loading?: boolean;
  emptyText?: string;
  priority?: boolean;
}) {
  if (loading) return <ProductGridSkeleton count={10} />;
  if (items.length === 0)
    return (
      <div className="rounded-2xl bg-surface p-10 text-center text-muted-foreground">{emptyText}</div>
    );

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-5">
      {items.map((p, i) => (
        <div key={p.id} className="w-[45vw] shrink-0 snap-start sm:w-[32vw] md:w-auto">
          <ProductCard {...p} priority={priority && i < 5} />
        </div>
      ))}
    </div>
  );
}

export function ShowAllLink({
  to,
  search,
  label = "Показать все →",
}: {
  to: "/catalog";
  search?: Record<string, unknown>;
  label?: string;
}) {
  return (
    <Link
      to={to}
      search={search as never}
      className="text-sm font-semibold text-brand hover:text-brand-strong"
    >
      {label}
    </Link>
  );
}
