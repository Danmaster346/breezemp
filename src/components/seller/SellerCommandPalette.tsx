// Глобальный поиск кабинета продавца (Ctrl+K / ⌘K): заказы, товары, разделы.
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
import { getSellerOrderItems } from "@/lib/order-history.functions";
import { useSellerNavGroups } from "@/components/SellerSidebar";
import { usePanels } from "@/lib/panels-store";

type OrderRow = {
  id: string;
  title_snapshot: string;
  price_kopecks: number;
  quantity: number;
  status: string | null;
  orders: { id: string; created_at: string; shipping_name: string | null } | null;
};

export function SellerSearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold text-muted-foreground hover:bg-accent ui-transition"
    >
      <Search className="h-4 w-4" />
      Поиск по кабинету
      <kbd className="ml-1 hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold md:inline">⌘K</kbd>
    </button>
  );
}

export function SellerCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const groups = useSellerNavGroups(0);
  const openMessages = usePanels((s) => s.openMessages);
  const fetchOrders = useServerFn(getSellerOrderItems);

  const orders = useQuery({
    queryKey: ["seller-orders", user?.id],
    enabled: !!user && open,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await fetchOrders()) as unknown as OrderRow[],
  });

  const products = useQuery({
    queryKey: ["seller-products-lite", user?.id],
    enabled: !!user && open,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, price_kopecks, stock")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const go = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Заказ, товар или раздел…" />
      <CommandList>
        <CommandEmpty>Ничего не найдено</CommandEmpty>

        {groups.map((g) => (
          <CommandGroup key={g.title} heading={g.title}>
            {g.items.map((it) => (
              <CommandItem
                key={`${it.to}-${it.label}`}
                value={`${g.title} ${it.label}`}
                onSelect={() =>
                  go(() => {
                    if (it.panel === "messages") openMessages();
                    else if (it.panel === "notifications") usePanels.getState().openNotifications();
                    else navigate({ to: it.to, search: it.search ?? {} });
                  })
                }
              >
                <it.icon className="mr-2 h-4 w-4" />
                {it.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        {(orders.data ?? []).length > 0 && (
          <CommandGroup heading="Заказы">
            {(orders.data ?? []).slice(0, 30).map((o) => (
              <CommandItem
                key={o.id}
                value={`заказ ${o.orders?.id.slice(0, 8) ?? ""} ${o.orders?.shipping_name ?? ""} ${o.title_snapshot}`}
                onSelect={() => go(() => navigate({ to: "/seller/orders" }))}
              >
                <span className="font-semibold">#{o.orders?.id.slice(0, 8) ?? "—"}</span>
                <span className="ml-2 truncate">{o.title_snapshot}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatPrice(o.price_kopecks * o.quantity)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {(products.data ?? []).length > 0 && (
          <CommandGroup heading="Товары">
            {(products.data ?? []).slice(0, 30).map((p) => (
              <CommandItem
                key={p.id}
                value={`товар ${p.title}`}
                onSelect={() => go(() => navigate({ to: "/product/$id", params: { id: p.id } }))}
              >
                <span className="truncate">{p.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatPrice(p.price_kopecks)} · {p.stock} шт
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/** Хук горячей клавиши Ctrl+K / ⌘K. */
export function useCommandPaletteHotkey() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}
