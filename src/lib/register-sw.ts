// Регистрация service worker для офлайн-режима и кэширования статики.
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  // В превью-iframe редактора регистрация не нужна
  if (window.location.hostname === "localhost") return;

  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* офлайн-режим просто не включится */
    });
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
