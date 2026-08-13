// Черновик оформления заказа: данные получателя и промокод в localStorage
const DRAFT_KEY = "kupiks:checkout-draft";
const PROMO_KEY = "kupiks:cart-promo";

export type CheckoutDraft = {
  name: string;
  phone: string;
  city: string;
  address: string;
  zip: string;
  comment: string;
  method: string;
};

export const EMPTY_DRAFT: CheckoutDraft = {
  name: "",
  phone: "",
  city: "",
  address: "",
  zip: "",
  comment: "",
  method: "cdek",
};

export function loadDraft(): CheckoutDraft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed = JSON.parse(raw) as Partial<CheckoutDraft>;
    return { ...EMPTY_DRAFT, ...parsed };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function saveDraft(draft: CheckoutDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // приватный режим — игнорируем
  }
}

export function loadPromoCode(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(PROMO_KEY) ?? "";
  } catch {
    return "";
  }
}

export function savePromoCode(code: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (code) window.localStorage.setItem(PROMO_KEY, code);
    else window.localStorage.removeItem(PROMO_KEY);
  } catch {
    // игнорируем
  }
}

// Маска телефона: +7 (999) 000-00-00
export function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (!digits.startsWith("7")) digits = "7" + digits;
  digits = digits.slice(0, 11);
  const d = digits.slice(1);
  let out = "+7";
  if (d.length > 0) out += ` (${d.slice(0, 3)}`;
  if (d.length >= 3) out += ")";
  if (d.length > 3) out += ` ${d.slice(3, 6)}`;
  if (d.length > 6) out += `-${d.slice(6, 8)}`;
  if (d.length > 8) out += `-${d.slice(8, 10)}`;
  return out;
}

export function isPhoneComplete(masked: string): boolean {
  return masked.replace(/\D/g, "").length === 11;
}
