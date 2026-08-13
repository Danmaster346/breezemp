// Управление баннерами главной страницы
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listBanners,
  upsertBanner,
  deleteBanner,
  reorderBanners,
  type BannerRow,
} from "@/lib/admin/banners.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, ImageOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/banners")({
  component: BannersPage,
});

const COLOR_PRESETS = [
  "#ff6b35",
  "#2563eb",
  "#16a34a",
  "#9333ea",
  "#dc2626",
  "#0f172a",
];

type EditState = Partial<BannerRow> & { title: string };

function BannersPage() {
  const list = useServerFn(listBanners);
  const upsert = useServerFn(upsertBanner);
  const del = useServerFn(deleteBanner);
  const reorder = useServerFn(reorderBanners);
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: () => list(),
  });
  const items = (data ?? []) as BannerRow[];

  const [edit, setEdit] = useState<EditState | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-banners"] });

  const upM = useMutation({
    mutationFn: upsert,
    onSuccess: () => {
      toast.success("Сохранено");
      invalidate();
      setEdit(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: del,
    onSuccess: () => {
      toast.success("Удалено");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reorderM = useMutation({
    mutationFn: reorder,
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const move = (index: number, dir: -1 | 1) => {
    const targetIndex = index + dir;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const orderedIds = items.map((b) => b.id);
    [orderedIds[index], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[index]];
    reorderM.mutate({ data: { orderedIds } });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Баннеры главной страницы</h1>
          <p className="text-foreground/60 text-sm mt-1">Всего: {items.length}</p>
        </div>
        <Button
          onClick={() =>
            setEdit({
              title: "",
              subtitle: "",
              promo_code: "",
              link: "",
              bg_color: COLOR_PRESETS[0],
              is_active: true,
              sort_order: items.length,
            })
          }
        >
          <Plus className="h-4 w-4 mr-1" /> Добавить баннер
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl bg-white border border-border/60 p-8 text-center text-foreground/60">
          Не удалось загрузить баннеры
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-white border border-border/60 p-10 text-center text-foreground/60 flex flex-col items-center gap-2">
          <ImageOff className="h-8 w-8 text-foreground/30" />
          Баннеров пока нет
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((b, i) => (
            <div
              key={b.id}
              className="rounded-2xl bg-white border border-border/60 p-3 md:p-4 flex flex-col md:flex-row gap-4"
            >
              <div
                className="relative overflow-hidden rounded-xl min-h-[120px] w-full md:w-64 shrink-0 p-4 flex flex-col justify-center text-white"
                style={{ backgroundColor: b.bg_color }}
              >
                <div className="font-bold text-lg leading-tight">{b.title}</div>
                {b.subtitle && <div className="text-sm text-white/80 mt-1">{b.subtitle}</div>}
                {b.promo_code && (
                  <Badge className="mt-2 w-fit bg-white/20 text-white border-white/30 hover:bg-white/20">
                    {b.promo_code}
                  </Badge>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={b.is_active ? "default" : "secondary"} className="text-[10px]">
                    {b.is_active ? "активен" : "скрыт"}
                  </Badge>
                  <span className="text-xs text-foreground/50">Порядок: {b.sort_order}</span>
                </div>
                {b.link && (
                  <div className="text-xs text-foreground/60 truncate">Ссылка: {b.link}</div>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 mr-auto">
                    <Switch
                      checked={b.is_active}
                      onCheckedChange={(v) =>
                        upM.mutate({
                          data: {
                            id: b.id,
                            title: b.title,
                            subtitle: b.subtitle,
                            promo_code: b.promo_code,
                            link: b.link,
                            bg_color: b.bg_color,
                            is_active: v,
                            sort_order: b.sort_order,
                          },
                        })
                      }
                    />
                    <span className="text-sm">Активен</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEdit(b)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm(`Удалить баннер «${b.title}»?`)) delM.mutate({ data: { id: b.id } });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Редактировать баннер" : "Новый баннер"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Заголовок*"
              value={edit?.title ?? ""}
              onChange={(e) => setEdit((s) => (s ? { ...s, title: e.target.value } : s))}
            />
            <Textarea
              placeholder="Подзаголовок"
              value={edit?.subtitle ?? ""}
              onChange={(e) => setEdit((s) => (s ? { ...s, subtitle: e.target.value } : s))}
            />
            <Input
              placeholder="Промокод"
              value={edit?.promo_code ?? ""}
              onChange={(e) => setEdit((s) => (s ? { ...s, promo_code: e.target.value } : s))}
            />
            <Input
              placeholder="Ссылка, напр. /catalog?category=matrasy"
              value={edit?.link ?? ""}
              onChange={(e) => setEdit((s) => (s ? { ...s, link: e.target.value } : s))}
            />
            <div>
              <label className="text-sm font-medium text-foreground/70 mb-1.5 block">
                Цвет фона
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="color"
                  value={edit?.bg_color ?? COLOR_PRESETS[0]}
                  onChange={(e) => setEdit((s) => (s ? { ...s, bg_color: e.target.value } : s))}
                  className="h-10 w-14 rounded-md border border-border cursor-pointer p-1 bg-white"
                />
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEdit((s) => (s ? { ...s, bg_color: c } : s))}
                    className="h-8 w-8 rounded-full border-2 transition"
                    style={{
                      backgroundColor: c,
                      borderColor: edit?.bg_color === c ? "#0f172a" : "transparent",
                    }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={edit?.is_active ?? true}
                onCheckedChange={(v) => setEdit((s) => (s ? { ...s, is_active: v } : s))}
              />
              <span className="text-sm">Активен</span>
            </div>
            {edit && (
              <div
                className="rounded-xl p-4 text-white min-h-[100px] flex flex-col justify-center"
                style={{ backgroundColor: edit.bg_color ?? COLOR_PRESETS[0] }}
              >
                <div className="font-bold">{edit.title || "Заголовок"}</div>
                {edit.subtitle && <div className="text-sm text-white/80 mt-1">{edit.subtitle}</div>}
                {edit.promo_code && (
                  <Badge className="mt-2 w-fit bg-white/20 text-white border-white/30 hover:bg-white/20">
                    {edit.promo_code}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Отмена
            </Button>
            <Button
              disabled={!edit?.title?.trim()}
              onClick={() =>
                edit &&
                upM.mutate({
                  data: {
                    id: edit.id,
                    title: edit.title,
                    subtitle: edit.subtitle ?? null,
                    promo_code: edit.promo_code ?? null,
                    link: edit.link ?? null,
                    bg_color: edit.bg_color ?? COLOR_PRESETS[0],
                    is_active: edit.is_active ?? true,
                    sort_order: edit.sort_order ?? 0,
                  },
                })
              }
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
