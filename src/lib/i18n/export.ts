import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { translationKeys, translations } from "@/db/schema";
import { unflattenJson } from "./json";

export type ExportRow = { namespace: string; key: string; sourceValue: string; value: string | null };
export type ExportOptions = { format: "nested" | "flat"; fallback: "source" | "empty" };

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
