// Контакты + форма обратной связи.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { AppLayout } from "@/components/AppLayout";
import { submitContactMessage } from "@/lib/contacts.functions";
import { Clock, LifeBuoy, Mail, Send } from "lucide-react";

const formSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя (минимум 2 символа)").max(100, "Слишком длинное имя"),
  email: z.string().trim().email("Некорректный email").max(255, "Слишком длинный email"),
  message: z
    .string()
    .trim()
    .min(10, "Опишите вопрос подробнее (минимум 10 символов)")
    .max(2000, "Максимум 2000 символов"),
});

export const Route = createFileRoute("/contacts")({
  head: () => ({
    meta: [
      { title: "Контакты и обратная связь — Kupiks" },
      {
        name: "description",
        content:
          "Свяжитесь с поддержкой Kupiks: напишите нам через форму обратной связи — ответим по email в течение рабочего дня.",
      },
      { property: "og:title", content: "Контакты и обратная связь — Kupiks" },
      {
        property: "og:description",
        content: "Форма обратной связи и контакты службы поддержки маркетплейса Kupiks.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://breezemp.lovable.app/contacts" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://breezemp.lovable.app/contacts" }],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  const send = useServerFn(submitContactMessage);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSending(true);
    try {
      const res = await send({ data: parsed.data });
      if (!res.ok) {
        toast.error(res.error ?? "Не удалось отправить сообщение");
        return;
      }
      setSent(true);
      setForm({ name: "", email: "", message: "" });
      toast.success("Сообщение отправлено — мы ответим на указанный email");
    } catch {
      toast.error("Не удалось отправить сообщение. Попробуйте позже");
    } finally {
      setSending(false);
    }
  };

  const field =
    "w-full h-12 px-3 rounded-xl border border-border bg-surface text-base outline-none focus:border-brand ui-transition";

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-2">Контакты</h1>
        <p className="text-sm md:text-base text-muted-foreground mb-8">
          Напишите нам — поможем с заказом, доставкой, возвратом или работой аккаунта продавца.
        </p>

        <div className="grid md:grid-cols-[1fr_320px] gap-6 md:gap-8">
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-border bg-card p-4 md:p-6 space-y-4"
          >
            <div>
              <label htmlFor="c-name" className="block text-sm font-semibold mb-1.5">
                Имя
              </label>
              <input
                id="c-name"
                value={form.name}
                maxLength={100}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Как к вам обращаться"
                className={field}
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="c-email" className="block text-sm font-semibold mb-1.5">
                Email
              </label>
              <input
                id="c-email"
                type="email"
                value={form.email}
                maxLength={255}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                className={field}
              />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="c-message" className="block text-sm font-semibold mb-1.5">
                Сообщение
              </label>
              <textarea
                id="c-message"
                value={form.message}
                maxLength={2000}
                rows={6}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Опишите вопрос: номер заказа, что случилось, чем помочь"
                className="w-full px-3 py-3 rounded-xl border border-border bg-surface text-base outline-none focus:border-brand ui-transition resize-y"
              />
              <div className="flex items-center justify-between mt-1">
                {errors.message ? (
                  <p className="text-xs text-destructive">{errors.message}</p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-muted-foreground">{form.message.length}/2000</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-brand text-brand-foreground font-semibold hover:opacity-90 disabled:opacity-60 ui-transition"
            >
              <Send className="h-4 w-4" />
              {sending ? "Отправляем…" : "Отправить"}
            </button>

            {sent && (
              <p className="text-sm text-brand font-medium">
                Спасибо! Обращение принято — ответим на указанный email.
              </p>
            )}
          </form>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <Mail className="h-5 w-5 text-brand mb-2" />
              <div className="font-semibold">Поддержка по email</div>
              <div className="text-sm text-muted-foreground">
                Все обращения из формы попадают напрямую в службу поддержки.
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <Clock className="h-5 w-5 text-brand mb-2" />
              <div className="font-semibold">Время ответа</div>
              <div className="text-sm text-muted-foreground">
                Обычно отвечаем в течение одного рабочего дня.
              </div>
            </div>
            <Link
              to="/help"
              className="block rounded-2xl border border-border bg-card p-4 hover:border-brand/50 ui-transition"
            >
              <LifeBuoy className="h-5 w-5 text-brand mb-2" />
              <div className="font-semibold">Частые вопросы</div>
              <div className="text-sm text-muted-foreground">
                Возможно, ответ уже есть в разделе помощи.
              </div>
            </Link>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
