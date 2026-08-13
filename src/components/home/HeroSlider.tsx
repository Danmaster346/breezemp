// Hero-слайдер главной: автопрокрутка 5с, пауза при hover, точки и стрелки.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { PublicBanner } from "@/lib/admin/banners.functions";

const INTERVAL = 5000;

function Slide({ banner }: { banner: PublicBanner }) {
  return (
    <div
      className="relative flex h-full min-h-[240px] flex-col justify-between overflow-hidden rounded-3xl p-6 text-white md:min-h-[360px] md:p-12"
      style={{ backgroundColor: banner.bg_color }}
    >
      <div className="relative z-10 max-w-lg">
        {banner.promo_code && (
          <div className="mb-4 inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-bold shadow-sm backdrop-blur">
            Промокод {banner.promo_code}
          </div>
        )}
        <h2 className="font-display text-2xl font-extrabold leading-[1.05] tracking-tight md:text-4xl">
          {banner.title}
        </h2>
        {banner.subtitle && (
          <p className="mt-3 max-w-sm text-sm text-white/85 md:text-base">{banner.subtitle}</p>
        )}
        <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-foreground shadow-md ui-transition hover:bg-white/90">
          За покупками <ArrowRight className="h-4 w-4" />
        </span>
      </div>
      <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-white/10 blur-2xl md:h-96 md:w-96" />
    </div>
  );
}

/** Дефолтный промо-слайд, когда админ ещё не добавил баннеры. */
export function HeroFallback() {
  return (
    <div className="relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-[#fff1ec] via-[#ffe0d4] to-[#ffd0be] p-6 md:min-h-[360px] md:p-12">
      <div className="relative z-10 max-w-md">
        <div className="mb-4 inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-foreground/80 shadow-sm backdrop-blur">
          Только сейчас
        </div>
        <div className="font-display font-extrabold leading-[0.95] tracking-tight text-foreground">
          <span className="block text-6xl text-brand drop-shadow-sm md:text-8xl">−15%</span>
          <span className="mt-2 block text-xl md:text-3xl">на первые заказы в Kupiks</span>
        </div>
        <p className="mt-3 max-w-xs text-sm text-foreground/70 md:text-base">
          Промокод <span className="font-bold text-foreground">KUPIKS</span> для новых покупателей.
        </p>
        <Link
          to="/catalog"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 font-semibold text-background shadow-md ui-transition hover:opacity-90"
        >
          За покупками <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-white/40 blur-2xl md:h-96 md:w-96" />
      <div className="absolute right-8 top-8 hidden h-32 w-32 items-center justify-center rounded-full bg-white/80 text-6xl shadow-sm backdrop-blur md:flex">
        🛍️
      </div>
    </div>
  );
}

export function HeroSlider({ banners }: { banners: PublicBanner[] }) {
  const [index, setIndex] = useState(0);
  const paused = useRef(false);
  const count = banners.length;

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2) return;
    const id = window.setInterval(() => {
      if (!paused.current) setIndex((i) => (i + 1) % count);
    }, INTERVAL);
    return () => window.clearInterval(id);
  }, [count]);

  if (count === 0) return <HeroFallback />;

  const active = banners[index]!;
  const inner = <Slide banner={active} />;

  const wrapped =
    active.link && active.link.startsWith("/") ? (
      <Link to={active.link} className="block">
        {inner}
      </Link>
    ) : active.link ? (
      <a href={active.link} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    ) : (
      inner
    );

  return (
    <div
      className="relative"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      {wrapped}

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Предыдущий баннер"
            onClick={() => go(index - 1)}
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-card/85 shadow-md ui-transition hover:bg-card md:grid"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Следующий баннер"
            onClick={() => go(index + 1)}
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-card/85 shadow-md ui-transition hover:bg-card md:grid"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={`Баннер ${i + 1}`}
                aria-current={i === index}
                onClick={() => go(i)}
                className={`h-2 rounded-full ui-transition ${
                  i === index ? "w-6 bg-white" : "w-2 bg-white/60 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
