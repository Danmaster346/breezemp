// Границы ошибок рендеринга: дружелюбный экран вместо белого,
// с перезагрузкой страницы и переходом на главную. Ошибка логируется.
import { Component, type ReactNode } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { captureClientError } from "@/lib/error-capture";

export function ErrorScreen({ error }: { error?: unknown }) {
  const message = error instanceof Error ? error.message : undefined;
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">
        Что-то пошло не так
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Мы уже знаем о проблеме. Попробуйте перезагрузить страницу — обычно это помогает.
      </p>
      {message && (
        <p className="mt-3 max-w-full truncate rounded-lg bg-surface px-3 py-2 text-xs text-muted-foreground">
          {message}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground transition hover:opacity-90"
        >
          <RotateCcw className="h-4 w-4" /> Перезагрузить страницу
        </button>
        <a
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition hover:bg-accent"
        >
          <Home className="h-4 w-4" /> На главную
        </a>
      </div>
    </div>
  );
}

type Props = { children: ReactNode };
type State = { error: unknown | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    captureClientError(error, info.componentStack ?? undefined);
  }

  render() {
    if (this.state.error) return <ErrorScreen error={this.state.error} />;
    return this.props.children;
  }
}
