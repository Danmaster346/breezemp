// Кнопка «Назад» — использует историю роутера с fallback.
import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export function BackButton({
  fallback = "/",
  label = "Назад",
  className = "",
}: {
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const onBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      router.navigate({ to: fallback });
    }
  };
  return (
    <button
      type="button"
      onClick={onBack}
      className={`inline-flex items-center gap-1.5 h-9 pl-2 pr-3 rounded-full text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-surface ui-transition ${className}`}
    >
      <ChevronLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
