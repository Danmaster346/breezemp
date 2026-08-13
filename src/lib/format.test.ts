import { describe, expect, it } from "vitest";
import { formatPrice, rublesToKopecks } from "./format";

describe("formatPrice", () => {
  it("переводит копейки в рубли с символом валюты", () => {
    expect(formatPrice(0)).toContain("0");
    expect(formatPrice(150000)).toContain("1");
    expect(formatPrice(150000)).toContain("₽");
  });
});

describe("rublesToKopecks", () => {
  it("парсит числа и строки, включая запятую", () => {
    expect(rublesToKopecks(10)).toBe(1000);
    expect(rublesToKopecks("10.50")).toBe(1050);
    expect(rublesToKopecks("10,50")).toBe(1050);
  });

  it("возвращает 0 для мусора", () => {
    expect(rublesToKopecks("abc")).toBe(0);
  });
});
