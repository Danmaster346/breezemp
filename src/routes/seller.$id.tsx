// Публичная страница продавца: /seller/$id
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Star,
  Store,
  Package,
  MessageSquare,
  ArrowLeft,
  Truck,
  Award,
  Phone,
  Mail,
  Send,
  Instagram,
  Users,
  Link as LinkIcon,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/ProductCard";
import { getSellerProfile, type SellerContacts } from "@/lib/seller-profile.functions";

export const Route = createFileRoute("/seller/$id")({
  head: () => ({
    meta: [
      { title: "Магазин продавца — BreezeMarket" },
      { name: "description", content: "Публичная страница продавца: товары, рейтинг и отзывы." },
    ],
  }),
  component: SellerPage,
});

function pluralReviews(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return "отзыв";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "отзыва";
  return "отзывов";
}
function pluralProducts(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return "товар";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "товара";
  return "товаров";
}

type ContactItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
};

function contactItems(c: SellerContacts): ContactItem[] {
  const items: ContactItem[] = [];
  if (c.phone) items.push({ icon: Phone, label: "Телефон", value: c.phone, href: `tel:${c.phone.replace(/\s+/g, "")}` });
  if (c.email) items.push({ icon: Mail, label: "Email", value: c.email, href: `mailto:${c.email}` });
  if (c.whatsapp) {
    const digits = c.whatsapp.replace(/[^\d]/g, "");
    items.push({ icon: MessageSquare, label: "WhatsApp", value: c.whatsapp, href: digits ? `https://wa.me/${digits}` : undefined });
  }
  if (c.telegram) {
    const h = c.telegram.startsWith("@") ? `https://t.me/${c.telegram.slice(1)}` : c.telegram.startsWith("http") ? c.telegram : `https://t.me/${c.telegram}`;
    items.push({ icon: Send, label: "Telegram", value: c.telegram, href: h });
  }
  if (c.instagram) {
    const h = c.instagram.startsWith("@") ? `https://instagram.com/${c.instagram.slice(1)}` : c.instagram.startsWith("http") ? c.instagram : `https://instagram.com/${c.instagram}`;
    items.push({ icon: Instagram, label: "Instagram", value: c.instagram, href: h });
  }
  if (c.vk) {
    const h = c.vk.startsWith("http") ? c.vk : `https://${c.vk}`;
    items.push({ icon: Users, label: "VK", value: c.vk, href: h });
  }
  if (c.other_social) {
    const h = c.other_social.startsWith("http") ? c.other_social : `https://${c.other_social}`;
    items.push({ icon: LinkIcon, label: "Ссылка", value: c.other_social, href: h });
  }
  return items;
}

function SellerPage() {
  const { id } = Route.useParams();
  const fetchProfile = useServerFn(getSellerProfile);

  const { data, isLoading, error } = useQuery({
    queryKey: ["seller-profile", id],
    queryFn: () => fetchProfile({ data: { id } }),
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-4 md:py-6 pb-28 md:pb-10">
        <Link
          to="/catalog"
          search={{ q: "", category: "", minPrice: undefined, maxPrice: undefined, minRating: undefined, inStock: undefined, sort: "relevance", page: 1 } as never}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand transition mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> В каталог
        </Link>

        {isLoading ? (
          <div className="animate-pulse space-y-6">
            <div className="h-40 rounded-3xl bg-surface" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl bg-surface" />
              ))}
            </div>
          </div>
        ) : error || !data ? (
          <div className="py-20 text-center">
            <div className="text-5xl mb-3">🏪</div>
            <div className="text-lg font-semibold">Продавец не найден</div>
            <p className="text-sm text-muted-foreground mt-1">
              Возможно, магазин удалён или ссылка неверна.
            </p>
          </div>
        ) : (
          <>
            {/* Шапка магазина */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-soft via-white to-white border border-brand/20 p-6 md:p-8">
              <div className="flex items-start gap-4 md:gap-6">
                <div className="grid h-16 w-16 md:h-20 md:w-20 shrink-0 place-items-center rounded-2xl bg-brand text-brand-foreground shadow-sm overflow-hidden">
                  {data.logoUrl ? (
                    <img src={data.logoUrl} alt={data.name} className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-8 w-8 md:h-10 md:w-10" strokeWidth={1.75} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-brand">
                    Магазин продавца
                  </div>
                  <h1 className="mt-1 text-2xl md:text-4xl font-extrabold tracking-tight leading-tight truncate">
                    {data.name}
                  </h1>
                  {data.shortDescription && (
                    <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl">
                      {data.shortDescription}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2 md:gap-3 text-sm">
                    {data.reviewsCount > 0 ? (
                      <Chip>
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="font-bold">{data.avgRating.toFixed(1)}</span>
                        <span className="text-muted-foreground">
                          · {data.reviewsCount} {pluralReviews(data.reviewsCount)}
                        </span>
                      </Chip>
                    ) : (
                      <Chip>
                        <Star className="h-4 w-4" />
                        <span className="text-muted-foreground">Ещё нет отзывов</span>
                      </Chip>
                    )}
                    <Chip>
                      <Package className="h-4 w-4 text-brand" />
                      <span className="font-semibold">{data.productsCount}</span>
                      <span className="text-muted-foreground">
                        {pluralProducts(data.productsCount)}
                      </span>
                    </Chip>
                    {data.deliveredRate > 0 && (
                      <Chip>
                        <Truck className="h-4 w-4 text-emerald-600" />
                        <span className="font-semibold">{data.deliveredRate}%</span>
                        <span className="text-muted-foreground">успешных доставок</span>
                      </Chip>
                    )}
                  </div>
                  {data.badges.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {data.badges.map((b) => (
                        <span
                          key={b}
                          className="inline-flex items-center gap-1 rounded-full bg-brand/10 text-brand border border-brand/20 px-2.5 py-1 text-xs font-semibold"
                        >
                          <Award className="h-3.5 w-3.5" /> {b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Описание и контакты */}
            {(data.fullDescription || contactItems(data.contacts).length > 0) && (
              <section className="mt-6 grid gap-4 md:grid-cols-3">
                {data.fullDescription && (
                  <div className="md:col-span-2 rounded-2xl border bg-card p-5">
                    <h2 className="text-sm font-semibold mb-2">О магазине</h2>
                    <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                      {data.fullDescription}
                    </p>
                  </div>
                )}
                {contactItems(data.contacts).length > 0 && (
                  <div className="rounded-2xl border bg-card p-5">
                    <h2 className="text-sm font-semibold mb-3">Контакты</h2>
                    <ul className="space-y-2">
                      {contactItems(data.contacts).map((c) => {
                        const Icon = c.icon;
                        const inner = (
                          <>
                            <Icon className="h-4 w-4 text-brand shrink-0" />
                            <div className="min-w-0">
                              <div className="text-[11px] text-muted-foreground">{c.label}</div>
                              <div className="text-sm truncate">{c.value}</div>
                            </div>
                          </>
                        );
                        return (
                          <li key={c.label}>
                            {c.href ? (
                              <a
                                href={c.href}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-3 rounded-xl hover:bg-surface p-2 -m-2 transition"
                              >
                                {inner}
                              </a>
                            ) : (
                              <div className="flex items-center gap-3 p-2 -m-2">{inner}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* Товары */}
            <section className="mt-8">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-lg md:text-xl font-extrabold tracking-tight">
                  Товары магазина
                </h2>
                <span className="text-sm text-muted-foreground">
                  {data.productsCount} {pluralProducts(data.productsCount)}
                </span>
              </div>
              {data.products.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
                  {data.products.map((p) => (
                    <ProductCard key={p.id} {...p} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-surface p-10 text-center text-muted-foreground">
                  У этого продавца пока нет активных товаров.
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 border border-border">
      {children}
    </div>
  );
}
