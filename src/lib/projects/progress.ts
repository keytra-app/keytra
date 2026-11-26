import { asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { projectLocales, translationKeys, translations } from "@/db/schema";
import { formatPercentage } from "@/lib/i18n/locales";

export type LocaleProgress = {
  id: string;
  code: string;
  name: string;
  total: number;
  translated: number;
  outdated: number;
  missing: number;
  percentage: number;
};

type StatusCounts = { translated: number; outdated: number };

const NO_TRANSLATIONS: StatusCounts = { translated: 0, outdated: 0 };

/** Translation counts per locale id, across all given projects. */
export async function countTranslationsByLocale(
  projectIds: string[],
): Promise<Map<string, StatusCounts>> {
  const rows = await db
    .select({ localeId: translations.localeId, status: translations.status, n: count() })
    .from(translations)
    .innerJoin(translationKeys, eq(translationKeys.id, translations.keyId))
    .where(inArray(translationKeys.projectId, projectIds))
    .groupBy(translations.localeId, translations.status);

  const byLocale = new Map<string, StatusCounts>();
  for (const row of rows) {
    const entry = byLocale.get(row.localeId) ?? { ...NO_TRANSLATIONS };
    entry[row.status] = row.n;
    byLocale.set(row.localeId, entry);
  }
  return byLocale;
}

export function toLocaleProgress(
  locale: { id: string; code: string; name: string },
  total: number,
  counts: StatusCounts = NO_TRANSLATIONS,
): LocaleProgress {
  const { translated, outdated } = counts;
  return {
    id: locale.id,
    code: locale.code,
    name: locale.name,
    total,
    translated,
    outdated,
    missing: Math.max(0, total - translated - outdated),
    percentage: formatPercentage(translated, total),
  };
}

/** Key count and per-target-locale progress of one project. */
export async function getProjectProgress(project: { id: string; sourceLocale: string }) {
  const [[{ total }], locales, countsByLocale] = await Promise.all([
    db
      .select({ total: count() })
      .from(translationKeys)
      .where(eq(translationKeys.projectId, project.id)),
    db
      .select({ id: projectLocales.id, code: projectLocales.code, name: projectLocales.name })
      .from(projectLocales)
      .where(eq(projectLocales.projectId, project.id))
      .orderBy(asc(projectLocales.code)),
    countTranslationsByLocale([project.id]),
  ]);

  return {
    totalKeys: total,
    locales: locales
      .filter((locale) => locale.code !== project.sourceLocale)
      .map((locale) => toLocaleProgress(locale, total, countsByLocale.get(locale.id))),
  };
}
