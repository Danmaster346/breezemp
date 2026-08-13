// Общие строительные блоки кабинета продавца: защита роутов и единый стиль страниц.
import type { ReactNode } from "react";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";

/**
 * Защита раздела «/seller/*»: пускает только пользователей с ролью продавца.
 * Пока роли загружаются — показываем скелетон, покупателю — предложение стать продавцом.
 */
export function SellerGuard({ children }: { children: ReactNode }) {
  const { user, isSeller, loading, rolesLoading } = useAuth();

  if (loading || rolesLoading) {
    return <SellerPageSkeleton />;
  }

  if (user && !isSeller) {
    return (
      <div className="rounded-2xl border border-dashed p-8 md:p-12 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-surface">
          <Store className="h-5 w-5 text-foreground/70" strokeWidth={1.75} />
        </div>
        <h2 className="font-display text-xl font-extrabold tracking-tight">
          Раздел доступен продавцам
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Вы вошли как покупатель. Подключите профиль продавца, чтобы публиковать товары,
          принимать заказы и видеть аналитику.
        </p>
        <button
          onClick={async () => {
            try {
              const { becomeSeller } = await import("@/lib/roles.functions");
              await becomeSeller();
              toast.success("Теперь вы продавец!");
              window.location.reload();
            } catch (err) {
              toast.error("Не удалось подключить профиль продавца", {
                description: (err as Error).message,
              });
            }
          }}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground hover:opacity-90 ui-transition"
        >
          Стать продавцом
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

/** Скелетон загрузки страницы кабинета. */
export function SellerPageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-surface" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-surface" />
    </div>
  );
}

/** Единый заголовок страницы внутри кабинета. */
export function SellerPageHeader({
  title,
  description,
  actions,
  loading,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-xl md:text-2xl font-extrabold tracking-tight">
          {title}
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Карточка-секция единого стиля. */
export function SellerSection({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-card hairline p-4 md:p-5 ${className}`}>
      {title && (
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}
