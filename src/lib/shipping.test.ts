import { describe, expect, it } from "vitest";
import {
  FREE_SHIPPING_FROM_KOPECKS,
  calcShippingCost,
  getShippingOption,
} from "./shipping";

describe("getShippingOption", () => {
  it("находит способ по id", () => {
    expect(getShippingOption("pickup").id).toBe("pickup");
  });

  it("для неизвестного id возвращает первый способ", () => {
    expect(getShippingOption("unknown").id).toBe("cdek");
  });
});

describe("calcShippingCost", () => {
  it("курьер бесплатен от порога", () => {
    expect(calcShippingCost("cdek", FREE_SHIPPING_FROM_KOPECKS)).toBe(0);
  });

  it("ниже порога берётся базовая стоимость", () => {
    expect(calcShippingCost("cdek", FREE_SHIPPING_FROM_KOPECKS - 1)).toBe(
      getShippingOption("cdek").baseKopecks,
    );
  });

  it("для ПВЗ порога нет", () => {
    expect(calcShippingCost("pickup", 10_000_00)).toBe(
      getShippingOption("pickup").baseKopecks,
    );
  });
});
