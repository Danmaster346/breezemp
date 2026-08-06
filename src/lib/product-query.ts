// Общие queryOptions для товара — используются и на странице товара,
// и для prefetch при наведении на карточку в каталоге.
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PRODUCT_FIELDS =
  "id, title, description, price_kopecks, compare_at_price_kopecks, image_url, image_urls, stock, seller_id, category_id, is_active, created_at, categories(name,slug)";

export function productQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_FIELDS)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
