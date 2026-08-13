// Хук работы с избранным на клиенте: единый queryKey + optimistic toggle
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { toastFavorite } from "@/lib/toasts";
import { supabase } from "@/integrations/supabase/client";
import { listFavoriteIds, toggleFavorite } from "@/lib/favorites.functions";

export const FAVORITES_IDS_KEY = ["favorites", "ids"] as const;

export function useFavoriteIds() {
  const load = useServerFn(listFavoriteIds);
  return useQuery({
    queryKey: FAVORITES_IDS_KEY,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return [] as string[];
      return load();
    },
    staleTime: 60_000,
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  const mutate = useServerFn(toggleFavorite);
  const m = useMutation({
    mutationFn: (product_id: string) => mutate({ data: { product_id } }),
    onMutate: async (product_id) => {
      await qc.cancelQueries({ queryKey: FAVORITES_IDS_KEY });
      const prev = qc.getQueryData<string[]>(FAVORITES_IDS_KEY) ?? [];
      const next = prev.includes(product_id)
        ? prev.filter((x) => x !== product_id)
        : [...prev, product_id];
      qc.setQueryData<string[]>(FAVORITES_IDS_KEY, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(FAVORITES_IDS_KEY, ctx.prev);
      toast.error("Не удалось обновить избранное. Войдите, чтобы сохранять товары.");
    },
    onSuccess: (res) => {
      toastFavorite(res.favored);
      qc.invalidateQueries({ queryKey: ["favorites"] });
    },
  });
  return m;
}

export function useIsFavorite(productId: string) {
  const { data } = useFavoriteIds();
  return useMemo(() => (data ?? []).includes(productId), [data, productId]);
}

export function useFavoriteHandler(productId: string) {
  const { mutate, isPending } = useToggleFavorite();
  const toggle = useCallback(
    async (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        toast.info("Войдите, чтобы добавлять товары в избранное");
        return;
      }
      mutate(productId);
    },
    [mutate, productId],
  );
  return { toggle, isPending };
}
