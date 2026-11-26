import { describe, expect, it } from "vitest";
import { extractPlaceholders, getMissingPlaceholders } from "./placeholders";

describe("extractPlaceholders", () => {
  it.each([
    ["{{name}}", "Hallo {{name}}", ["{{name}}"]],
    ["{count}", "Du hast {count} Einträge", ["{count}"]],
    ["%s", "Datei %s", ["%s"]],
    ["%d", "%d Treffer", ["%d"]],
    ["%@ (Apple)", "Wert: %@", ["%@"]],
    ["positional %1$s", "%1$s von %2$s", ["%1$s", "%2$s"]],
    ["$1", "Hallo $1", ["$1"]],
    ["$1 $2", "$1 und $2", ["$1", "$2"]],
  ])("detects %s", (_name, text, expected) => {
    expect(extractPlaceholders(text)).toEqual(expected);
  });

  it("returns an empty list for plain text", () => {
    expect(extractPlaceholders("Nur Text.")).toEqual([]);
    expect(extractPlaceholders("")).toEqual([]);
  });

  it("treats {{ name }} and {{name}} as the same variable", () => {
    expect(extractPlaceholders("{{ name }} und {{name}}")).toEqual(["{{name}}"]);
  });

  it("deduplicates repeated placeholders and keeps first-seen order", () => {
    expect(extractPlaceholders("{a} {b} {a} %s %s")).toEqual(["{a}", "{b}", "%s"]);
  });

  it("handles mixed patterns in one string", () => {
    expect(extractPlaceholders("{{user}} hat %d Dateien ($1) {count}")).toEqual([
      "{{user}}",
      "%d",
      "$1",
      "{count}",
    ]);
  });

  it("ignores escaped %% and does not treat it as %s/%d", () => {
    expect(extractPlaceholders("100%% fertig")).toEqual([]);
    expect(extractPlaceholders("100%% von %d")).toEqual(["%d"]);
  });

  it("does not match $10 as $1", () => {
    expect(extractPlaceholders("$10")).toEqual([]);
  });

  it("does not match unrelated percent or braces", () => {
    expect(extractPlaceholders("50% off, {} und %x")).toEqual([]);
  });
});

describe("getMissingPlaceholders", () => {
  it("returns nothing when target has all source placeholders", () => {
    expect(getMissingPlaceholders("Hallo {{name}}", "Hello {{name}}")).toEqual([]);
  });

  it("reports placeholders that are missing in the target", () => {
    expect(getMissingPlaceholders("{count} Dateien in %s", "Files in %s")).toEqual(["{count}"]);
    expect(getMissingPlaceholders("%s von %d", "x")).toEqual(["%s", "%d"]);
  });

  it("does not report extra placeholders in the target", () => {
    expect(getMissingPlaceholders("Hallo", "Hi {{name}}")).toEqual([]);
  });

  it("matches {{name}} against {{ name }} as the same variable", () => {
    expect(getMissingPlaceholders("{{name}}", "{{ name }}")).toEqual([]);
  });

  it("treats a renamed variable as missing", () => {
    expect(getMissingPlaceholders("{count}", "{anzahl}")).toEqual(["{count}"]);
  });

  it("does not treat %s and %1$s as equivalent", () => {
    expect(getMissingPlaceholders("%s", "%1$s")).toEqual(["%s"]);
  });
});
