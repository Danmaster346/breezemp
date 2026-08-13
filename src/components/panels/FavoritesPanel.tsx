// Всплывающая панель «Избранное» — карточки сохранённых товаров.
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Heart, ShoppingBag, Trash2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ProductCard } from "@/components/ProductCard";
import { listFavorites } from "@/lib/favorites.functions";
import { useToggleFavorite } from "@/lib/favorites-client";
import { usePanels } from "@/lib/panels-store";
import { useAuth } from "@/lib/use-auth";

export function FavoritesPanel() {
  const { user } = useAuth();
  const open = usePanels((s) => s.favoritesOpen);
  const close = usePanels((s) => s.closeFavorites);

  const load = useServerFn(listFavorites);
  const q = useQuery({
    queryKey: ["favorites", "list"],
    queryFn: () => load(),
    enabled: open && !!user,
  });
  const { mutate: toggle } = useToggleFavorite();
  const items = q.data ?? [];

  return (
    <Sheet open={open && !!user} onOpenChange={(v) => (v ? null : close())}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md md:max-w-lg"
        aria-describedby={undefined}
      >
        <div className="border-b border-border px-4 pb-3 pt-5">
          <div className="flex items-center gap-2 pr-8">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand-soft text-brand">
              <Heart className="h-4 w-4 fill-current" />
            </span>
            <h2 className="text-lg font-bold tracking-tight">Избранное</h2>
            {items.length > 0 && (
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                {items.length}
              </span>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {q.isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse overflow-hidden rounded-2xl bg-card">
                  <div className="aspect-square bg-surface-strong" />
                  <div className="space-y-2 p-3">
                    <div className="h-3 w-3/4 rounded bg-surface-strong" />
                    <div className="h-4 w-1/2 rounded bg-surface-strong" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
                <Heart className="h-6 w-6" />
              </div>
              <h3 className="mb-1 font-semibold">Пока пусто</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Нажимайте на сердечко на карточках, чтобы сохранить товар.
              </p>
              <Link
                to="/catalog"
                onClick={close}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:opacity-90"
              >
                <ShoppingBag className="h-4 w-4" /> Перейти в каталог
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {items.map((p) => (
                <div key={p.id} className="flex flex-col" onClick={close}>
                  <ProductCard
                    id={p.id}
                    title={p.title}
                    price_kopecks={p.price_kopecks}
                    image_url={p.image_url}
                    stock={p.stock}
                  />
                  <div className="flex items-center justify-between px-1 pb-1 pt-1 text-[11px] text-muted-foreground">
                    <Link
                      to="/seller/$id"
                      params={{ id: p.seller_id }}
                      className="truncate transition hover:text-brand"
                    >
                      {p.seller_name}
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(p.id);
                      }}
                      className="inline-flex items-center gap-1 transition hover:text-destructive"
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

        <div className="border-t border-border p-3">
          <Link
            to="/favorites"
            onClick={close}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-brand"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Открыть на отдельной странице
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
