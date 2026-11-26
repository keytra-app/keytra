export type LocaleOption = {
  code: string;
  name: string;
};

export const COMMON_LOCALES: readonly LocaleOption[] = [
  { code: "de", name: "Deutsch" },
  { code: "en", name: "Englisch" },
  { code: "fr", name: "Französisch" },
  { code: "es", name: "Spanisch" },
  { code: "it", name: "Italienisch" },
  { code: "pl", name: "Polnisch" },
  { code: "tr", name: "Türkisch" },
  { code: "pt-BR", name: "Portugiesisch (Brasilien)" },
  { code: "nl", name: "Niederländisch" },
  { code: "ja", name: "Japanisch" },
  { code: "ko", name: "Koreanisch" },
  { code: "zh-CN", name: "Chinesisch (Vereinfacht)" },
] as const;

const LOCALE_CODE_RE = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidLocaleCode(code: string): boolean {
  return code.length >= 2 && code.length <= 20 && LOCALE_CODE_RE.test(code);
}

export function resolveLocaleName(code: string, customName?: string): string {
  const trimmed = customName?.trim();
  if (trimmed) return trimmed.slice(0, 64);

  const preset = COMMON_LOCALES.find((l) => l.code.toLowerCase() === code.toLowerCase());
  if (preset) return preset.name;

  try {
    const dn = new Intl.DisplayNames(["de"], { type: "language" });
    const display = dn.of(code);
    if (display) return display;
  } catch {
    // Fallback to raw code if Intl cannot resolve custom BCP-47 tags.
  }
  return code;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= 1 && slug.length <= 64 && SLUG_RE.test(slug);
}

export function formatPercentage(translated: number, total: number): number {
  if (!total) return 0;
  return Math.floor((translated / total) * 1000) / 10;
}
