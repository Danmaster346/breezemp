// Меню категорий: десктоп-дропдаун + мобильный bottom-sheet.
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, X, LayoutGrid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryIcon } from "@/lib/category-icons";

type Category = { id: string; slug: string; name: string };

function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,slug,name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Компактная кнопка «Каталог» с всплывающим меню (десктоп). */
export function CategoryMenu() {
  const router = useRouter();
  const prefetchCategory = (slug: string) => {
    void router
      .preloadRoute({ to: "/catalog", search: { category: slug } as never })
      .catch(() => {});
  };
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cats = useCategories();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-sm font-semibold text-foreground/90 hover:bg-surface ui-transition"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <LayoutGrid className="h-4 w-4" />
        Каталог
        <ChevronDown
          className={`h-4 w-4 opacity-70 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 z-50 w-[560px] max-w-[92vw] rounded-2xl border bg-popover shadow-[var(--shadow-elevated)] p-2 animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <div className="grid grid-cols-2 gap-1 max-h-[70vh] overflow-y-auto no-scrollbar p-1">
            {cats.isLoading &&
              Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-11 rounded-xl bg-surface animate-pulse" />
              ))}
            {cats.data?.map((c) => {
              const Icon = getCategoryIcon(c.slug);
              return (
                <Link
                  key={c.id}
                  to="/catalog"
                  search={{ category: c.slug } as never}
                  onMouseEnter={() => prefetchCategory(c.slug)}
                  onFocus={() => prefetchCategory(c.slug)}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 h-11 px-3 rounded-xl text-sm font-medium text-foreground/85 hover:bg-brand/10 hover:text-brand ui-transition"
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{c.name}</span>
                </Link>
              );
            })}
          </div>
          <div className="mt-1 border-t pt-1">
            <Link
              to="/catalog"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between h-10 px-3 rounded-xl text-sm font-semibold text-brand hover:bg-brand/10 ui-transition"
            >
              Все категории
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** Мобильная кнопка + bottom-sheet со всеми категориями. */
export function CategorySheetButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const cats = useCategories();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-sm font-semibold bg-brand text-brand-foreground hover:bg-brand-strong ui-transition ${className}`}
      >
        <LayoutGrid className="h-4 w-4" />
        Каталог
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 animate-in fade-in-0 duration-150"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl bg-popover text-popover-foreground shadow-[var(--shadow-elevated)] flex flex-col animate-in slide-in-from-bottom duration-200 safe-pb">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b">
              <div className="font-display font-bold text-lg">Категории</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-full hover:bg-surface ui-transition"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              {cats.data?.map((c) => {
                const Icon = getCategoryIcon(c.slug);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate({ to: "/catalog", search: { category: c.slug } as never });
                    }}
                    className="w-full flex items-center gap-3 h-14 px-3 rounded-xl text-[15px] font-medium text-foreground hover:bg-brand/10 hover:text-brand ui-transition"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface">
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <span className="flex-1 text-left truncate">{c.name}</span>
                    <ChevronRight className="h-4 w-4 opacity-40" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
