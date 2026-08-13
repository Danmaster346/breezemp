// Pull-to-refresh для мобильных: тянем вниз в самом верху страницы — обновляем данные
import { useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 70; // порог срабатывания в px
const MAX_PULL = 110;

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown> | unknown;
  children: ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const active = useRef(false);

  useEffect(() => {
    // Только сенсорные устройства
    if (typeof window === "undefined") return;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || refreshing || e.touches.length !== 1) return;
      startY.current = e.touches[0].clientY;
      active.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active.current || startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0 || window.scrollY > 0) {
        setPull(0);
        return;
      }
      // Затухающее сопротивление
      setPull(Math.min(MAX_PULL, delta * 0.5));
    };

    const onTouchEnd = async () => {
      if (!active.current) return;
      active.current = false;
      startY.current = null;
      if (pull >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        setPull(THRESHOLD);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [pull, refreshing, onRefresh]);

  return (
    <div className="overscroll-y-contain">
      {/* Индикатор обновления */}
      <div
        className="md:hidden flex items-center justify-center overflow-hidden transition-[height] duration-150"
        style={{ height: pull }}
        aria-hidden={pull === 0}
      >
        <div className="grid h-9 w-9 place-items-center rounded-full bg-card border border-border shadow-sm">
          <RefreshCw
            className={`h-4 w-4 text-brand ${refreshing ? "animate-spin" : ""}`}
            style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }}
          />
        </div>
      </div>
      {children}
    </div>
  );
}
