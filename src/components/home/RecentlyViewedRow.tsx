// Блок «Недавно смотрели»: id из localStorage, товары подгружаются из БД.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getRecentlyViewed } from "@/lib/recently-viewed";
import { ProductRow, SectionHeader } from "@/components/home/ProductRow";

export function RecentlyViewedRow() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => setIds(getRecentlyViewed()), []);

  const q = useQuery({
    queryKey: ["recently-viewed-products", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, price_kopecks, image_url, stock, compare_at_price_kopecks, created_at")
        .in("id", ids)
        .eq("is_active", true);
      if (error) throw error;
      return ids.map((id) => data?.find((p) => p.id === id)).filter((p) => !!p);
    },
    staleTime: 5 * 60 * 1000,
  });

  if (ids.length === 0 || (q.data && q.data.length === 0)) return null;

  const clear = () => {
    try {
      window.localStorage.removeItem("kupiks:recently-viewed");
    } catch {
      // приватный режим — игнорируем
    }
    setIds([]);
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pt-10 md:pt-14">
      <SectionHeader
        title="Недавно смотрели"
        aside={
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-destructive ui-transition"
          >
            <Trash2 className="h-4 w-4" /> Очистить историю
          </button>
        }
      />
      <ProductRow items={q.data ?? []} loading={q.isLoading} />
    </section>
  );
}
