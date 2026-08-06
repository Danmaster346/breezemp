// Настройки магазина продавца: оформление магазина, контакты, бейджи,
// статистика и превью публичной страницы.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Store,
  Upload,
  Trash2,
  Save,
  Star,
  Package,
  MessageSquare,
  Truck,
  ShoppingBag,
  Phone,
  Mail,
  Send,
  Instagram,
  Users,
  Link as LinkIcon,
  ExternalLink,
  Award,
  Info,
} from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  getMySellerSettings,
  updateSellerSettings,
  deleteMyLogo,
  getMyShopStats,
  computeAutoBadges,
  type SellerSettings,
} from "@/lib/seller-settings.functions";

export const Route = createFileRoute("/_authenticated/seller/settings")({
  head: () => ({ meta: [{ title: "Настройки магазина — BreezeMarket" }] }),
  component: SellerSettingsPage,
});

const MANUAL_BADGES = [
  "Надёжный продавец",
  "Быстрая отправка",
  "Высокий рейтинг",
  "Много заказов",
];

const emptyForm: SellerSettings = {
  shop_name: "",
  logo_path: null,
  logo_url: null,
  short_description: "",
  full_description: "",
  phone: "",
  email: "",
  whatsapp: "",
  telegram: "",
  instagram: "",
  vk: "",
  other_social: "",
  badges: [],
};

function SellerSettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getMySellerSettings);
  const fetchStats = useServerFn(getMyShopStats);
  const save = useServerFn(updateSellerSettings);
  const dropLogo = useServerFn(deleteMyLogo);

  const settingsQuery = useQuery({
    queryKey: ["seller-settings", user?.id],
    enabled: !!user,
    queryFn: () => fetchSettings(),
  });
  const statsQuery = useQuery({
    queryKey: ["shop-stats", user?.id],
    enabled: !!user,
    queryFn: () => fetchStats(),
  });

  const [form, setForm] = useState<SellerSettings>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = settingsQuery.data;
    if (!d) return;
    setForm({
      shop_name: d.shop_name || d.fallbackName || "",
      logo_path: d.logo_path,
      logo_url: d.logo_url,
      short_description: d.short_description,
      full_description: d.full_description,
      phone: d.phone,
      email: d.email,
      whatsapp: d.whatsapp,
      telegram: d.telegram,
      instagram: d.instagram,
      vk: d.vk,
      other_social: d.other_social,
      badges: d.badges,
    });
  }, [settingsQuery.data]);

  const autoBadges = useMemo(
    () =>
      statsQuery.data
        ? computeAutoBadges({
            ordersCount: statsQuery.data.ordersCount,
            avgRating: statsQuery.data.avgRating,
            deliveredRate: statsQuery.data.deliveredRate,
          })
        : [],
    [statsQuery.data],
  );

  const allBadges = useMemo(
    () => Array.from(new Set([...(form.badges ?? []), ...autoBadges])),
    [form.badges, autoBadges],
  );

  const set = <K extends keyof SellerSettings>(key: K, value: SellerSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleBadge = (b: string) => {
    setForm((f) => {
      const has = f.badges.includes(b);
      return { ...f, badges: has ? f.badges.filter((x) => x !== b) : [...f.badges, b] };
    });
  };

  const onFile = async (file: File) => {
    if (!user) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Логотип должен быть до 3 МБ");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("store-logos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      // получаем signed URL для превью до сохранения
      const { data: signed } = await supabase.storage
        .from("store-logos")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      set("logo_path", path);
      set("logo_url", signed?.signedUrl ?? null);
      toast.success("Логотип загружен");
    } catch (e) {
      toast.error("Не удалось загрузить логотип", { description: (e as Error).message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeLogo = useMutation({
    mutationFn: async () => dropLogo(),
    onSuccess: () => {
      set("logo_path", null);
      set("logo_url", null);
      toast.success("Логотип удалён");
      qc.invalidateQueries({ queryKey: ["seller-settings", user?.id] });
    },
    onError: (e: Error) => toast.error("Не удалось удалить", { description: e.message }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      return save({
        data: {
          shop_name: form.shop_name,
          logo_path: form.logo_path,
          short_description: form.short_description,
          full_description: form.full_description,
          phone: form.phone,
          email: form.email,
          whatsapp: form.whatsapp,
          telegram: form.telegram,
          instagram: form.instagram,
          vk: form.vk,
          other_social: form.other_social,
        },
      });
    },
    onSuccess: () => {
      toast.success("Настройки успешно сохранены");
      qc.invalidateQueries({ queryKey: ["seller-settings", user?.id] });
      qc.invalidateQueries({ queryKey: ["seller-profile"] });
    },
    onError: (e: Error) => toast.error("Не удалось сохранить", { description: e.message }),
  });

  if (settingsQuery.isLoading) {
    return <div className="text-muted-foreground">Загрузка настроек…</div>;
  }

  const stats = statsQuery.data;
  const statCards = [
    {
      label: "Товаров",
      value: stats ? String(stats.productsCount) : "—",
      icon: Package,
      accent: "from-brand/15 to-brand/5 text-brand",
    },
    {
      label: "Средний рейтинг",
      value: stats && stats.reviewsCount > 0 ? stats.avgRating.toFixed(1) : "—",
      icon: Star,
      accent: "from-amber-500/15 to-amber-500/5 text-amber-600",
    },
    {
      label: "Всего заказов",
      value: stats ? String(stats.ordersCount) : "—",
      icon: ShoppingBag,
      accent: "from-sky-500/15 to-sky-500/5 text-sky-600",
    },
    {
      label: "Отзывов",
      value: stats ? String(stats.reviewsCount) : "—",
      icon: MessageSquare,
      accent: "from-indigo-500/15 to-indigo-500/5 text-indigo-600",
    },
    {
      label: "Успешно доставлено",
      value: stats && stats.ordersCount > 0 ? `${stats.deliveredRate}%` : "—",
      icon: Truck,
      accent: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={`rounded-2xl border bg-gradient-to-br ${c.accent} p-4`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                  <div className="mt-1 text-lg md:text-xl font-bold text-foreground">
                    {c.value}
                  </div>
                </div>
                <div className="rounded-xl bg-background/60 p-2 shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Форма */}
        <div className="space-y-6">
          {/* Оформление */}
          <section className="rounded-2xl border bg-card overflow-hidden">
            <header className="px-5 py-4 border-b flex items-center gap-2">
              <Store className="h-4 w-4 text-brand" />
              <h2 className="font-semibold">Оформление магазина</h2>
            </header>
            <div className="p-5 space-y-5">
              {/* Логотип */}
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="h-24 w-24 rounded-2xl border bg-surface overflow-hidden grid place-items-center shrink-0">
                  {form.logo_url ? (
                    <img
                      src={form.logo_url}
                      alt="Логотип магазина"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Store className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Логотип магазина</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG или JPG, до 3 МБ. Рекомендовано 512×512.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium hover:bg-surface disabled:opacity-60"
                    >
                      <Upload className="h-4 w-4" />
                      {uploading ? "Загрузка…" : form.logo_url ? "Заменить" : "Загрузить"}
                    </button>
                    {form.logo_url && (
                      <button
                        type="button"
                        onClick={() => removeLogo.mutate()}
                        disabled={removeLogo.isPending}
                        className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 text-destructive px-3 py-2 text-sm font-medium hover:bg-destructive/5"
                      >
                        <Trash2 className="h-4 w-4" /> Удалить
                      </button>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onFile(f);
                      }}
                    />
                  </div>
                </div>
              </div>

              <Field label="Название магазина" required>
                <input
                  value={form.shop_name}
                  onChange={(e) => set("shop_name", e.target.value)}
                  maxLength={80}
                  placeholder="Например: BreezeStore"
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/30"
                />
              </Field>

              <Field
                label="Краткое описание"
                hint={`${form.short_description.length}/300 символов, показывается в шапке магазина`}
              >
                <input
                  value={form.short_description}
                  onChange={(e) => set("short_description", e.target.value.slice(0, 300))}
                  placeholder="Например: Уютный текстиль для дома, доставка по РФ"
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/30"
                />
              </Field>

              <Field
                label="Полное описание"
                hint="Расскажите о магазине, ассортименте, гарантиях. Переносы строк сохраняются."
              >
                <textarea
                  value={form.full_description}
                  onChange={(e) => set("full_description", e.target.value.slice(0, 4000))}
                  rows={6}
                  placeholder="Мы занимаемся производством домашнего текстиля с 2015 года…"
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/30 resize-y"
                />
              </Field>
            </div>
          </section>

          {/* Контакты */}
          <section className="rounded-2xl border bg-card overflow-hidden">
            <header className="px-5 py-4 border-b flex items-center gap-2">
              <Phone className="h-4 w-4 text-brand" />
              <h2 className="font-semibold">Контактная информация</h2>
            </header>
            <div className="p-5 grid gap-4 sm:grid-cols-2">
              <ContactField
                icon={Phone}
                label="Телефон"
                value={form.phone}
                onChange={(v) => set("phone", v)}
                placeholder="+7 999 000-00-00"
              />
              <ContactField
                icon={Mail}
                label="Email"
                value={form.email}
                onChange={(v) => set("email", v)}
                placeholder="shop@example.com"
              />
              <ContactField
                icon={MessageSquare}
                label="WhatsApp"
                value={form.whatsapp}
                onChange={(v) => set("whatsapp", v)}
                placeholder="+7 999 000-00-00"
              />
              <ContactField
                icon={Send}
                label="Telegram"
                value={form.telegram}
                onChange={(v) => set("telegram", v)}
                placeholder="@username"
              />
              <ContactField
                icon={Instagram}
                label="Instagram"
                value={form.instagram}
                onChange={(v) => set("instagram", v)}
                placeholder="@username"
              />
              <ContactField
                icon={Users}
                label="VK"
                value={form.vk}
                onChange={(v) => set("vk", v)}
                placeholder="vk.com/username"
              />
              <div className="sm:col-span-2">
                <ContactField
                  icon={LinkIcon}
                  label="Другая соцсеть / сайт"
                  value={form.other_social}
                  onChange={(v) => set("other_social", v)}
                  placeholder="https://…"
                />
              </div>
            </div>
          </section>

          {/* Бейджи */}
          <section className="rounded-2xl border bg-card overflow-hidden">
            <header className="px-5 py-4 border-b flex items-center gap-2">
              <Award className="h-4 w-4 text-brand" />
              <h2 className="font-semibold">Бейджи магазина</h2>
            </header>
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground inline-flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Отметьте бейджи, которые хотите показать покупателям. Часть бейджей
                присваивается автоматически по вашей активности.
              </p>
              <div className="flex flex-wrap gap-2">
                {MANUAL_BADGES.map((b) => {
                  const active = form.badges.includes(b);
                  const auto = autoBadges.includes(b);
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggleBadge(b)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? "bg-brand text-brand-foreground border-brand"
                          : "bg-background hover:bg-surface"
                      }`}
                    >
                      <Award className="h-3.5 w-3.5" />
                      {b}
                      {auto && (
                        <span
                          className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${
                            active ? "bg-white/20" : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          авто
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Сообщения: быстрые ответы и автоответ */}
          <MessagingSettings />



          {/* Save bar */}
          <div className="sticky bottom-4 z-10 rounded-2xl border bg-card/95 backdrop-blur px-4 py-3 shadow-lg flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Изменения сразу отражаются на публичной странице.
            </p>
            <button
              type="button"
              disabled={saveMutation.isPending || !form.shop_name.trim()}
              onClick={() => saveMutation.mutate()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Сохраняем…" : "Сохранить изменения"}
            </button>
          </div>
        </div>

        {/* Preview */}
        <aside className="space-y-3 lg:sticky lg:top-4 h-fit">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Как выглядит ваш магазин</h3>
            {user && (
              <Link
                to="/seller/$id"
                params={{ id: user.id }}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                Открыть <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
          <div className="rounded-3xl border border-brand/20 bg-gradient-to-br from-brand-soft via-white to-white p-5 overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand text-brand-foreground overflow-hidden">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Store className="h-7 w-7" strokeWidth={1.75} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                  Магазин продавца
                </div>
                <div className="text-lg font-extrabold leading-tight truncate">
                  {form.shop_name || "Название магазина"}
                </div>
                {form.short_description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {form.short_description}
                  </p>
                )}
              </div>
            </div>

            {allBadges.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {allBadges.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center gap-1 rounded-full bg-white border px-2 py-0.5 text-[11px] font-medium"
                  >
                    <Award className="h-3 w-3 text-brand" /> {b}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <MiniStat
                value={stats && stats.reviewsCount > 0 ? stats.avgRating.toFixed(1) : "—"}
                label="рейтинг"
              />
              <MiniStat value={stats ? String(stats.productsCount) : "—"} label="товаров" />
              <MiniStat value={stats ? String(stats.reviewsCount) : "—"} label="отзывов" />
            </div>

            {(form.phone ||
              form.email ||
              form.whatsapp ||
              form.telegram ||
              form.instagram ||
              form.vk ||
              form.other_social) && (
              <div className="mt-4 space-y-1.5 text-xs">
                {form.phone && <PreviewLine icon={Phone} value={form.phone} />}
                {form.email && <PreviewLine icon={Mail} value={form.email} />}
                {form.whatsapp && <PreviewLine icon={MessageSquare} value={form.whatsapp} />}
                {form.telegram && <PreviewLine icon={Send} value={form.telegram} />}
                {form.instagram && <PreviewLine icon={Instagram} value={form.instagram} />}
                {form.vk && <PreviewLine icon={Users} value={form.vk} />}
                {form.other_social && <PreviewLine icon={LinkIcon} value={form.other_social} />}
              </div>
            )}

            {form.full_description && (
              <div className="mt-4 rounded-xl bg-white/70 border p-3 text-xs whitespace-pre-line line-clamp-6">
                {form.full_description}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </div>
      {children}
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </label>
  );
}

function ContactField({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 rounded-xl border bg-background px-3 focus-within:ring-2 focus-within:ring-brand/30">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent py-2.5 text-sm outline-none"
        />
      </div>
    </label>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/70 border py-2">
      <div className="text-sm font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function PreviewLine({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-brand shrink-0" />
      <span className="truncate text-foreground">{value}</span>
    </div>
  );
}
