// Список и создание/редактирование товаров продавцом
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { formatPrice, rublesToKopecks } from "@/lib/format";
import { Plus, Pencil, Trash2, X, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Маршрут «/seller/products» с поддержкой ?new=1 (сразу открыть форму)
export const Route = createFileRoute("/_authenticated/seller/products")({
  head: () => ({ meta: [{ title: "Мои товары — BreezeMarket" }] }),
  // Разбираем query — принимаем ?new=1 как флаг открытия модалки
  validateSearch: (s: Record<string, unknown>) => ({
    new: s.new === 1 || s.new === "1" ? 1 : undefined,
  }),
  component: SellerProductsPage,
});


// Тип для формы товара
type ProductForm = {
  id?: string;
  title: string;
  description: string;
  price: string; // рубли строкой
  stock: string;
  image_urls: string[]; // до 5 фото
  category_id: string;
};

// Пустая форма
const emptyForm: ProductForm = {
  title: "",
  description: "",
  price: "",
  stock: "1",
  image_urls: [],
  category_id: "",
};

// Максимум фото на карточку
const MAX_IMAGES = 5;
// Срок действия signed URL — 1 год
const SIGNED_URL_TTL = 60 * 60 * 24 * 365;

function SellerProductsPage() {
  const { user, isSeller } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [editing, setEditing] = useState<ProductForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // При наличии ?new=1 открываем форму и убираем параметр из URL
  useEffect(() => {
    if (search.new === 1 && !editing) {
      setEditing({ ...emptyForm });
      navigate({ to: "/seller/products", search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.new]);


  // Товары продавца
  const productsQuery = useQuery({
    queryKey: ["seller-products", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Категории
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });

  // Загрузка выбранных файлов в Supabase Storage
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || !user || !editing) return;
    const remaining = MAX_IMAGES - editing.image_urls.length;
    if (remaining <= 0) {
      toast.error(`Можно загрузить максимум ${MAX_IMAGES} фото`);
      return;
    }
    const list = Array.from(files).slice(0, remaining);
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of list) {
        if (!file.type.startsWith("image/")) {
          toast.error(`«${file.name}» — не изображение`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`«${file.name}» больше 5 МБ`);
          continue;
        }
        // Кладём в папку {user.id}/... — это требование политики Storage
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("product-images").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
        if (up.error) {
          toast.error(up.error.message);
          continue;
        }
        // Приватный бакет — создаём длинную ссылку с подписью
        const signed = await supabase.storage
          .from("product-images")
          .createSignedUrl(path, SIGNED_URL_TTL);
        if (signed.error || !signed.data) {
          toast.error(signed.error?.message || "Не удалось получить ссылку");
          continue;
        }
        uploaded.push(signed.data.signedUrl);
      }
      if (uploaded.length) {
        setEditing((prev) =>
          prev ? { ...prev, image_urls: [...prev.image_urls, ...uploaded] } : prev,
        );
        toast.success(`Загружено фото: ${uploaded.length}`);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Удаление фото из формы (файл в Storage остаётся — не критично для демо)
  const removeImage = (url: string) => {
    setEditing((prev) =>
      prev ? { ...prev, image_urls: prev.image_urls.filter((u) => u !== url) } : prev,
    );
  };

  // Сохранение товара — валидация + insert/update
  const save = async (f: ProductForm) => {
    if (!user) return;
    // Валидация
    const title = f.title.trim();
    if (!title) return toast.error("Введите название товара");
    const priceKop = rublesToKopecks(f.price);
    if (!priceKop || priceKop <= 0) return toast.error("Цена должна быть больше 0");
    const stock = parseInt(f.stock);
    if (isNaN(stock) || stock < 0) return toast.error("Некорректное количество");

    const payload = {
      title,
      description: f.description.trim() || null,
      price_kopecks: priceKop,
      stock,
      image_url: f.image_urls[0] ?? null, // первое фото — обложка
      image_urls: f.image_urls,
      category_id: f.category_id || null,
      seller_id: user.id,
      is_active: true,
    };
    setSaving(true);
    try {
      if (f.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", f.id);
        if (error) throw error;
        toast.success("Товар обновлён");
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast.success("Товар добавлен");
      }
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["seller-products"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить товар?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Удалено");
    qc.invalidateQueries({ queryKey: ["seller-products"] });
  };

  // Пользователь не продавец — предлагаем стать
  if (user && !isSeller) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <p className="text-muted-foreground mb-3">Вы зарегистрированы как покупатель.</p>
        <button
          onClick={async () => {
            const { becomeSeller } = await import("@/lib/roles.functions");
            await becomeSeller();
            toast.success("Теперь вы продавец!");
            window.location.reload();
          }}
          className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90"
        >
          Стать продавцом
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Кнопка «Добавить товар» */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="text-sm text-muted-foreground">
          Всего товаров: {productsQuery.data?.length ?? 0}
        </div>
        <button
          onClick={() => setEditing({ ...emptyForm })}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Добавить товар
        </button>
      </div>

      {/* Список */}
      {productsQuery.isLoading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : !productsQuery.data || productsQuery.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-muted-foreground mb-4">У вас пока нет товаров.</p>
          <button
            onClick={() => setEditing({ ...emptyForm })}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Создать первую карточку
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {productsQuery.data.map((p) => (
            <div key={p.id} className="flex gap-3 rounded-2xl border bg-card p-3">
              <div className="h-20 w-20 rounded-lg bg-muted overflow-hidden shrink-0">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-2xl">🛍️</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold line-clamp-1">{p.title}</div>
                <div className="text-lg font-bold text-primary">
                  {formatPrice(p.price_kopecks)}
                </div>
                <div className="text-xs text-muted-foreground">Остаток: {p.stock} шт.</div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() =>
                    setEditing({
                      id: p.id,
                      title: p.title,
                      description: p.description ?? "",
                      price: (p.price_kopecks / 100).toString(),
                      stock: p.stock.toString(),
                      image_urls:
                        (p as { image_urls?: string[] }).image_urls?.length
                          ? (p as { image_urls: string[] }).image_urls
                          : p.image_url
                            ? [p.image_url]
                            : [],
                      category_id: p.category_id ?? "",
                    })
                  }
                  className="p-2 rounded-lg hover:bg-accent"
                  aria-label="Редактировать"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(p.id)}
                  className="p-2 rounded-lg text-destructive hover:bg-destructive/10"
                  aria-label="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно формы */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border shadow-lg max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card z-10">
              <h3 className="font-semibold">
                {editing.id ? "Редактировать товар" : "Новая карточка"}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="p-1 rounded hover:bg-accent"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save(editing);
              }}
              className="p-4 space-y-4"
            >
              {/* Фото */}
              <div>
                <label className="text-sm text-muted-foreground">
                  Фото товара ({editing.image_urls.length}/{MAX_IMAGES})
                </label>
                <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {editing.image_urls.map((url) => (
                    <div key={url} className="relative aspect-square rounded-lg overflow-hidden border">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
                        aria-label="Удалить фото"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {editing.image_urls.length < MAX_IMAGES && (
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-60"
                    >
                      {uploading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-5 w-5" />
                          Добавить
                        </>
                      )}
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  До {MAX_IMAGES} изображений, каждое до 5 МБ
                </p>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">
                  Название <span className="text-destructive">*</span>
                </label>
                <input
                  required
                  maxLength={200}
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="mt-1 w-full h-11 px-3 rounded-lg border bg-background"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Описание</label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg border bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground">
                    Цена, ₽ <span className="text-destructive">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={editing.price}
                    onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                    className="mt-1 w-full h-11 px-3 rounded-lg border bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Остаток, шт.</label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={editing.stock}
                    onChange={(e) => setEditing({ ...editing, stock: e.target.value })}
                    className="mt-1 w-full h-11 px-3 rounded-lg border bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Категория</label>
                <select
                  value={editing.category_id}
                  onChange={(e) => setEditing({ ...editing, category_id: e.target.value })}
                  className="mt-1 w-full h-11 px-3 rounded-lg border bg-background"
                >
                  <option value="">— Без категории —</option>
                  {categoriesQuery.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2 sticky bottom-0 bg-card">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={saving}
                  className="flex-1 rounded-xl border py-3 font-medium hover:bg-accent disabled:opacity-60"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
