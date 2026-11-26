import { and, asc, eq, sql } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import { db } from "@/db";
import { projectLocales, translationKeys, translations } from "@/db/schema";
import { unflattenJson } from "./json";

export type ExportRow = {
  namespace: string;
  key: string;
  sourceValue: string;
  value: string | null;
};
export type ExportOptions = { format: "nested" | "flat"; fallback: "source" | "empty" };

/** `id: null` is the source language. */
type ExportLocale = { id: string | null; code: string };
type ExportProject = { id: string; sourceLocale: string };

/** Rows of one language, sorted by key. `localeId: null` is the source language. */
export async function getExportRows(
  projectId: string,
  localeId: string | null,
  namespace?: string,
): Promise<ExportRow[]> {
  const where = and(
    eq(translationKeys.projectId, projectId),
    namespace === undefined ? undefined : eq(translationKeys.namespace, namespace),
  );
  const columns = {
    namespace: translationKeys.namespace,
    key: translationKeys.key,
    sourceValue: translationKeys.sourceValue,
  };

  if (localeId === null) {
    return db
      .select({ ...columns, value: sql<string>`${translationKeys.sourceValue}` })
      .from(translationKeys)
      .where(where)
      .orderBy(translationKeys.key);
  }
  return db
    .select({ ...columns, value: translations.value })
    .from(translationKeys)
    .leftJoin(
      translations,
      and(eq(translations.keyId, translationKeys.id), eq(translations.localeId, localeId)),
    )
    .where(where)
    .orderBy(translationKeys.key);
}

/** Outdated translations are delivered as they are; fallback only applies to missing ones. */
export function buildExportObject(rows: ExportRow[], { format, fallback }: ExportOptions) {
  const flat = Object.fromEntries(
    rows.map((r) => [r.key, r.value ?? (fallback === "source" ? r.sourceValue : "")]),
  );
  return format === "flat" ? flat : unflattenJson(flat);
}

export const toJsonFile = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** The source language first, then the target languages by code. */
export async function getExportLocales(project: ExportProject): Promise<ExportLocale[]> {
  const targets = await db
    .select({ id: projectLocales.id, code: projectLocales.code })
    .from(projectLocales)
    .where(eq(projectLocales.projectId, project.id))
    .orderBy(asc(projectLocales.code));
  return [
    { id: null, code: project.sourceLocale },
    ...targets.filter((l) => l.code !== project.sourceLocale),
  ];
}

export async function findExportLocale(project: ExportProject, code: string | null) {
  const locales = await getExportLocales(project);
  return locales.find((l) => l.code === code) ?? null;
}

// Namespaces are free text; a slash must not create folders (or "../" entries) inside the ZIP.
const zipName = (namespace: string) => namespace.replace(/[%/\\\x00-\x1f]/g, encodeURIComponent);

/** One `<locale>/<namespace>.json` per language and namespace. */
export async function buildExportArchive(project: ExportProject, options: ExportOptions) {
  const [locales, found] = await Promise.all([
    getExportLocales(project),
    db
      .selectDistinct({ namespace: translationKeys.namespace })
      .from(translationKeys)
      .where(eq(translationKeys.projectId, project.id)),
  ]);
  const namespaces = found.length ? found.map((n) => n.namespace) : ["default"];

  // shortcut: ZIP is built in memory; switch to fflate's streaming Zip for very large projects.
  const files: Record<string, Uint8Array> = {};
  for (const locale of locales) {
    const rows = await getExportRows(project.id, locale.id);
    const byNamespace = Map.groupBy(rows, (r) => r.namespace);
    for (const namespace of namespaces) {
      const object = buildExportObject(byNamespace.get(namespace) ?? [], options);
      files[`${locale.code}/${zipName(namespace)}.json`] = strToU8(toJsonFile(object));
    }
  }
  return new Uint8Array(zipSync(files));
}
