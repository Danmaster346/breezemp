// Список и создание/редактирование товаров продавцом
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { formatPrice, rublesToKopecks } from "@/lib/format";
import { Plus, Pencil, Trash2, X, Upload, Loader2, Search, AlertTriangle, Minus, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ArrowUpDown, FileUp } from "lucide-react";
import { BulkBar, ImportCsvDialog } from "@/components/seller/BulkBar";
import {
  duplicateProduct,
  getSellerProductStats,
} from "@/lib/seller/products-bulk.functions";


// Порог низкого остатка — ниже этого числа товар помечается
const LOW_STOCK_THRESHOLD = 10;


// Маршрут «/seller/products» с поддержкой ?new=1 (сразу открыть форму)
export const Route = createFileRoute("/_authenticated/seller/products")({
  head: () => ({ meta: [{ title: "Мои товары — BreezeMarket" }] }),
  // Разбираем query — принимаем ?new=1 как флаг открытия модалки
  validateSearch: (s: Record<string, unknown>): { new?: 1 } =>
    s.new === 1 || s.new === "1" ? { new: 1 } : {},
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
  const [dragOver, setDragOver] = useState(false);
  const [stockBusy, setStockBusy] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [filterCat, setFilterCat] = useState<string>("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [sortBy, setSortBy] = useState<"new" | "sold" | "views" | "price" | "stock">("new");
  const [selected, setSelected] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchStats = useServerFn(getSellerProductStats);
  const duplicate = useServerFn(duplicateProduct);
  const [dupBusy, setDupBusy] = useState<string | null>(null);

  // Просмотры / в корзину / продано по каждому товару
  const statsQuery = useQuery({
    queryKey: ["seller-product-stats", user?.id],
    enabled: !!user,
    queryFn: () => fetchStats(),
  });
  const stats = statsQuery.data ?? { views: {}, carts: {}, sold: {} };

  const toggleSelected = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["seller-products", user?.id] });
    void qc.invalidateQueries({ queryKey: ["seller-product-stats", user?.id] });
    setSelected([]);
  };

  const onDuplicate = async (id: string) => {
    setDupBusy(id);
    try {
      await duplicate({ data: { id } });
      toast.success("Копия создана — она скрыта, задайте остаток и включите продажи");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать копию");
    } finally {
      setDupBusy(null);
    }
  };



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
      qc.invalidateQueries({ queryKey: ["seller-products"] }); qc.invalidateQueries({ queryKey: ["seller-stats"] });
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
    qc.invalidateQueries({ queryKey: ["seller-products"] }); qc.invalidateQueries({ queryKey: ["seller-stats"] });
  };

  // Быстрое изменение остатка (без открытия формы)
  const bumpStock = async (id: string, current: number, delta: number) => {
    const next = Math.max(0, current + delta);
    if (next === current) return;
    setStockBusy(id);
    const { error } = await supabase.from("products").update({ stock: next }).eq("id", id);
    setStockBusy(null);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["seller-products"] });
    qc.invalidateQueries({ queryKey: ["seller-stats"] });
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

  const all = productsQuery.data ?? [];
  const lowCount = all.filter((p) => p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD).length;
  const outCount = all.filter((p) => p.stock === 0).length;

  // Клиентская фильтрация: поиск + категория + низкий остаток
  const filtered = all
    .filter((p) => {
      if (searchQ && !p.title.toLowerCase().includes(searchQ.toLowerCase())) return false;
      if (filterCat && p.category_id !== filterCat) return false;
      if (onlyLow && p.stock >= LOW_STOCK_THRESHOLD) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "sold") return (stats.sold[b.id] ?? 0) - (stats.sold[a.id] ?? 0);
      if (sortBy === "views") return (stats.views[b.id] ?? 0) - (stats.views[a.id] ?? 0);
      if (sortBy === "price") return b.price_kopecks - a.price_kopecks;
      if (sortBy === "stock") return a.stock - b.stock;
      return 0;
    });

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.includes(p.id));


  return (
    <div>
      {/* Панель управления */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Поиск по названию…"
            className="w-full h-10 pl-9 pr-3 rounded-xl border bg-background text-sm"
          />
        </div>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="h-10 px-3 rounded-xl border bg-background text-sm"
        >
          <option value="">Все категории</option>
          {categoriesQuery.data?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOnlyLow((v) => !v)}
          className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border text-sm font-medium transition ${
            onlyLow ? "bg-amber-100 border-amber-300 text-amber-800" : "hover:bg-accent"
          }`}
        >
          <AlertTriangle className="h-4 w-4" /> Мало на складе
          {lowCount > 0 && (
            <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5">
              {lowCount}
            </span>
          )}
        </button>
        <div className="relative inline-flex items-center">
          <ArrowUpDown className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-10 rounded-xl border bg-background pl-9 pr-3 text-sm"
            aria-label="Сортировка"
          >
            <option value="new">Сначала новые</option>
            <option value="sold">По продажам</option>
            <option value="views">По просмотрам</option>
            <option value="price">По цене</option>
            <option value="stock">По остатку</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border text-sm font-medium hover:bg-accent"
        >
          <FileUp className="h-4 w-4" /> Импорт CSV
        </button>
        <button
          onClick={() => setEditing({ ...emptyForm })}
          className="inline-flex items-center gap-2 h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Добавить товар
        </button>
      </div>


      {/* Итоги */}
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-surface px-3 py-1">Всего: <b className="text-foreground">{all.length}</b></span>
        {lowCount > 0 && (
          <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1">Мало: <b>{lowCount}</b></span>
        )}
        {outCount > 0 && (
          <span className="rounded-full bg-rose-100 text-rose-800 px-3 py-1">Закончились: <b>{outCount}</b></span>
        )}
        {(searchQ || filterCat || onlyLow) && (
          <button
            onClick={() => { setSearchQ(""); setFilterCat(""); setOnlyLow(false); }}
            className="rounded-full border px-3 py-1 hover:bg-accent"
          >
            Сбросить фильтры
          </button>
        )}
      </div>

      {/* Список */}
      {productsQuery.isLoading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : all.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-muted-foreground mb-4">У вас пока нет товаров.</p>
          <button
            onClick={() => setEditing({ ...emptyForm })}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Создать первую карточку
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          Ничего не найдено под текущие фильтры.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => {
            const low = p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD;
            const out = p.stock === 0;
            return (
              <div
                key={p.id}
                className={`flex gap-3 rounded-2xl border bg-card p-3 transition ${
                  out ? "border-rose-200 bg-rose-50/40" : low ? "border-amber-200 bg-amber-50/40" : ""
                }`}
              >
                <div className="h-20 w-20 rounded-lg bg-muted overflow-hidden shrink-0">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-2xl">🛍️</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold line-clamp-1">{p.title}</div>
                    {out && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5">
                        Нет в наличии
                      </span>
                    )}
                    {low && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5">
                        <AlertTriangle className="h-3 w-3" /> Мало
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-bold text-primary">{formatPrice(p.price_kopecks)}</div>
                  {/* Быстрое изменение остатка */}
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Остаток:</span>
                    <button
                      type="button"
                      disabled={stockBusy === p.id || p.stock === 0}
                      onClick={() => bumpStock(p.id, p.stock, -1)}
                      className="h-6 w-6 grid place-items-center rounded-md border hover:bg-accent disabled:opacity-40"
                      aria-label="Убрать 1"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums">
                      {p.stock}
                    </span>
                    <button
                      type="button"
                      disabled={stockBusy === p.id}
                      onClick={() => bumpStock(p.id, p.stock, +1)}
                      className="h-6 w-6 grid place-items-center rounded-md border hover:bg-accent disabled:opacity-40"
                      aria-label="Добавить 1"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    {stockBusy === p.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Link
                    to="/product/$id"
                    params={{ id: p.id }}
                    className="p-2 rounded-lg hover:bg-accent"
                    aria-label="Открыть в каталоге"
                    title="Открыть в каталоге"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
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
            );
          })}
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
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (editing.image_urls.length < MAX_IMAGES && !uploading) setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleFilesSelected(e.dataTransfer.files);
                  }}
                  className={`mt-2 rounded-xl transition ${
                    dragOver ? "ring-2 ring-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 p-1">
                    {editing.image_urls.map((url, i) => (
                      <div
                        key={url}
                        className="relative aspect-square rounded-lg overflow-hidden border group"
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        {i === 0 && (
                          <div className="absolute bottom-1 left-1 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            Обложка
                          </div>
                        )}
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
                  Перетащите фото сюда или нажмите «Добавить». До {MAX_IMAGES} изображений, каждое до 5 МБ. Первое фото — обложка.
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
