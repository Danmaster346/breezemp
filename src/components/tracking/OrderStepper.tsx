// Степпер этапов доставки: горизонтальный на десктопе, вертикальный на мобиле.
import { Check, Package, PackageCheck, Truck, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TrackStage, TrackStep } from "@/lib/tracking.shared";

const ICONS: Record<TrackStage, LucideIcon> = {
  accepted: PackageCheck,
  packing: Package,
  shipped: Truck,
  in_transit: MapPin,
  delivered: Check,
};

const fmt = (s: string) =>
  new Date(s).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function dot(state: TrackStep["state"]) {
  if (state === "done") return "bg-brand text-brand-foreground border-brand";
  if (state === "current") return "bg-background text-brand border-brand ring-4 ring-brand/20";
  return "bg-background text-muted-foreground border-border";
}

export function OrderStepper({ steps }: { steps: TrackStep[] }) {
  return (
    <div>
      {/* Десктоп — горизонтально */}
      <div className="hidden sm:flex items-start">
        {steps.map((s, i) => {
          const Icon = ICONS[s.key];
          const done = s.state === "done";
          return (
            <div key={s.key} className="flex-1 flex flex-col items-center text-center relative">
              {i > 0 && (
                <span
                  className={`absolute top-5 right-1/2 left-0 h-0.5 ${
                    done || s.state === "current" ? "bg-brand" : "bg-border"
                  }`}
                  aria-hidden
                />
              )}
              {i < steps.length - 1 && (
                <span
                  className={`absolute top-5 left-1/2 right-0 h-0.5 ${
                    steps[i + 1].state === "done" || steps[i + 1].state === "current"
                      ? "bg-brand"
                      : "bg-border"
                  }`}
                  aria-hidden
                />
              )}
              <div
                className={`relative z-10 grid h-10 w-10 place-items-center rounded-full border-2 ui-transition ${dot(s.state)}`}
              >
                {done ? <Check className="h-5 w-5" strokeWidth={2.5} /> : <Icon className="h-5 w-5" strokeWidth={2} />}
              </div>
              <div
                className={`mt-2 text-sm font-semibold ${
                  s.state === "upcoming" ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                {s.label}
              </div>
              <div className="text-[11px] text-muted-foreground min-h-[16px]">
                {s.date && s.state !== "upcoming" ? fmt(s.date) : ""}
              </div>
            </div>
          );
        })}
      </div>

      {/* Мобильный — вертикально */}
      <ol className="sm:hidden relative">
        {steps.map((s, i) => {
          const Icon = ICONS[s.key];
          const done = s.state === "done";
          const last = i === steps.length - 1;
          return (
            <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
              {!last && (
                <span
                  className={`absolute left-5 top-10 bottom-0 w-0.5 -translate-x-1/2 ${
                    steps[i + 1].state === "upcoming" ? "bg-border" : "bg-brand"
                  }`}
                  aria-hidden
                />
              )}
              <div
                className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 ui-transition ${dot(s.state)}`}
              >
                {done ? <Check className="h-5 w-5" strokeWidth={2.5} /> : <Icon className="h-5 w-5" strokeWidth={2} />}
              </div>
              <div className="pt-1.5">
                <div
                  className={`text-sm font-semibold ${
                    s.state === "upcoming" ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {s.label}
                </div>
                {s.date && s.state !== "upcoming" && (
                  <div className="text-xs text-muted-foreground">{fmt(s.date)}</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
