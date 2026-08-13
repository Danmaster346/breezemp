import { describe, expect, it } from "vitest";
import { ALL_STATUSES, STATUS_LABELS, normalizeStatus } from "./order-status";

describe("normalizeStatus", () => {
  it("сводит устаревшие статусы к сборке", () => {
    expect(normalizeStatus("new")).toBe("processing");
    expect(normalizeStatus("confirmed")).toBe("processing");
  });

  it("пустое значение — сборка", () => {
    expect(normalizeStatus(null)).toBe("processing");
    expect(normalizeStatus(undefined)).toBe("processing");
  });

  it("остальные статусы не меняются", () => {
    expect(normalizeStatus("shipped")).toBe("shipped");
    expect(normalizeStatus("returned")).toBe("returned");
  });
});

describe("STATUS_LABELS", () => {
  it("у каждого фильтруемого статуса есть русская подпись", () => {
    for (const s of ALL_STATUSES) {
      expect(STATUS_LABELS[s]?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
