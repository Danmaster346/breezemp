// Настройки платформы
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getPlatformSettings, updatePlatformSetting } from "@/lib/admin/settings.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function Field({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SettingsPage() {
  const getFn = useServerFn(getPlatformSettings);
  const updateFn = useServerFn(updatePlatformSetting);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => getFn(),
  });

  const [commission, setCommission] = useState({ commission_pct: "", min_order_rub: "", return_days: "" });
  const [maintenance, setMaintenance] = useState({ maintenance_mode: "0", maintenance_message: "" });
  const [limits, setLimits] = useState({ max_products_per_seller: "", max_photos: "", max_file_mb: "" });
  const [contacts, setContacts] = useState({ support_email: "", support_phone: "", support_tg: "" });

  useEffect(() => {
    if (!data) return;
    setCommission({
      commission_pct: data.commission_pct ?? "",
      min_order_rub: data.min_order_rub ?? "",
      return_days: data.return_days ?? "",
    });
    setMaintenance({
      maintenance_mode: data.maintenance_mode ?? "0",
      maintenance_message: data.maintenance_message ?? "",
    });
    setLimits({
      max_products_per_seller: data.max_products_per_seller ?? "",
      max_photos: data.max_photos ?? "",
      max_file_mb: data.max_file_mb ?? "",
    });
    setContacts({
      support_email: data.support_email ?? "",
      support_phone: data.support_phone ?? "",
      support_tg: data.support_tg ?? "",
    });
  }, [data]);

  const saveGroup = useMutation({
    mutationFn: async (entries: Record<string, string>) => {
      for (const [key, value] of Object.entries(entries)) {
        await updateFn({ data: { key, value } });
      }
    },
    onSuccess: () => {
      toast.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: Error) => toast.error(e.message || "Ошибка сохранения"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold">Настройки платформы</h1>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl bg-white border border-border/60 p-4 h-48 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl md:text-3xl font-bold">Настройки платформы</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white border border-border/60 p-4 space-y-3">
          <h2 className="font-semibold text-lg">Комиссия платформы</h2>
          <Field id="commission_pct" label="Комиссия %" value={commission.commission_pct} onChange={(v) => setCommission((s) => ({ ...s, commission_pct: v }))} />
          <Field id="min_order_rub" label="Минимальная сумма заказа ₽" value={commission.min_order_rub} onChange={(v) => setCommission((s) => ({ ...s, min_order_rub: v }))} />
          <Field id="return_days" label="Максимальный возврат, дней" value={commission.return_days} onChange={(v) => setCommission((s) => ({ ...s, return_days: v }))} />
          <Button disabled={saveGroup.isPending} onClick={() => saveGroup.mutate(commission)}>Сохранить</Button>
        </div>

        <div className="rounded-2xl bg-white border border-border/60 p-4 space-y-3">
          <h2 className="font-semibold text-lg">Режим обслуживания</h2>
          <div className="flex items-center gap-3">
            <Switch
              id="maintenance_mode"
              checked={maintenance.maintenance_mode === "1"}
              onCheckedChange={(checked) => setMaintenance((s) => ({ ...s, maintenance_mode: checked ? "1" : "0" }))}
            />
            <Label htmlFor="maintenance_mode">Включить режим обслуживания</Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maintenance_message">Сообщение для пользователей</Label>
            <Textarea
              id="maintenance_message"
              value={maintenance.maintenance_message}
              onChange={(e) => setMaintenance((s) => ({ ...s, maintenance_message: e.target.value }))}
              rows={4}
            />
          </div>
          <Button disabled={saveGroup.isPending} onClick={() => saveGroup.mutate(maintenance)}>Сохранить</Button>
        </div>

        <div className="rounded-2xl bg-white border border-border/60 p-4 space-y-3">
          <h2 className="font-semibold text-lg">Лимиты</h2>
          <Field id="max_products_per_seller" label="Макс. товаров на продавца" value={limits.max_products_per_seller} onChange={(v) => setLimits((s) => ({ ...s, max_products_per_seller: v }))} />
          <Field id="max_photos" label="Макс. фото на товар" value={limits.max_photos} onChange={(v) => setLimits((s) => ({ ...s, max_photos: v }))} />
          <Field id="max_file_mb" label="Макс. размер файла, МБ" value={limits.max_file_mb} onChange={(v) => setLimits((s) => ({ ...s, max_file_mb: v }))} />
          <Button disabled={saveGroup.isPending} onClick={() => saveGroup.mutate(limits)}>Сохранить</Button>
        </div>

        <div className="rounded-2xl bg-white border border-border/60 p-4 space-y-3">
          <h2 className="font-semibold text-lg">Контакты платформы</h2>
          <Field id="support_email" label="Email поддержки" value={contacts.support_email} onChange={(v) => setContacts((s) => ({ ...s, support_email: v }))} />
          <Field id="support_phone" label="Телефон поддержки" value={contacts.support_phone} onChange={(v) => setContacts((s) => ({ ...s, support_phone: v }))} />
          <Field id="support_tg" label="Telegram поддержки" value={contacts.support_tg} onChange={(v) => setContacts((s) => ({ ...s, support_tg: v }))} />
          <Button disabled={saveGroup.isPending} onClick={() => saveGroup.mutate(contacts)}>Сохранить</Button>
        </div>
      </div>
    </div>
  );
}
