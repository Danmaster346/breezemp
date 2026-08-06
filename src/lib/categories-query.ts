// Кэшируемые справочники: категории меняются редко — держим час.
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CATEGORIES_STALE_TIME = 60 * 60 * 1000; // 1 час

export function categoriesQueryOptions() {
  return queryOptions({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, icon_url")
        .order("name");
      if (error) throw error;
      return data;
    },
    staleTime: CATEGORIES_STALE_TIME,
    gcTime: 2 * CATEGORIES_STALE_TIME,
  });
}
