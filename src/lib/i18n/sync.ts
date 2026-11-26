import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { projectLocales, projects, translationKeys, translations } from "@/db/schema";
import { computeSourceHash } from "./json";

// Keeps statements well below Postgres' 65535 bind parameter limit.
const BATCH = 1000;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH) out.push(items.slice(i, i + BATCH));
  return out;
}

/** Serializes concurrent imports per project. "no key update" doesn't block FK inserts. */
export async function lockProject(tx: Tx, projectId: string) {
  await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).for("no key update");
}

const inNamespace = (projectId: string, namespace: string) =>
  and(eq(translationKeys.projectId, projectId), eq(translationKeys.namespace, namespace));

export type SyncItem = {
  key: string;
  action: "added" | "updated" | "unchanged" | "pruned";
  oldValue?: string;
  newValue?: string;
};

export type SyncResult = {
  added: number;
  updated: number;
  unchanged: number;
  pruned: number;
  items: SyncItem[];
};

/** `entries` must come from `flattenJson`. */
export async function syncSourceKeys({
  projectId,
  namespace,
  entries,
  prune = false,
  dryRun = false,
}: {
  projectId: string;
  namespace: string;
  entries: Record<string, string>;
  prune?: boolean;
  dryRun?: boolean;
}): Promise<SyncResult> {
  return db.transaction(async (tx) => {
    if (!dryRun) await lockProject(tx, projectId);

    const existing = await tx
      .select({
        id: translationKeys.id,
        key: translationKeys.key,
        sourceValue: translationKeys.sourceValue,
        sourceHash: translationKeys.sourceHash,
      })
      .from(translationKeys)
      .where(inNamespace(projectId, namespace));
    const remaining = new Map(existing.map((row) => [row.key, row]));

    const items: SyncItem[] = [];
    const inserts: (typeof translationKeys.$inferInsert)[] = [];
    const updates: { id: string; sourceValue: string; sourceHash: string }[] = [];

    for (const [key, value] of Object.entries(entries)) {
      const sourceHash = computeSourceHash(value);
      const row = remaining.get(key);
      remaining.delete(key);
      if (!row) {
        inserts.push({ projectId, namespace, key, sourceValue: value, sourceHash });
        items.push({ key, action: "added", newValue: value });
      } else if (row.sourceHash !== sourceHash) {
        updates.push({ id: row.id, sourceValue: value, sourceHash });
        items.push({ key, action: "updated", oldValue: row.sourceValue, newValue: value });
      } else {
        items.push({ key, action: "unchanged", oldValue: row.sourceValue, newValue: value });
      }
    }

    const pruned = prune ? [...remaining.values()] : [];
    for (const row of pruned) items.push({ key: row.key, action: "pruned", oldValue: row.sourceValue });

    if (!dryRun) {
      for (const batch of chunks(inserts)) await tx.insert(translationKeys).values(batch);
      // shortcut: one UPDATE per changed key; batch via UPDATE … FROM if large re-pushes get slow.
      for (const { id, ...values } of updates) {
        await tx.update(translationKeys).set(values).where(eq(translationKeys.id, id));
      }
      for (const batch of chunks(updates.map((u) => u.id))) {
        await tx
          .update(translations)
          .set({ status: "outdated" })
          .where(and(inArray(translations.keyId, batch), eq(translations.status, "translated")));
      }
      for (const batch of chunks(pruned.map((p) => p.id))) {
        await tx.delete(translationKeys).where(inArray(translationKeys.id, batch));
      }
    }

    return {
      added: inserts.length,
      updated: updates.length,
      unchanged: items.length - inserts.length - updates.length - pruned.length,
      pruned: pruned.length,
      items,
    };
  });
}

export type ImportResult = {
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
  items: { key: string; action: "added" | "updated" | "unchanged" | "skipped" }[];
};

/**
 * Imports a target language file. Only existing keys are touched. `skipped` counts unknown keys
 * and empty values for non-empty sources, which must not overwrite or fake a translation.
 */
export async function importTargetTranslations({
  projectId,
  localeId,
  namespace,
  entries,
  dryRun = false,
}: {
  projectId: string;
  localeId: string;
  namespace: string;
  entries: Record<string, string>;
  dryRun?: boolean;
}): Promise<ImportResult> {
  return db.transaction(async (tx) => {
    if (!dryRun) await lockProject(tx, projectId);

    const [locale] = await tx
      .select({ id: projectLocales.id })
      .from(projectLocales)
      .where(and(eq(projectLocales.id, localeId), eq(projectLocales.projectId, projectId)));
    if (!locale) throw new Error("Locale does not belong to project");

    const rows = await tx
      .select({
        keyId: translationKeys.id,
        key: translationKeys.key,
        sourceValue: translationKeys.sourceValue,
        value: translations.value,
        status: translations.status,
      })
      .from(translationKeys)
      .leftJoin(
        translations,
        and(eq(translations.keyId, translationKeys.id), eq(translations.localeId, localeId)),
      )
      .where(inNamespace(projectId, namespace));
    const byKey = new Map(rows.map((row) => [row.key, row]));

    const result: ImportResult = { added: 0, updated: 0, unchanged: 0, skipped: 0, items: [] };
    const upserts: (typeof translations.$inferInsert)[] = [];

    for (const [key, value] of Object.entries(entries)) {
      const row = byKey.get(key);
      if (!row || (value === "" && row.sourceValue !== "")) {
        result.skipped++;
        result.items.push({ key, action: "skipped" });
        continue;
      }
      if (row.value === value && row.status === "translated") {
        result.unchanged++;
        result.items.push({ key, action: "unchanged" });
        continue;
      }
      const action = row.value === null ? "added" : "updated";
      result[action]++;
      result.items.push({ key, action });
      // updatedBy is cleared: the previous editor didn't write this value.
      upserts.push({ keyId: row.keyId, localeId, value, status: "translated", updatedBy: null });
    }

    for (const batch of dryRun ? [] : chunks(upserts)) {
      await tx
        .insert(translations)
        .values(batch)
        .onConflictDoUpdate({
          target: [translations.keyId, translations.localeId],
          set: { value: sql`excluded.value`, status: "translated", updatedBy: null },
        });
    }
    return result;
  });
}
