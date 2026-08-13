import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ErrorScreen } from "./components/ErrorBoundary";
import { captureClientError } from "./lib/error-capture";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Данные товаров/каталога считаем свежими 5 минут
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    // Любая ошибка рендеринга/загрузчика маршрута — дружелюбный экран вместо белого
    defaultErrorComponent: ({ error }) => {
      captureClientError(error);
      return <ErrorScreen error={error} />;
    },
  });

  return router;
};
