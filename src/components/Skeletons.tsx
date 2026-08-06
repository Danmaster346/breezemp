// Единые skeleton-заглушки: каталог, витрина главной, карточка товара.
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-square rounded-2xl skeleton-shimmer" />
      <div className="h-5 w-24 rounded skeleton-shimmer" />
      <div className="h-3 w-full rounded skeleton-shimmer" />
      <div className="h-3 w-2/3 rounded skeleton-shimmer" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function CategoryTilesSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <div className="aspect-square w-full rounded-2xl skeleton-shimmer" />
          <div className="h-3 w-16 rounded skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}

export function ProductPageSkeleton() {
  return (
    <div className="grid md:grid-cols-2 gap-6 md:gap-10">
      <div>
        <div className="aspect-square rounded-2xl skeleton-shimmer" />
        <div className="mt-3 hidden md:grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl skeleton-shimmer" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-3 w-24 rounded skeleton-shimmer" />
        <div className="h-8 w-4/5 rounded skeleton-shimmer" />
        <div className="h-6 w-32 rounded skeleton-shimmer" />
        <div className="h-10 w-44 rounded skeleton-shimmer" />
        <div className="h-12 w-full rounded-xl skeleton-shimmer" />
        <div className="h-24 w-full rounded-xl skeleton-shimmer" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl skeleton-shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}
