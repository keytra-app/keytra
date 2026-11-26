import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { projectLocales, projects, translationKeys, translations, users } from "@/db/schema";
import { type CurrentUser, requireAuth, requireProjectAccess } from "@/lib/auth/session";

export type EditorTranslationStatus = "untranslated" | "outdated" | "translated";

export type EditorReferenceTranslation = {
  localeCode: string;
  localeName: string;
  value: string;
};

export type EditorTranslation = {
  value: string;
  status: "translated" | "outdated";
  updatedAt: string;
  updatedByName: string | null;
};

export type SourceKey = {
  id: string;
  namespace: string;
  key: string;
  description: string | null;
  sourceValue: string;
};

export type EditorKeyItem = SourceKey & {
  translation: EditorTranslation | null;
  references: EditorReferenceTranslation[];
};

export type EditorLocaleOption = {
  id: string;
  code: string;
  name: string;
};

export type EditorPageData = {
  user: CurrentUser;
  project: {
    id: string;
    name: string;
    slug: string;
    sourceLocale: string;
  };
  locale: EditorLocaleOption;
  locales: EditorLocaleOption[];
  keys: EditorKeyItem[];
};

type TranslationRow = {
  keyId: string;
  localeId: string;
  value: string;
  status: "translated" | "outdated";
  updatedAt: Date;
  updatedByName: string | null;
};

async function findProjectBySlug(slug: string) {
  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      sourceLocale: projects.sourceLocale,
    })
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);
  return project ?? null;
}

async function loadKeysAndTranslations(projectId: string) {
  return Promise.all([
    db
      .select({
        id: translationKeys.id,
        namespace: translationKeys.namespace,
        key: translationKeys.key,
        description: translationKeys.description,
        sourceValue: translationKeys.sourceValue,
      })
      .from(translationKeys)
      .where(eq(translationKeys.projectId, projectId))
      .orderBy(asc(translationKeys.namespace), asc(translationKeys.key)),
    db
      .select({
        keyId: translations.keyId,
        localeId: translations.localeId,
        value: translations.value,
        status: translations.status,
        updatedAt: translations.updatedAt,
        updatedByName: users.name,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translationKeys.id, translations.keyId))
      .leftJoin(users, eq(users.id, translations.updatedBy))
      .where(eq(translationKeys.projectId, projectId)),
  ]);
}

/**
 * Attaches the active locale's translation and, as references, the finished translations of
 * the other target locales to every key.
 */
function buildEditorKeys(
  keyRows: SourceKey[],
  translationRows: TranslationRow[],
  activeLocaleId: string,
  targetLocales: EditorLocaleOption[],
): EditorKeyItem[] {
  const localeById = new Map(targetLocales.map((l) => [l.id, l]));
  const activeByKey = new Map<string, EditorTranslation>();
  const refsByKey = new Map<string, EditorReferenceTranslation[]>();

  for (const row of translationRows) {
    if (row.localeId === activeLocaleId) {
      activeByKey.set(row.keyId, {
        value: row.value,
        status: row.status,
        updatedAt: row.updatedAt.toISOString(),
        updatedByName: row.updatedByName,
      });
      continue;
    }

    const refLocale = localeById.get(row.localeId);
    if (row.status !== "translated" || row.value.length === 0 || !refLocale) continue;
    const list = refsByKey.get(row.keyId) ?? [];
    list.push({ localeCode: refLocale.code, localeName: refLocale.name, value: row.value });
    refsByKey.set(row.keyId, list);
  }

  return keyRows.map((row) => ({
    ...row,
    translation: activeByKey.get(row.id) ?? null,
    references: (refsByKey.get(row.id) ?? []).sort((a, b) =>
      a.localeCode.localeCompare(b.localeCode),
    ),
  }));
}

export async function getEditorData(slug: string, localeCode: string): Promise<EditorPageData> {
  // Auth first: otherwise 404 vs. login redirect reveals which slugs exist.
  await requireAuth();
  const project = await findProjectBySlug(slug);
  if (!project) notFound();

  const user = await requireProjectAccess(project.id);

  const allLocales = await db
    .select({ id: projectLocales.id, code: projectLocales.code, name: projectLocales.name })
    .from(projectLocales)
    .where(eq(projectLocales.projectId, project.id))
    .orderBy(asc(projectLocales.code));

  const targetLocales = allLocales.filter((l) => l.code !== project.sourceLocale);
  const activeLocale = targetLocales.find((l) => l.code === localeCode);
  if (!activeLocale) notFound();

  const [keyRows, translationRows] = await loadKeysAndTranslations(project.id);

  return {
    user,
    project,
    locale: activeLocale,
    locales: targetLocales,
    keys: buildEditorKeys(keyRows, translationRows, activeLocale.id, targetLocales),
  };
}
