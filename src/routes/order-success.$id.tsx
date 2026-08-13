// Экран подтверждения заказа: номер, сводка доставки и товаров, итоги
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { SmartImage } from "@/components/SmartImage";
import { getOrderById } from "@/lib/orders.functions";
import { formatPrice } from "@/lib/format";
import { getShippingOption } from "@/lib/shipping";
import { normalizeStatus, STATUS_LABELS, STATUS_BADGE } from "@/lib/order-status";
import {
  CheckCircle2,
  Package,
  Truck,
  MapPin,
  User,
  Phone,
  CreditCard,
  Tag,
  ShoppingBag,
  ArrowRight,
  FileText,
  Home,
} from "lucide-react";

export const Route = createFileRoute("/order-success/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Заказ оформлен — Kupiks" },
      {
        name: "description",
        content: `Заказ №${params.id.slice(0, 8).toUpperCase()} успешно оформлен на маркетплейсе Kupiks.`,
      },
      { name: "robots", content: "noindex,follow" },
      { property: "og:title", content: "Заказ оформлен — Kupiks" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ params, context }) => {
    const order = await context.queryClient.ensureQueryData({
      queryKey: ["order-success", params.id],
      queryFn: () => getOrderById({ data: { id: params.id } }),
      staleTime: 5 * 60 * 1000,
    });
    return { order };
  },
  component: OrderSuccessPage,
});

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

type OrderItem = {
  id: string;
  product_id: string | null;
  title_snapshot: string;
  image_url: string | null;
  price_kopecks: number;
  quantity: number;
  status: string | null;
};

type Order = {
  id: string;
  created_at: string;
  total_kopecks: number;
  shipping_cost_kopecks: number | null;
  discount_kopecks: number | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  shipping_method: string | null;
  promo_code: string | null;
  order_items: OrderItem[];
};

function OrderSuccessPage() {
  const { id } = Route.useParams();
  const fetchOrder = useServerFn(getOrderById);
  const { data: order } = useSuspenseQuery({
    queryKey: ["order-success", id],
    queryFn: () => fetchOrder({ data: { id } }),
    staleTime: 5 * 60 * 1000,
  });

  const o = order as unknown as Order;
  const code = o.id.replace(/-/g, "").slice(0, 8).toUpperCase();
  const shipping = getShippingOption(o.shipping_method ?? "cdek");
  const items = o.order_items ?? [];
  const subtotal = items.reduce((sum, it) => sum + it.price_kopecks * it.quantity, 0);
  const discount = o.discount_kopecks ?? 0;
  const shippingCost = o.shipping_cost_kopecks ?? 0;
  const total = o.total_kopecks;
  const itemsCount = items.reduce((sum, it) => sum + it.quantity, 0);
  const status = normalizeStatus(items[0]?.status ?? "processing");

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-14">
        {/* Шапка подтверждения */}
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-6 md:p-8 text-center shadow-sm">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-emerald-900">Заказ оформлен!</h1>
          <p className="mt-2 text-sm md:text-base text-emerald-800/80">
            Спасибо за покупку. Мы отправили подтверждение на вашу почту.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-emerald-900 shadow-sm">
            <FileText className="h-4 w-4" />
            Номер заказа: <span className="font-mono font-bold">{code}</span>
          </div>
        </div>

        {/* Сводка доставки */}
        <div className="mt-6 rounded-3xl border border-border bg-card p-5 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand">
              <Truck className="h-4 w-4" />
            </div>
            <h2 className="font-semibold text-lg">Доставка</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-surface p-4 space-y-3">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Получатель</div>
                  <div className="text-sm font-medium">{o.shipping_name ?? "—"}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Телефон</div>
                  <div className="text-sm font-medium">{o.shipping_phone ?? "—"}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Адрес</div>
                  <div className="text-sm font-medium">{o.shipping_address ?? "—"}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-surface p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Package className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Способ доставки</div>
                  <div className="text-sm font-medium">
                    {shipping.emoji} {shipping.label}
                  </div>
                  <div className="text-xs text-muted-foreground">{shipping.description}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Срок доставки</div>
                  <div className="text-sm font-medium">{shipping.eta}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="h-4 w-4 flex items-center justify-center text-muted-foreground mt-1 shrink-0">
                  <span className="block h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <div>
                  <div className="text-xs text-muted-foreground">Статус</div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-muted-foreground">
            Оформлен {fmtDate(o.created_at)}
          </div>
        </div>

        {/* Состав заказа */}
        <div className="mt-6 rounded-3xl border border-border bg-card p-5 md:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <h2 className="font-semibold text-lg">Состав заказа</h2>
            </div>
            <span className="text-sm text-muted-foreground">
              {itemsCount} {itemsCount === 1 ? "товар" : itemsCount < 5 ? "товара" : "товаров"}
            </span>
          </div>

          <div className="space-y-3">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-4 rounded-2xl border border-border bg-white p-3"
              >
                <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-xl bg-surface overflow-hidden">
                  <SmartImage
                    src={it.image_url}
                    alt={it.title_snapshot}
                    width={120}
                    height={120}
                    className="h-full w-full object-cover"
                    wrapperClassName="h-full w-full"
                    priority
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium line-clamp-2">{it.title_snapshot}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{it.quantity} шт.</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold">{formatPrice(it.price_kopecks * it.quantity)}</div>
                  <div className="text-xs text-muted-foreground">{formatPrice(it.price_kopecks)} / шт.</div>
                </div>
              </div>
            ))}
          </div>

          {/* Итоги */}
          <div className="mt-5 rounded-2xl bg-surface p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Товары</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" /> Промокод {o.promo_code}
                </span>
                <span className="text-emerald-600 font-medium">−{formatPrice(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Доставка ({shipping.label})</span>
              <span>{shippingCost === 0 ? "Бесплатно" : formatPrice(shippingCost)}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between items-center">
              <span className="font-semibold">Итого</span>
              <span className="text-xl font-bold">{formatPrice(total)}</span>
            </div>
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="mt-6 grid sm:grid-cols-2 gap-3">
          <Link
            to="/catalog"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 font-semibold text-primary-foreground hover:opacity-90 transition"
          >
            <Home className="h-4 w-4" />
            Перейти в каталог
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/account"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-3.5 font-semibold hover:bg-accent transition"
          >
            <CreditCard className="h-4 w-4" />
            Мои заказы
          </Link>
        </div>

        {/* Подсказка */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Вы можете отслеживать статус заказа в разделе «Мои заказы» или в уведомлениях.
        </p>
      </div>
    </AppLayout>
  );
}

// Иконка часов для блока доставки
function Clock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
