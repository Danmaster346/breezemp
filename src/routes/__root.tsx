// Корневой макет приложения BreezeMarket с русской мета-информацией
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
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Попробуйте обновить страницу или вернитесь на главную.
        </p>
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
      { title: "BreezeMarket — маркетплейс с товарами от продавцов" },
      {
        name: "description",
        content:
          "BreezeMarket — простой многовендорный маркетплейс: каталог товаров, корзина и оформление заказа за минуту.",
      },
      { property: "og:title", content: "BreezeMarket — маркетплейс с товарами от продавцов" },
      {
        property: "og:description",
        content:
          "Каталог, корзина, кабинет продавца — простой маркетплейс на русском.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "BreezeMarket — маркетплейс с товарами от продавцов" },
      { name: "description", content: "True marketplace" },
      { property: "og:description", content: "True marketplace" },
      { name: "twitter:description", content: "True marketplace" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/qvUjVsi9wdVKHUenJLw7xtrNNpa2/social-images/social-1783082467731-1000020662.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/qvUjVsi9wdVKHUenJLw7xtrNNpa2/social-images/social-1783082467731-1000020662.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap",
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
