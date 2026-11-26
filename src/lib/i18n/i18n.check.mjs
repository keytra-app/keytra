// Self-check: node src/lib/i18n/i18n.check.mjs
import assert from "node:assert/strict";
import { computeSourceHash, flattenJson, InvalidJsonError, unflattenJson } from "./json.ts";
import { extractPlaceholders, getMissingPlaceholders } from "./placeholders.ts";

const nested = { auth: { login: { button: "Login", empty: "" } }, "a.b": "x" };
const flat = { "auth.login.button": "Login", "auth.login.empty": "", "a.b": "x" };
assert.deepEqual(flattenJson(nested), flat);
assert.deepEqual(flattenJson(unflattenJson(flat)), flat);

for (const bad of [[], "x", null, { a: 1 }, { a: null }, { a: ["x"] }, { "": "x" }, { a: "\0" }, { "a.b": "1", a: { b: "2" } }]) {
  assert.throws(() => flattenJson(bad), InvalidJsonError, JSON.stringify(bad));
}

// Leaf/parent conflicts, literal dots and prototype keys must survive a round trip.
const tricky = JSON.parse('{"a":"1","a.b":"2","a.b.c":"3","Wait...":"4","__proto__.x":"5","constructor":"6"}');
assert.deepEqual(flattenJson(unflattenJson(tricky)), tricky);
assert.equal({}.x, undefined);

assert.equal(computeSourceHash("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

assert.deepEqual(
  extractPlaceholders("{{ name }} {{name}} {count} %s %d %@ %1$s $1 $9 $100 100%%s"),
  ["{{name}}", "{count}", "%s", "%d", "%@", "%1$s", "$1", "$9"],
);
assert.deepEqual(getMissingPlaceholders("Hi {name}, %d of $2", "Hallo {name}"), ["%d", "$2"]);

console.log("ok");
