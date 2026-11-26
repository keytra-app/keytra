import { describe, expect, it } from "vitest";
import { InvalidJsonError, computeSourceHash, flattenJson, unflattenJson } from "./json";

describe("flattenJson / unflattenJson roundtrip", () => {
  it("roundtrips flat dotted JSON", () => {
    const input = { "a.b": "x", c: "y" };
    expect(unflattenJson(flattenJson(input))).toEqual({ a: { b: "x" }, c: "y" });
  });

  it("flattens deeply nested objects to dot keys", () => {
    const nested = { a: { b: { c: "deep" }, d: "mid" }, e: "top" };
    const flat = flattenJson(nested);
    expect(flat).toEqual({ "a.b.c": "deep", "a.d": "mid", e: "top" });
    expect(unflattenJson(flat)).toEqual(nested);
  });

  it("keeps empty strings, special characters and unicode", () => {
    const input = { empty: "", quote: 'say "hi"', nl: "line1\nline2", emoji: "🔑 Schlüssel", tab: "a\tb" };
    expect(unflattenJson(flattenJson(input))).toEqual(input);
  });

  it("keeps keys with empty dot segments literal, without losing the value", () => {
    // "msg.Wait..." has empty segments, so unflatten keeps it as one key (no nesting).
    const input = { msg: { "Wait...": "ok" } };
    expect(flattenJson(input)).toEqual({ "msg.Wait...": "ok" });
    expect(unflattenJson(flattenJson(input))).toEqual({ "msg.Wait...": "ok" });
  });

  it("keeps a key that is both a leaf and a parent without losing data", () => {
    const flat = { a: "leaf", "a.b": "child" };
    const result = unflattenJson(flat);
    expect(result).toEqual({ a: "leaf", "a.b": "child" });
  });

  it("keeps __proto__ as plain data", () => {
    const input = JSON.parse('{"__proto__": {"polluted": "yes"}}') as Record<string, unknown>;
    const flat = flattenJson(input);
    expect(Object.getPrototypeOf(flat)).toBe(Object.prototype);
    expect(Object.keys(flat)).toEqual(["__proto__.polluted"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("flattenJson rejects invalid input", () => {
  it.each([
    ["array root", [] as unknown as Record<string, unknown>],
    ["null root", null as unknown as Record<string, unknown>],
    ["string root", "text" as unknown as Record<string, unknown>],
  ])("rejects %s", (_name, input) => {
    expect(() => flattenJson(input)).toThrow(InvalidJsonError);
  });

  it.each([
    ["number", { a: 1 }, "number"],
    ["boolean", { a: true }, "boolean"],
    ["null", { a: null }, "null"],
    ["array", { a: ["x"] }, "array"],
  ])("rejects %s values with a typed message", (_name, input, type) => {
    expect(() => flattenJson(input)).toThrow(`must be a string, got ${type}`);
  });

  it("rejects empty key segments", () => {
    expect(() => flattenJson({ "": "x" })).toThrow(InvalidJsonError);
    expect(() => flattenJson({ a: { "": "x" } })).toThrow(InvalidJsonError);
  });

  it("rejects NUL characters in keys and values", () => {
    expect(() => flattenJson({ "a\0b": "x" })).toThrow("NUL");
    expect(() => flattenJson({ a: "x\0y" })).toThrow("NUL");
  });

  it("rejects keys longer than 512 characters", () => {
    expect(() => flattenJson({ ["k".repeat(513)]: "x" })).toThrow(InvalidJsonError);
    expect(() => flattenJson({ ["k".repeat(512)]: "x" })).not.toThrow();
  });

  it("rejects nesting deeper than 32 levels", () => {
    let deep: Record<string, unknown> = { leaf: "x" };
    for (let i = 0; i < 40; i++) deep = { n: deep };
    expect(() => flattenJson(deep)).toThrow("Nesting deeper than 32");
  });

  it("rejects duplicate keys produced by mixing nested and dotted notation", () => {
    expect(() => flattenJson({ a: { b: "1" }, "a.b": "2" })).toThrow('Duplicate key "a.b"');
  });
});

describe("computeSourceHash", () => {
  it("returns a stable sha256 hex digest", () => {
    expect(computeSourceHash("Hallo")).toMatch(/^[0-9a-f]{64}$/);
    expect(computeSourceHash("Hallo")).toBe(computeSourceHash("Hallo"));
    expect(computeSourceHash("Hallo")).not.toBe(computeSourceHash("hallo"));
  });
});
