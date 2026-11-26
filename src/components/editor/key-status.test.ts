import { describe, expect, it } from "vitest";
import type { EditorKeyItem } from "@/lib/editor/queries";
import { countByStatus, findNextOpenKey, hasUnsavedDraft, withoutDraft } from "./key-status";

function key(id: string, status: "translated" | "outdated" | null): EditorKeyItem {
  return {
    id,
    namespace: "default",
    key: id,
    description: null,
    sourceValue: "src",
    references: [],
    translation: status && { value: "v", status, updatedAt: "", updatedByName: null },
  };
}

describe("findNextOpenKey", () => {
  const list = [key("a", null), key("b", "translated"), key("c", "outdated"), key("d", null)];

  it("returns the next open key after the current one", () => {
    expect(findNextOpenKey(list, "a")?.id).toBe("c");
  });

  it("wraps around to the start", () => {
    expect(findNextOpenKey(list, "d")?.id).toBe("a");
  });

  it("never returns the current key and handles unknown ids", () => {
    expect(findNextOpenKey([key("a", null)], "a")).toBeNull();
    expect(findNextOpenKey(list, "zzz")).toBeNull();
  });
});

describe("drafts and counts", () => {
  it("counts keys per status", () => {
    const counts = countByStatus([key("a", null), key("b", "translated"), key("c", "outdated")]);
    expect(counts).toEqual({ all: 3, untranslated: 1, outdated: 1, translated: 1 });
  });

  it("treats a draft equal to the saved value as clean", () => {
    expect(hasUnsavedDraft(key("a", "translated"), { a: "v" })).toBe(false);
    expect(hasUnsavedDraft(key("a", "translated"), { a: "new" })).toBe(true);
  });

  it("keeps the drafts object when there is nothing to remove", () => {
    const drafts = { a: "x" };
    expect(withoutDraft(drafts, "b")).toBe(drafts);
    expect(withoutDraft(drafts, "a")).toEqual({});
  });
});
