// Универсальный компонент хлебных крошек — читает route staticData.
import { Link, useMatches } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import type { ReactNode } from "react";

type Crumb = { label: ReactNode; to?: string };

export function Breadcrumbs({ items, className = "" }: { items?: Crumb[]; className?: string }) {
  const matches = useMatches();

  const auto: Crumb[] = matches
    .map((m) => {
      const label = (m.staticData as { crumb?: string } | undefined)?.crumb;
      if (!label) return null;
      return { label, to: m.pathname };
    })
    .filter(Boolean) as Crumb[];

  const list = items ?? auto;
  if (!list.length) return null;

  return (
    <nav aria-label="Хлебные крошки" className={`text-xs sm:text-sm ${className}`}>
      <ol className="flex items-center gap-1 flex-wrap text-muted-foreground">
        <li>
          <Link
            to="/"
            className="inline-flex items-center gap-1 hover:text-foreground ui-transition"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Главная</span>
          </Link>
        </li>
        {list.map((c, i) => {
          const last = i === list.length - 1;
          return (
            <li key={i} className="flex items-center gap-1 min-w-0">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
              {last || !c.to ? (
                <span className="truncate text-foreground font-medium">{c.label}</span>
              ) : (
                <Link
                  to={c.to}
                  className="truncate hover:text-foreground ui-transition"
                >
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
