// Умное изображение: IntersectionObserver-ленивая загрузка + резерв места
// (width/height) + скелетон-плейсхолдер + плавное появление.
import { useEffect, useRef, useState } from "react";

export type SmartImageProps = {
  src: string | null | undefined;
  alt: string;
  /** Ожидаемая ширина кадра в px — нужна браузеру для резерва места */
  width?: number;
  height?: number;
  className?: string;
  /** Класс контейнера (по умолчанию квадрат) */
  wrapperClassName?: string;
  sizes?: string;
  /** LCP-изображение: грузим сразу, без наблюдателя */
  priority?: boolean;
  /** Фолбэк, если ссылки нет */
  fallback?: React.ReactNode;
};

// 1x1 серый пиксель как blur-плейсхолдер под изображением
const BLUR_PLACEHOLDER =
  "data:image/svg+xml;base64," +
  "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlNWU3ZWIiLz48L3N2Zz4=";

function optimizeImageUrl(src: string | null | undefined, width: number): string | null | undefined {
  if (!src) return src;
  if (src.includes("supabase.co/storage")) {
    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}width=${width}&quality=75&format=webp`;
  }
  return src;
}

// Набор ширин под разные экраны/плотности пикселей (только для трансформируемых ссылок)
function buildSrcSet(src: string | null | undefined, width: number): string | undefined {
  if (!src || !src.includes("supabase.co/storage")) return undefined;
  const widths = Array.from(
    new Set([Math.round(width / 2), width, Math.round(width * 1.5), width * 2]),
  ).filter((w) => w >= 80 && w <= 2000);
  return widths.map((w) => `${optimizeImageUrl(src, w)} ${w}w`).join(", ");
}


export function SmartImage({
  src,
  alt,
  width = 600,
  height = 600,
  className = "",
  wrapperClassName = "",
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw",
  priority = false,
  fallback,
}: SmartImageProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(priority);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (priority || visible) return;
    const el = wrapRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [priority, visible]);

  return (
    <div ref={wrapRef} className={`relative overflow-hidden ${wrapperClassName}`}>
      {/* Скелетон, пока картинка не отрисована */}
      {!loaded && (
        <div
          className="absolute inset-0 skeleton-shimmer bg-cover bg-center blur-sm scale-110"
          style={{ backgroundImage: `url("${BLUR_PLACEHOLDER}")` }}
          aria-hidden
        />
      )}
      {src ? (
        visible ? (
          <img
            src={optimizeImageUrl(src, width) ?? ""}
            alt={alt}
            width={width}
            height={height}
            sizes={sizes}
            loading={priority ? "eager" : "lazy"}
            decoding={priority ? "auto" : "async"}
            fetchPriority={priority ? "high" : "auto"}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
            className={`${className} transition-opacity duration-500 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : null
      ) : (
        <div className="h-full w-full flex items-center justify-center text-5xl opacity-30">
          {fallback ?? "🛍️"}
        </div>
      )}
    </div>
  );
}
