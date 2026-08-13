// Страница карточки товара — премиальный e-commerce стиль
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart-store";
import { trackProduct } from "@/lib/analytics/track";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/ProductCard";
import { getRecentlyViewed, pushRecentlyViewed } from "@/lib/recently-viewed";

import { toast } from "sonner";
import { toastAddedToCart, toastLinkCopied } from "@/lib/toasts";
import {
  ShoppingCart,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Truck,
  ShieldCheck,
  RotateCcw,
  BadgeCheck,
  Star,
  Store,
  MessageCircle,
  Minus,
  Plus,
  Share2,
  Link2,
  Send,
} from "lucide-react";
import { ProductReviews } from "@/components/ProductReviews";
import { ProductPageSkeleton } from "@/components/Skeletons";
import { productQueryOptions } from "@/lib/product-query";
import { useServerFn } from "@tanstack/react-start";
import { getProductReviews } from "@/lib/reviews.functions";
import { getSellerProfile } from "@/lib/seller-profile.functions";
import { openConversation } from "@/lib/messaging/messaging.functions";
import { useAuth } from "@/lib/use-auth";
import { setPendingAdd, useSignInDialog } from "@/lib/pending-cart";
import { useNavigate } from "@tanstack/react-router";

const SITE = "https://kupiks-marketplace.ru";

export const Route = createFileRoute("/product/$id")({
  loader: async ({ params, context }) => {
    const product = await context.queryClient.ensureQueryData(productQueryOptions(params.id));
    // Рейтинг и продавец нужны для JSON-LD разметки — тянем мягко, без падения страницы
    const [reviews, seller] = await Promise.all([
      getProductReviews({ data: { product_id: params.id } }).catch(() => null),
      product?.seller_id
        ? getSellerProfile({ data: { id: product.seller_id } }).catch(() => null)
        : Promise.resolve(null),
    ]);
    return {
      product,
      rating: reviews?.avg ?? 0,
      reviewsCount: reviews?.count ?? 0,
      sellerName: seller?.name ?? "Kupiks",

    };
  },
  head: ({ params, loaderData }) => {
    const p = loaderData?.product ?? null;
    const title = p?.title ? `${p.title} — купить на Kupiks` : "Товар — Kupiks";
    const description =
      (p?.description ?? "").slice(0, 160) ||
      `${p?.title ?? "Товар"} — купить на Kupiks с доставкой по всей России.`;
    const url = `${SITE}/product/${params.id}`;
    const image = p?.image_url ?? null;
    const priceRub = p ? (p.price_kopecks / 100).toFixed(2) : null;

    const jsonLd = p
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.title,
          description: p.description ?? undefined,
          image: image ?? undefined,
          offers: {
            "@type": "Offer",
            url,
            price: priceRub,
            priceCurrency: "RUB",
            availability:
              (p.stock ?? 0) > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            seller: { "@type": "Organization", name: loaderData?.sellerName ?? "Kupiks" },
          },
          ...((loaderData?.reviewsCount ?? 0) > 0
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: (loaderData?.rating ?? 0).toFixed(1),
                  reviewCount: String(loaderData?.reviewsCount ?? 0),
                },
              }
            : {}),
        }
      : null;

    // Хлебные крошки для поиска: Главная → Каталог → [Категория] → Товар
    const cat = (p as { categories?: { name?: string | null; slug?: string | null } | null } | null)
      ?.categories ?? null;
    const breadcrumbs = p
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Главная", item: SITE },
            { "@type": "ListItem", position: 2, name: "Каталог", item: `${SITE}/catalog` },
            ...(cat?.name && cat?.slug
              ? [
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: cat.name,
                    item: `${SITE}/catalog?category=${encodeURIComponent(cat.slug)}`,
                  },
                ]
              : []),
            {
              "@type": "ListItem",
              position: cat?.name && cat?.slug ? 4 : 3,
              name: p.title,
              item: url,
            },
          ],
        }
      : null;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        ...(priceRub
          ? [
              { property: "product:price:amount", content: priceRub },
              { property: "product:price:currency", content: "RUB" },
            ]
          : []),
        ...(image && /^https:\/\//.test(image)
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      ...(jsonLd
        ? {
            scripts: [
              { type: "application/ld+json", children: JSON.stringify(jsonLd) },
              ...(breadcrumbs
                ? [{ type: "application/ld+json", children: JSON.stringify(breadcrumbs) }]
                : []),
            ],
          }
        : {}),
    };
  },


  component: ProductPage,
  errorComponent: ({ error }) => (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center" role="alert">
        <h1 className="text-xl font-semibold">Не удалось загрузить товар</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </AppLayout>
  ),
  notFoundComponent: () => (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Товар не найден</h1>
      </div>
    </AppLayout>
  ),
});

type RailProduct = {
  id: string;
  title: string;
  price_kopecks: number;
  image_url: string | null;
  stock: number;
};

const RAIL_FIELDS = "id, title, price_kopecks, image_url, stock";

// Горизонтальная карусель товаров
function ProductRail({ title, items }: { title: string; items: RailProduct[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="text-xl md:text-2xl font-extrabold tracking-tight mb-4">{title}</h2>
      <div className="-mx-4 px-4 flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2">
        {items.map((p) => (
          <div key={p.id} className="w-[46%] sm:w-56 shrink-0 snap-start">
            <ProductCard
              id={p.id}
              title={p.title}
              price_kopecks={p.price_kopecks}
              image_url={p.image_url}
              stock={p.stock}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

// Кнопка «Поделиться»
function ShareMenu({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toastLinkCopied();
    } catch {
      toast.error("Не удалось скопировать ссылку");
    }
    setOpen(false);
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-sm hover:bg-surface transition"
      >
        <Share2 className="h-4 w-4" /> Поделиться
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-52 rounded-xl border border-border bg-white p-1.5 shadow-lg animate-fade-in">
          <button
            type="button"
            onClick={copy}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface transition"
          >
            <Link2 className="h-4 w-4" /> Скопировать ссылку
          </button>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface transition"
          >
            <Send className="h-4 w-4" /> Telegram
          </a>
          <a
            href={`https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface transition"
          >
            <span className="grid h-4 w-4 place-items-center text-[11px] font-bold">VK</span>
            ВКонтакте
          </a>
        </div>
      )}
    </div>
  );
}

function ProductPage() {
  const { id } = Route.useParams();
  const add = useCart((s) => s.add);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const mobileTrack = useRef<HTMLDivElement | null>(null);
  const fetchReviews = useServerFn(getProductReviews);
  const fetchSeller = useServerFn(getSellerProfile);
  const openChat = useServerFn(openConversation);
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: product, isLoading, error } = useQuery(productQueryOptions(id));

  const ratingQuery = useQuery({
    queryKey: ["product-reviews", id],
    queryFn: () => fetchReviews({ data: { product_id: id } }),
    staleTime: 2 * 60 * 1000,
  });
  const avg = ratingQuery.data?.avg ?? 0;
  const reviewsCount = ratingQuery.data?.count ?? 0;

  const sellerQuery = useQuery({
    queryKey: ["seller-profile-mini", product?.seller_id],
    enabled: !!product?.seller_id,
    queryFn: () => fetchSeller({ data: { id: product!.seller_id } }),
    staleTime: 5 * 60 * 1000,
  });

  // Похожие товары из той же категории
  const similarQuery = useQuery({
    queryKey: ["similar-products", product?.category_id, id],
    enabled: !!product?.category_id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("products")
        .select(RAIL_FIELDS)
        .eq("category_id", product!.category_id!)
        .eq("is_active", true)
        .neq("id", id)
        .order("created_at", { ascending: false })
        .limit(8);
      if (err) throw err;
      return (data ?? []) as RailProduct[];
    },
  });

  // Недавно просмотренные
  const recentQuery = useQuery({
    queryKey: ["recently-viewed", recentIds.join(",")],
    enabled: recentIds.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("products")
        .select(RAIL_FIELDS)
        .in("id", recentIds)
        .eq("is_active", true);
      if (err) throw err;
      const rows = (data ?? []) as RailProduct[];
      return recentIds
        .map((rid) => rows.find((r) => r.id === rid))
        .filter((r): r is RailProduct => !!r);
    },
  });

  // Статистика просмотров карточки + запись в «Вы смотрели»
  useEffect(() => {
    if (!product?.id) return;
    trackProduct(product.id, "view");
    const prev = getRecentlyViewed().filter((v) => v !== product.id);
    setRecentIds(prev.slice(0, 8));
    pushRecentlyViewed(product.id);
  }, [product?.id]);

  // Сброс количества и активного фото при смене товара
  useEffect(() => {
    setQty(1);
    setActiveImg(0);
  }, [id]);

  const gallery: string[] = product
    ? ((product as { image_urls?: string[] | null }).image_urls?.length
        ? ((product as { image_urls: string[] }).image_urls)
        : product.image_url
          ? [product.image_url]
          : [])
    : [];

  const goTo = useCallback(
    (next: number) => {
      if (gallery.length === 0) return;
      const idx = (next + gallery.length) % gallery.length;
      setActiveImg(idx);
      const el = mobileTrack.current;
      if (el) el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
    },
    [gallery.length],
  );

  const maxQty = Math.max(1, product?.stock ?? 1);

  const addToCart = () => {
    if (!product) return;

    if (!user) {
      // Гость — сохраняем намерение и открываем модалку входа
      setPendingAdd({ productId: product.id, qty });
      useSignInDialog.getState().show({
        message:
          "Чтобы добавить товар в корзину, войдите в аккаунт или зарегистрируйтесь. После входа товар добавится автоматически.",
        redirectTo: `/product/${product.id}`,
      });
      return;
    }
    add(
      {
        id: product.id,
        title: product.title,
        price_kopecks: product.price_kopecks,
        image_url: product.image_url,
        seller_id: product.seller_id,
        stock: product.stock,
      },
      qty,
    );
    trackProduct(product.id, "add_to_cart");
    toastAddedToCart(qty > 1 ? `${product.title} — ${qty} шт.` : product.title, () => navigate({ to: "/cart" }));
  };

  const writeSeller = async () => {
    if (!product) return;
    if (!user) {
      toast.error("Войдите, чтобы написать продавцу");
      navigate({ to: "/auth" });
      return;
    }
    if (user.id === product.seller_id) {
      toast.error("Это ваш собственный товар");
      return;
    }
    try {
      const res = await openChat({
        data: { seller_id: product.seller_id, product_id: product.id },
      });
      navigate({ to: "/messages/$conversationId", params: { conversationId: res.id } });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-4 md:py-6 pb-28 md:pb-6">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand transition mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Назад в каталог
        </Link>

        {isLoading ? (
          <ProductPageSkeleton />
        ) : error || !product ? (
          <div className="py-20 text-center text-muted-foreground">Товар не найден</div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-6 md:gap-10 animate-fade-in items-start">
              {/* Галерея */}
              <div>
                {/* Мобильная галерея — горизонтальный свайп со snap */}
                <div className="md:hidden -mx-4">
                  <div
                    ref={mobileTrack}
                    className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      const idx = Math.round(el.scrollLeft / el.clientWidth);
                      if (idx !== activeImg) setActiveImg(idx);
                    }}
                  >
                    {gallery.length === 0 ? (
                      <div className="w-full shrink-0 aspect-square bg-surface flex items-center justify-center text-8xl opacity-30">
                        🛍️
                      </div>
                    ) : (
                      gallery.map((url, i) => (
                        <div key={i} className="w-full shrink-0 snap-center aspect-square bg-white">
                          <img
                            src={url}
                            alt={product.title}
                            width={800}
                            height={800}
                            loading={i === 0 ? "eager" : "lazy"}
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))
                    )}
                  </div>
                  {gallery.length > 1 && (
                    <div className="mt-3 flex justify-center gap-1.5">
                      {gallery.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={`Фото ${i + 1}`}
                          onClick={() => goTo(i)}
                          className={`h-1.5 rounded-full transition-all ${
                            i === activeImg ? "w-6 bg-brand" : "w-1.5 bg-border"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Desktop-галерея: крупное фото + стрелки + миниатюры */}
                <div className="hidden md:block">
                  <div className="group relative h-[400px] lg:h-[480px] rounded-2xl bg-white border border-border overflow-hidden">
                    {gallery.length > 0 ? (
                      gallery.map((url, i) => (
                        <img
                          key={url + i}
                          src={url}
                          alt={product.title}
                          width={900}
                          height={900}
                          loading={i === 0 ? "eager" : "lazy"}
                          decoding="async"
                          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
                            i === activeImg ? "opacity-100" : "opacity-0 pointer-events-none"
                          }`}
                        />
                      ))
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-8xl opacity-30">
                        🛍️
                      </div>
                    )}

                    {gallery.length > 1 && (
                      <>
                        <button
                          type="button"
                          aria-label="Предыдущее фото"
                          onClick={() => goTo(activeImg - 1)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-white/90 border border-border shadow-sm opacity-0 group-hover:opacity-100 hover:bg-white transition"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Следующее фото"
                          onClick={() => goTo(activeImg + 1)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-white/90 border border-border shadow-sm opacity-0 group-hover:opacity-100 hover:bg-white transition"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>

                  {gallery.length > 1 && (
                    <div className="mt-3 grid grid-cols-6 gap-2">
                      {gallery.map((url, i) => (
                        <button
                          key={url + i}
                          type="button"
                          onClick={() => setActiveImg(i)}
                          className={`aspect-square rounded-xl overflow-hidden border-2 transition ${
                            i === activeImg
                              ? "border-brand shadow-sm"
                              : "border-transparent hover:border-border"
                          }`}
                        >
                          <img
                            src={url}
                            alt=""
                            width={160}
                            height={160}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Информация + sticky-блок покупки */}
              <div className="md:sticky md:top-4">
                {product.categories && (
                  <Link
                    to="/catalog"
                    search={{ category: product.categories.slug }}
                    className="inline-flex text-xs font-semibold uppercase tracking-wider text-brand hover:underline mb-2"
                  >
                    {product.categories.name}
                  </Link>
                )}
                <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight leading-tight">
                  {product.title}
                </h1>

                {reviewsCount > 0 && (
                  <a
                    href="#reviews"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm hover:underline"
                  >
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold">{avg.toFixed(1)}</span>
                    <span className="text-muted-foreground">
                      · {reviewsCount}{" "}
                      {reviewsCount === 1
                        ? "отзыв"
                        : reviewsCount < 5
                          ? "отзыва"
                          : "отзывов"}
                    </span>
                  </a>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {sellerQuery.data && (
                    <Link
                      to="/seller/$id"
                      params={{ id: sellerQuery.data.id }}
                      className="inline-flex items-center gap-2 rounded-full bg-surface hover:bg-surface-strong px-3 py-1.5 text-sm transition group"
                    >
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-brand-foreground">
                        <Store className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-muted-foreground">Продавец:</span>
                      <span className="font-semibold text-foreground group-hover:text-brand transition">
                        {sellerQuery.data.name}
                      </span>
                      {sellerQuery.data.reviewsCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {sellerQuery.data.avgRating.toFixed(1)}
                        </span>
                      )}
                    </Link>
                  )}

                  {product.seller_id && (!user || user.id !== product.seller_id) && (
                    <button
                      type="button"
                      onClick={writeSeller}
                      className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-white px-3 py-1.5 text-sm text-brand hover:bg-brand-soft transition"
                    >
                      <MessageCircle className="h-4 w-4" /> Написать продавцу
                    </button>
                  )}

                  <ShareMenu title={product.title} />
                </div>

                <div className="mt-6 flex items-baseline gap-3">
                  <div className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                    {formatPrice(product.price_kopecks)}
                  </div>
                </div>
                <div
                  className={`mt-2 text-sm font-medium ${
                    product.stock > 0 ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {product.stock > 0 ? `В наличии: ${product.stock} шт.` : "Нет в наличии"}
                </div>

                {/* Счётчик количества + кнопка (desktop) */}
                <div className="hidden md:flex mt-6 items-center gap-3">
                  <div className="inline-flex items-center rounded-full border border-border bg-white">
                    <button
                      type="button"
                      aria-label="Уменьшить количество"
                      disabled={qty <= 1}
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="grid h-11 w-11 place-items-center rounded-l-full hover:bg-surface disabled:opacity-40 transition"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-10 text-center text-base font-semibold tabular-nums">
                      {qty}
                    </span>
                    <button
                      type="button"
                      aria-label="Увеличить количество"
                      disabled={qty >= maxQty || product.stock === 0}
                      onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                      className="grid h-11 w-11 place-items-center rounded-r-full hover:bg-surface disabled:opacity-40 transition"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    disabled={product.stock === 0}
                    onClick={addToCart}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-brand px-8 py-3.5 text-base font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition"
                  >
                    <ShoppingCart className="h-5 w-5" />
                    {product.stock === 0 ? "Нет в наличии" : "В корзину"}
                  </button>
                </div>

                {/* Блок доверия */}
                <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-white p-4">
                  {[
                    { icon: ShieldCheck, label: "Безопасная оплата" },
                    { icon: Truck, label: "Доставка по всей России" },
                    { icon: RotateCcw, label: "Возврат 14 дней" },
                    { icon: BadgeCheck, label: "Гарантия подлинности" },
                  ].map((b) => {
                    const Icon = b.icon;
                    return (
                      <div key={b.label} className="flex items-center gap-2">
                        <Icon className="h-5 w-5 shrink-0 text-brand" />
                        <span className="text-xs md:text-sm font-medium leading-tight">
                          {b.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {product.description && (
              <div className="mt-10 max-w-3xl">
                <h2 className="text-lg font-extrabold tracking-tight mb-2">Описание</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}
          </>
        )}

        {product && (
          <div id="reviews">
            <ProductReviews productId={product.id} />
          </div>
        )}

        <ProductRail title="Похожие товары" items={similarQuery.data ?? []} />
        <ProductRail title="Вы смотрели" items={recentQuery.data ?? []} />
      </div>

      {/* Мобильная sticky-панель покупки */}
      {product && (
        <div className="md:hidden fixed bottom-nav inset-x-0 z-30 border-t border-border bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-8px_20px_-8px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-border bg-white">
              <button
                type="button"
                aria-label="Уменьшить количество"
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="grid h-9 w-9 place-items-center rounded-l-full disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-7 text-center text-sm font-semibold tabular-nums">{qty}</span>
              <button
                type="button"
                aria-label="Увеличить количество"
                disabled={qty >= maxQty || product.stock === 0}
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                className="grid h-9 w-9 place-items-center rounded-r-full disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              disabled={product.stock === 0}
              onClick={addToCart}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50 shadow-sm transition"
            >
              <ShoppingCart className="h-4 w-4" />
              {product.stock === 0
                ? "Нет в наличии"
                : `В корзину · ${formatPrice(product.price_kopecks * qty)}`}
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
