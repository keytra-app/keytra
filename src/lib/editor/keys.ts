import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { projectLocales, projects, translationKeys, translations } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { computeSourceHash } from "@/lib/i18n/json";
import { lockProject } from "@/lib/i18n/sync";
import type { SourceKey } from "./queries";

const sourceKeyColumns = {
  id: translationKeys.id,
  namespace: translationKeys.namespace,
  key: translationKeys.key,
  description: translationKeys.description,
  sourceValue: translationKeys.sourceValue,
};

const keyInProject = (projectId: string, keyId: string) =>
  and(eq(translationKeys.id, keyId), eq(translationKeys.projectId, projectId));

/** The project and one of its target (non-source) locales. */
async function findTarget(projectId: string, localeId: string) {
  const [[project], [locale]] = await Promise.all([
    db
      .select({ slug: projects.slug, sourceLocale: projects.sourceLocale })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1),
    db
      .select({ id: projectLocales.id, code: projectLocales.code })
      .from(projectLocales)
      .where(and(eq(projectLocales.id, localeId), eq(projectLocales.projectId, projectId)))
      .limit(1),
  ]);

  if (!project) return { ok: false, error: "Projekt nicht gefunden." } as const;
  if (!locale || locale.code === project.sourceLocale) {
    return { ok: false, error: "Zielsprache nicht gefunden." } as const;
  }
  return { ok: true, project, locale } as const;
}

export async function saveTranslation(input: {
  projectId: string;
  keyId: string;
  localeId: string;
  userId: string;
  value: string;
  sourceValue: string;
}): Promise<ActionResult<{ projectSlug: string; updatedAt: Date }>> {
  const target = await findTarget(input.projectId, input.localeId);
  if (!target.ok) return target;
  const { project, locale } = target;

  const now = new Date();
  const error = await db.transaction(async (tx) => {
    // FOR SHARE blocks a concurrent source change until this save commits, so its
    // "mark outdated" UPDATE sees this row; a change that committed first fails the check below.
    const [keyRow] = await tx
      .select({ id: translationKeys.id, sourceValue: translationKeys.sourceValue })
      .from(translationKeys)
      .where(keyInProject(input.projectId, input.keyId))
      .for("share");

    if (!keyRow) return "Key nicht gefunden.";
    if (keyRow.sourceValue !== input.sourceValue) {
      return "Der Quelltext wurde inzwischen geändert. Bitte Seite neu laden.";
    }
    if (input.value.trim() === "" && keyRow.sourceValue.trim() !== "") {
      return "Übersetzung darf nicht leer sein.";
    }

    const values = {
      value: input.value,
      status: "translated" as const,
      updatedBy: input.userId,
      updatedAt: now,
    };
    await tx
      .insert(translations)
      .values({ keyId: keyRow.id, localeId: locale.id, ...values })
      .onConflictDoUpdate({ target: [translations.keyId, translations.localeId], set: values });
    return null;
  });

  if (error) return { ok: false, error };
  return { ok: true, projectSlug: project.slug, updatedAt: now };
}

/** Returns null if the key already exists in the namespace. */
export async function insertKey(input: {
  projectId: string;
  namespace: string;
  key: string;
  sourceValue: string;
  description: string | null;
}): Promise<SourceKey | null> {
  try {
    const [created] = await db
      .insert(translationKeys)
      .values({ ...input, sourceHash: computeSourceHash(input.sourceValue) })
      .returning(sourceKeyColumns);
    return created;
  } catch (e) {
    if (isUniqueViolation(e)) return null;
    throw e;
  }
}

/**
 * Applies the given changes; omitted fields keep their value. A changed source marks all
 * translations of the key as outdated. Returns null if the key doesn't exist.
 */
export async function updateKey(
  projectId: string,
  keyId: string,
  changes: { sourceValue?: string; description?: string | null },
) {
  return db.transaction(async (tx) => {
    // Same lock as imports: a concurrent target import must not re-mark this key as translated.
    await lockProject(tx, projectId);
    const [existing] = await tx
      .select({
        id: translationKeys.id,
        sourceValue: translationKeys.sourceValue,
        sourceHash: translationKeys.sourceHash,
        description: translationKeys.description,
      })
      .from(translationKeys)
      .where(keyInProject(projectId, keyId))
      .limit(1);
    if (!existing) return null;

    const sourceValue = changes.sourceValue ?? existing.sourceValue;
    const sourceHash =
      changes.sourceValue === undefined ? existing.sourceHash : computeSourceHash(sourceValue);
    const description =
      changes.description === undefined ? existing.description : changes.description;
    const sourceChanged = sourceHash !== existing.sourceHash;

    await tx
      .update(translationKeys)
      .set({ sourceValue, sourceHash, description, updatedAt: new Date() })
      .where(eq(translationKeys.id, existing.id));

    if (sourceChanged) {
      await tx
        .update(translations)
        .set({ status: "outdated" })
        .where(and(eq(translations.keyId, existing.id), eq(translations.status, "translated")));
    }

    return { sourceChanged, sourceValue, description };
  });
}

/** Returns false if the key doesn't exist. */
export async function deleteKey(projectId: string, keyId: string): Promise<boolean> {
  const deleted = await db
    .delete(translationKeys)
    .where(keyInProject(projectId, keyId))
    .returning({ id: translationKeys.id });
  return deleted.length > 0;
}
