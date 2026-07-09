// Поисковая строка с автодополнением. Показывает подсказки: фото, название,
// продавец, цена. Работает с debounce и клавиатурной навигацией.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Search, X, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { suggestCatalog } from "@/lib/catalog-search.functions";

type Props = {
  value: string;
  onSubmit: (v: string) => void;
  placeholder?: string;
  compact?: boolean;
};

export function CatalogSearchBar({ value, onSubmit, placeholder, compact }: Props) {
  const [q, setQ] = useState(value);
  const [debounced, setDebounced] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const suggest = useServerFn(suggestCatalog);

  useEffect(() => setQ(value), [value]);

  // debounce ввода
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const suggestions = useQuery({
    queryKey: ["catalog-suggest", debounced],
    enabled: debounced.length >= 2 && open,
    queryFn: () => suggest({ data: { q: debounced } }),
    staleTime: 30_000,
  });

  // Закрытие по клику вне
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const items = suggestions.data ?? [];
  const submit = (v: string) => {
    setOpen(false);
    setHighlight(-1);
    onSubmit(v);
  };

  return (
    <div ref={boxRef} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (highlight >= 0 && items[highlight]) {
            navigate({ to: "/product/$id", params: { id: items[highlight].id } });
            setOpen(false);
            return;
          }
          submit(q.trim());
        }}
        className={`flex items-center ${compact ? "h-10" : "h-12"} rounded-full bg-surface pl-4 pr-2 focus-within:ring-2 focus-within:ring-brand/30 transition`}
      >
        <Search className="h-5 w-5 text-muted-foreground shrink-0" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((i) => Math.min(items.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((i) => Math.max(-1, i - 1));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          type="search"
          placeholder={placeholder ?? "Поиск по товарам, продавцам и категориям"}
          className="flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground/80 min-w-0"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              submit("");
            }}
            className="mr-1 grid place-items-center h-8 w-8 rounded-full hover:bg-white text-muted-foreground"
            aria-label="Очистить"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="submit"
          className={`ml-1 inline-flex items-center justify-center ${compact ? "h-8 px-3" : "h-10 px-4"} rounded-full bg-brand text-brand-foreground text-sm font-semibold hover:bg-brand-strong transition`}
        >
          Найти
        </button>
      </form>

      {open && debounced.length >= 2 && (
        <div className="absolute z-50 left-0 right-0 mt-2 rounded-2xl border border-border bg-white shadow-xl overflow-hidden">
          {suggestions.isLoading ? (
            <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Ищем…
            </div>
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              Ничего не найдено по «{debounced}»
            </div>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto">
              {items.map((it, i) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => {
                      navigate({ to: "/product/$id", params: { id: it.id } });
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${
                      i === highlight ? "bg-surface" : "hover:bg-surface"
                    }`}
                  >
                    <div className="h-12 w-12 rounded-xl bg-surface overflow-hidden shrink-0">
                      {it.image_url ? (
                        <img
                          src={it.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-xl opacity-40">
                          🛍️
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium line-clamp-1">
                        {it.title}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {it.seller_name}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-foreground shrink-0">
                      {formatPrice(it.price_kopecks)}
                    </div>
                  </button>
                </li>
              ))}
              <li className="border-t border-border">
                <button
                  type="button"
                  onClick={() => submit(debounced)}
                  className="w-full px-4 py-2.5 text-sm text-brand font-semibold hover:bg-brand-soft transition text-left"
                >
                  Показать все результаты для «{debounced}»
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
