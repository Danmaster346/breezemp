// Согласие OAuth: страница, куда Supabase направляет пользователя,
// чтобы разрешить или запретить внешнему клиенту (ChatGPT, Claude и т.п.)
// действовать от его имени в Kupiks.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Loader2, ShieldCheck, X } from "lucide-react";

// Локальный типизированный обёрточник над beta-namespace supabase.auth.oauth.
type OAuthDetails = {
  client?: { name?: string; client_name?: string; redirect_uris?: string[] } | null;
  scopes?: string[] | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};
type OAuthResult = { data: OAuthDetails | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Отсутствует authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { redirect: next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <AppLayout>
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <h1 className="text-xl font-semibold mb-2">Не удалось загрузить запрос</h1>
        <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </div>
    </AppLayout>
  ),
});

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName =
    details?.client?.name ?? details?.client?.client_name ?? "внешнее приложение";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Сервер авторизации не вернул адрес возврата.");
      return;
    }
    window.location.href = target;
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-md px-4 py-8 md:py-12">
        <div className="rounded-3xl border-2 border-border bg-card p-6 md:p-8 shadow-sm">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft text-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wide mb-4">
            <ShieldCheck className="h-3.5 w-3.5" /> Разрешение доступа
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-2">
            Подключить {clientName} к Kupiks?
          </h1>
          <p className="text-sm text-muted-foreground mb-5">
            Приложение сможет вызывать инструменты Kupiks от вашего имени, пока вы вошли в аккаунт.
            Это не отменяет права доступа и правила безопасности сервиса.
          </p>

          {details?.scopes && details.scopes.length > 0 && (
            <div className="mb-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Запрашиваемые разрешения
              </div>
              <ul className="space-y-1.5">
                {details.scopes.map((s) => (
                  <li key={s} className="text-sm flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-brand" /> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => decide(false)}
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-border font-semibold hover:bg-surface transition disabled:opacity-50"
            >
              <X className="h-4 w-4" /> Отклонить
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-brand text-brand-foreground font-semibold hover:bg-brand-strong transition disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Разрешить
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
