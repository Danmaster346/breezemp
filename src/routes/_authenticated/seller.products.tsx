// Список и создание/редактирование товаров продавцом
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { formatPrice, rublesToKopecks } from "@/lib/format";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

// Маршрут «/seller/products»
export const Route = createFileRoute("/_authenticated/seller/products")({
  head: () => ({ meta: [{ title: "Мои товары — BreezeMarket" }] }),
  component: SellerProductsPage,
});

// Тип для формы товара
type ProductForm = {
  id?: string;
  title: string;
  description: string;
  price: string; // рубли строкой в форме
  stock: string; // количество строкой
  image_url: string;
  category_id: string;
};

// Пустая форма-«новый товар»
const emptyForm: ProductForm = {
  title: "",
  description: "",
  price: "",
  stock: "1",
  image_url: "",
  category_id: "",
};

// Основной компонент страницы
function SellerProductsPage() {
  const { user, isSeller } = useAuth();
  const qc = useQueryClient();
  // Состояние модального окна редактирования
  const [editing, setEditing] = useState<ProductForm | null>(null);

  // Загружаем товары продавца
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

  // Загружаем категории для селекта
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });

  // Сохранение (создание или обновление) товара
  const save = async (f: ProductForm) => {
    if (!user) return;
    // Формируем payload с приведением типов
    const payload = {
      title: f.title,
      description: f.description || null,
      price_kopecks: rublesToKopecks(f.price),
      stock: parseInt(f.stock) || 0,
      image_url: f.image_url || null,
      category_id: f.category_id || null,
      seller_id: user.id,
      is_active: true,
    };
    try {
      if (f.id) {
        // Обновление существующего товара
        const { error } = await supabase.from("products").update(payload).eq("id", f.id);
        if (error) throw error;
        toast.success("Товар обновлён");
      } else {
        // Создание нового
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast.success("Товар добавлен");
      }
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["seller-products"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Удаление товара
  const remove = async (id: string) => {
    if (!confirm("Удалить товар?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Удалено");
    qc.invalidateQueries({ queryKey: ["seller-products"] });
  };

  // Если пользователь не продавец — просим стать
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
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setEditing(emptyForm)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Добавить товар
        </button>
      </div>

      {/* Список товаров */}
      {productsQuery.isLoading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : !productsQuery.data || productsQuery.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          У вас пока нет товаров.
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
                      image_url: p.image_url ?? "",
                      category_id: p.category_id ?? "",
                    })
                  }
                  className="p-2 rounded-lg hover:bg-accent"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(p.id)}
                  className="p-2 rounded-lg text-destructive hover:bg-destructive/10"
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
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card">
              <h3 className="font-semibold">
                {editing.id ? "Редактировать товар" : "Новый товар"}
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
              className="p-4 space-y-3"
            >
              <div>
                <label className="text-sm text-muted-foreground">Название</label>
                <input
                  required
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="mt-1 w-full h-11 px-3 rounded-lg border bg-background"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Описание</label>
                <textarea
                  rows={3}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg border bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground">Цена, ₽</label>
                  <input
                    required
                    type="number"
                    min="0"
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
              <div>
                <label className="text-sm text-muted-foreground">Ссылка на фото</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={editing.image_url}
                  onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  className="mt-1 w-full h-11 px-3 rounded-lg border bg-background"
                />
                {editing.image_url && (
                  <img
                    src={editing.image_url}
                    alt=""
                    className="mt-2 h-32 w-32 rounded-lg object-cover border"
                  />
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="flex-1 rounded-xl border py-3 font-medium hover:bg-accent"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90"
                >
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
