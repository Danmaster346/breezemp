// Клиентский трекер событий товара: анонимный посетитель + защита от повторов
// в рамках сессии. Ошибки трекинга никогда не ломают UI.
import { trackProductEvent } from "@/lib/analytics/product-events.functions";

const VISITOR_KEY = "kupiks_visitor";

function visitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return "anonymous000000";
  }
}

/** Отправляет событие один раз за сессию на пару (товар, тип). */
export function trackProduct(productId: string, kind: "view" | "add_to_cart") {
  if (typeof window === "undefined") return;
  const key = `kupiks_ev_${kind}_${productId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* приватный режим — просто отправим событие */
  }
  void trackProductEvent({ data: { product_id: productId, kind, visitor: visitorId() } }).catch(
    () => undefined,
  );
}
