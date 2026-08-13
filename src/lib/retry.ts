/**
 * Утилиты повторных попыток и безопасного выполнения async-операций.
 */

/** Ошибки клиента (4xx) повторять бессмысленно — их нужно исправлять, а не ретраить. */
export function isClientError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const status = (error as { status?: number } | null)?.status;
  if (typeof status === "number") return status >= 400 && status < 500;
  return /\b(400|401|403|404|409|422)\b|unauthorized|forbidden|not found/i.test(
    msg,
  );
}

/**
 * Задержка экспоненциального бэкоффа с ограничением сверху.
 * @param attempt номер попытки, начиная с 0
 */
export function backoffDelay(attempt: number, maxMs = 8000): number {
  return Math.min(maxMs, 500 * 2 ** attempt);
}

/**
 * Политика повторов для React Query: до `max` попыток, но не для 4xx.
 */
export function queryRetry(max = 2) {
  return (failureCount: number, error: unknown) =>
    !isClientError(error) && failureCount < max;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Выполняет операцию с повторными попытками и экспоненциальной задержкой.
 * @param fn операция (должна быть идемпотентной)
 * @param retries сколько раз повторить после первой неудачи
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (isClientError(error) || attempt === retries) break;
      await sleep(backoffDelay(attempt));
    }
  }
  throw lastError;
}

/** Достаёт человекочитаемое сообщение из любой ошибки. */
export function errorMessage(error: unknown, fallback = "Что-то пошло не так"): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}
