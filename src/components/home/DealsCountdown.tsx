// Таймер обратного отсчёта до конца акции (по умолчанию — до конца суток).
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

function msUntilEndOfDay() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  return Math.max(0, end.getTime() - now.getTime());
}

function two(n: number) {
  return String(n).padStart(2, "0");
}

export function DealsCountdown({ label = "До конца акции" }: { label?: string }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    setLeft(msUntilEndOfDay());
    const id = window.setInterval(() => setLeft(msUntilEndOfDay()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (left === null) return null;

  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand-strong">
      <Timer className="h-3.5 w-3.5" />
      {label}
      <span className="tabular-nums">
        {two(h)}:{two(m)}:{two(s)}
      </span>
    </div>
  );
}
