// In order: escaped "%%" (consumed, then dropped), {{var}}, {var}, %s/%d/%@ (also positional %1$s), $1–$9.
// shortcut: no ICU MessageFormat parsing, so a one-word plural branch like {items} counts as a
// variable; use a real ICU parser if projects rely on plural/select syntax.
const PLACEHOLDER_RE = /%%|\{\{[^{}]+\}\}|\{[\w.-]+\}|%(?:[1-9]\$)?[sd@]|\$[1-9](?!\d)/g;

export function extractPlaceholders(text: string): string[] {
  const found = (text.match(PLACEHOLDER_RE) ?? [])
    .filter((m) => m !== "%%")
    // "{{ name }}" and "{{name}}" are the same variable.
    .map((m) => (m.startsWith("{{") ? `{{${m.slice(2, -2).trim()}}}` : m));
  return [...new Set(found)];
}

export function getMissingPlaceholders(source: string, target: string): string[] {
  const present = new Set(extractPlaceholders(target));
  return extractPlaceholders(source).filter((p) => !present.has(p));
}
