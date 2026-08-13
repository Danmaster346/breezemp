import { describe, expect, it } from "vitest";
import { backoffDelay, errorMessage, isClientError, queryRetry, withRetry } from "./retry";

describe("isClientError", () => {
  it("определяет 4xx по полю status", () => {
    expect(isClientError({ status: 404 })).toBe(true);
    expect(isClientError({ status: 500 })).toBe(false);
  });

  it("определяет 4xx по тексту", () => {
    expect(isClientError(new Error("Unauthorized"))).toBe(true);
    expect(isClientError(new Error("network timeout"))).toBe(false);
  });
});

describe("backoffDelay", () => {
  it("растёт экспоненциально и упирается в предел", () => {
    expect(backoffDelay(0)).toBe(500);
    expect(backoffDelay(1)).toBe(1000);
    expect(backoffDelay(10)).toBe(8000);
  });
});

describe("queryRetry", () => {
  it("не повторяет клиентские ошибки", () => {
    expect(queryRetry(2)(0, { status: 403 })).toBe(false);
    expect(queryRetry(2)(0, new Error("timeout"))).toBe(true);
    expect(queryRetry(2)(2, new Error("timeout"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("возвращает результат после неудачной попытки", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls < 2) throw new Error("temporary network issue");
      return "ok";
    }, 2);
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("не повторяет 4xx", async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new Error("404 not found");
      }, 3),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });
});

describe("errorMessage", () => {
  it("отдаёт фолбэк для непонятных значений", () => {
    expect(errorMessage(null, "упс")).toBe("упс");
    expect(errorMessage(new Error("боом"))).toBe("боом");
  });
});
