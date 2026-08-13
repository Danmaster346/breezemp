// Клиентский антифлуд: после действия блокируем кнопку на N секунд
// и отдаём остаток времени для подписи «Отправить (2с)».
import { useCallback, useEffect, useRef, useState } from "react";

export function useCooldown(ms = 2000) {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (until <= Date.now()) return;
    timer.current = setInterval(() => setNow(Date.now()), 200);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [until]);

  const remainingMs = Math.max(0, until - now);
  const active = remainingMs > 0;
  const seconds = Math.ceil(remainingMs / 1000);

  const start = useCallback(() => {
    setNow(Date.now());
    setUntil(Date.now() + ms);
  }, [ms]);

  return { active, seconds, start };
}
