import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Reintentos con espera creciente: si la red falla un momento, la app se
  // recupera sola en vez de mostrar un error técnico.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 3,
        retryDelay: (intento) => Math.min(1000 * 2 ** intento, 8000),
        refetchOnWindowFocus: true,
      },
      mutations: { retry: 1 },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
