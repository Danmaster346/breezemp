// Корневой макет приложения Kupiks с русской мета-информацией
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { registerServiceWorker } from "@/lib/register-sw";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

// Экран «не найдено» на русском
function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Страница не найдена</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Похоже, такой страницы нет или она была перемещена.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          На главную
        </a>
      </div>
    </div>
  );
}

// Экран ошибки на русском
function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  const message = (error && (error.message || String(error))) || "Неизвестная ошибка";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Попробуйте обновить страницу или вернитесь на главную.
        </p>
        <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-left text-xs text-muted-foreground break-words">
          <div className="font-medium text-foreground mb-1">Детали ошибки</div>
          <div className="whitespace-pre-wrap">{message}</div>
          {error?.stack && (
            <details className="mt-2">
              <summary className="cursor-pointer">Стек</summary>
              <pre className="mt-1 whitespace-pre-wrap text-[10px] leading-snug">{error.stack}</pre>
            </details>
          )}
        </div>
        <div className="mt-6 flex gap-2 justify-center">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Попробовать снова
          </button>
          <a
            href="/"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            На главную
          </a>
        </div>
      </div>
    </div>
  );
}


// Создаём корневой маршрут с контекстом QueryClient
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Kupiks — маркетплейс товаров от проверенных продавцов" },
      {
        name: "description",
        content:
          "Kupiks — современный маркетплейс: тысячи товаров, честные цены и быстрая доставка по всей России.",
      },
      { property: "og:title", content: "Kupiks — маркетплейс товаров от проверенных продавцов" },
      { property: "og:description", content: "Тысячи товаров, честные цены и быстрая доставка по всей России." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Kupiks — маркетплейс товаров от проверенных продавцов" },
      { name: "twitter:description", content: "Тысячи товаров, честные цены и быстрая доставка." },
      // PWA
      { name: "theme-color", content: "#ff6b35" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Kupiks" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],

    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },

      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Предзагрузка основного шрифта (font-display: swap уже в URL)
      {
        rel: "preload",
        as: "style",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// HTML-оболочка документа
function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Провайдер React Query + слот дочерних маршрутов + всплывающие уведомления
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster
        position="top-right"
        richColors
        closeButton
        expand
        duration={3500}
        mobileOffset={{ top: "12px", left: "12px", right: "12px" }}
        toastOptions={{
          classNames: {
            toast:
              "rounded-xl border shadow-lg text-sm font-medium",
          },
        }}
      />
    </QueryClientProvider>
  );
}
