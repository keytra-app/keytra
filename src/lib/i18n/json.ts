import { createHash } from "node:crypto";

// Postgres btree entries are capped at ~2.7 kB and the key is part of a unique index.
const MAX_KEY_LENGTH = 512;
const MAX_DEPTH = 32;

/** Input that can't be turned into translation keys. The message is safe to show to clients. */
export class InvalidJsonError extends Error {}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Flattens nested and/or already dotted JSON to `{ "a.b.c": "text" }`.
 * Rejects (never silently drops) anything but strings and objects: a dropped key
 * would be deleted by a push with `prune`.
 */
export function flattenJson(input: Record<string, unknown>): Record<string, string> {
  if (!isPlainObject(input)) throw new InvalidJsonError("Root must be a JSON object.");
  const out = new Map<string, string>();

  const walk = (node: Record<string, unknown>, prefix: string, depth: number) => {
    if (depth > MAX_DEPTH) throw new InvalidJsonError(`Nesting deeper than ${MAX_DEPTH} levels.`);
    for (const [segment, value] of Object.entries(node)) {
      const key = depth === 1 ? segment : `${prefix}.${segment}`;
      if (!segment) throw new InvalidJsonError(`Empty key segment in "${key}".`);
      if (key.length > MAX_KEY_LENGTH) {
        throw new InvalidJsonError(`Key longer than ${MAX_KEY_LENGTH} characters.`);
      }
      if (isPlainObject(value)) {
        walk(value, key, depth + 1);
        continue;
      }
      if (typeof value !== "string") {
        const type = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
        throw new InvalidJsonError(`Value of "${key}" must be a string, got ${type}.`);
      }
      // Postgres text columns can't store NUL.
      if (key.includes("\0") || value.includes("\0")) {
        throw new InvalidJsonError("NUL characters are not allowed.");
      }
      if (out.has(key)) throw new InvalidJsonError(`Duplicate key "${key}".`);
      out.set(key, value);
    }
  };

  walk(input, "", 1);
  // fromEntries defines own properties, so a key like "__proto__" stays plain data.
  return Object.fromEntries(out);
}

type Tree = Map<string, string | Tree>;

const toObject = (tree: Tree): Record<string, unknown> =>
  Object.fromEntries([...tree].map(([k, v]) => [k, typeof v === "string" ? v : toObject(v)]));

/**
 * Rebuilds nested JSON from dot notation. If a key is both a leaf and a parent
 * ("a" and "a.b"), the longer one stays dotted next to the leaf, so nothing is lost.
 */
export function unflattenJson(flat: Record<string, string>): Record<string, unknown> {
  const root: Tree = new Map();
  // Sorted, so a leaf is always placed before the keys nested below it.
  for (const key of Object.keys(flat).sort()) {
    const segments = key.split(".");
    let node = root;
    let i = 0;
    // Empty segments ("Wait...") are literal text, not nesting.
    if (segments.every(Boolean)) {
      for (; i < segments.length - 1; i++) {
        let child = node.get(segments[i]);
        if (typeof child === "string") break;
        if (!child) node.set(segments[i], (child = new Map()));
        node = child;
      }
    }
    node.set(segments.slice(i).join("."), flat[key]);
  }
  return toObject(root);
}

export function computeSourceHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
