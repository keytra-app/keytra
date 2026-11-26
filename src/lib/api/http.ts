export const apiError = (status: number, error: string, headers?: HeadersInit) =>
  Response.json({ error }, { status, headers });

export const unauthorized = () =>
  apiError(401, "Invalid or missing API key.", { "WWW-Authenticate": "Bearer" });

/** Reads an enum query param; the first option is the default, null means invalid. */
export function enumParam<T extends string>(url: URL, name: string, options: readonly [T, ...T[]]): T | null {
  const value = url.searchParams.get(name);
  if (value === null) return options[0];
  return options.find((o) => o === value) ?? null;
}

export const isValidNamespace = (value: string) =>
  value.length > 0 && value.length <= 100 && !value.includes("\0");

export function namespaceParam(url: URL): string | null {
  const value = url.searchParams.get("namespace") ?? "default";
  return isValidNamespace(value) ? value : null;
}
