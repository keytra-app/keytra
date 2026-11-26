"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { projectLocales, projects, translationKeys, translations } from "@/db/schema";
import { requireAdmin, requireProjectAccess, UUID_RE } from "@/lib/auth/session";
import { computeSourceHash } from "@/lib/i18n/json";
import { lockProject } from "@/lib/i18n/sync";
import type { ActionResult } from "@/lib/projects/actions";

const MAX_KEY_LENGTH = 512;
const MAX_NAMESPACE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1000;

function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } } | null;
  return err?.code ?? err?.cause?.code;
}

export async function saveTranslationAction(input: {
  projectId: string;
  keyId: string;
  localeId: string;
  value: string;
  /** The source text the translator saw; a mismatch means the source changed meanwhile. */
  sourceValue: string;
}): Promise<ActionResult<{ updatedAt: string; updatedByName: string }>> {
  if (
    !UUID_RE.test(input.projectId) ||
    !UUID_RE.test(input.keyId) ||
    !UUID_RE.test(input.localeId)
  ) {
    return { ok: false, error: "Ungültige ID." };
  }

  const user = await requireProjectAccess(input.projectId);

  if (typeof input.value !== "string" || input.value.includes("\0")) {
    return { ok: false, error: "Ungültiger Übersetzungstext." };
  }
  if (typeof input.sourceValue !== "string") {
    return { ok: false, error: "Ungültiger Quelltext." };
  }

  const [[project], [localeRow]] = await Promise.all([
    db
      .select({ id: projects.id, slug: projects.slug, sourceLocale: projects.sourceLocale })
      .from(projects)
      .where(eq(projects.id, input.projectId))
      .limit(1),
    db
      .select({ id: projectLocales.id, code: projectLocales.code })
      .from(projectLocales)
      .where(and(eq(projectLocales.id, input.localeId), eq(projectLocales.projectId, input.projectId)))
      .limit(1),
  ]);

  if (!project) return { ok: false, error: "Projekt nicht gefunden." };
  if (!localeRow || localeRow.code === project.sourceLocale) {
    return { ok: false, error: "Zielsprache nicht gefunden." };
  }

  const now = new Date();
  const error = await db.transaction(async (tx) => {
    // FOR SHARE blocks a concurrent source change until this save commits, so its
    // "mark outdated" UPDATE sees this row; a change that committed first fails the check below.
    const [keyRow] = await tx
      .select({ id: translationKeys.id, sourceValue: translationKeys.sourceValue })
      .from(translationKeys)
      .where(and(eq(translationKeys.id, input.keyId), eq(translationKeys.projectId, input.projectId)))
      .for("share");

    if (!keyRow) return "Key nicht gefunden.";
    if (keyRow.sourceValue !== input.sourceValue) {
      return "Der Quelltext wurde inzwischen geändert. Bitte Seite neu laden.";
    }
    if (input.value.trim() === "" && keyRow.sourceValue.trim() !== "") {
      return "Übersetzung darf nicht leer sein.";
    }

    await tx
      .insert(translations)
      .values({
        keyId: keyRow.id,
        localeId: localeRow.id,
        value: input.value,
        status: "translated",
        updatedBy: user.id,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [translations.keyId, translations.localeId],
        set: {
          value: input.value,
          status: "translated",
          updatedBy: user.id,
          updatedAt: now,
        },
      });
    return null;
  });
  if (error) return { ok: false, error };

  revalidatePath("/");
  revalidatePath(`/projects/${project.slug}`);

  return {
    ok: true,
    updatedAt: now.toISOString(),
    updatedByName: user.name,
  };
}

export async function createKeyAction(input: {
  projectId: string;
  namespace?: string;
  key: string;
  sourceValue: string;
  description?: string;
}): Promise<
  ActionResult<{
    item: {
      id: string;
      namespace: string;
      key: string;
      description: string | null;
      sourceValue: string;
    };
  }>
> {
  await requireAdmin();

  if (!UUID_RE.test(input.projectId)) {
    return { ok: false, error: "Ungültige Projekt-ID." };
  }

  const namespace = (input.namespace ?? "").trim() || "default";
  const key = input.key.trim();
  const sourceValue = input.sourceValue;
  const description = input.description?.trim() || null;

  if (namespace.length > MAX_NAMESPACE_LENGTH || namespace.includes("\0")) {
    return { ok: false, error: `Namespace darf maximal ${MAX_NAMESPACE_LENGTH} Zeichen lang sein.` };
  }
  if (!key || key.length > MAX_KEY_LENGTH || key.includes("\0")) {
    return { ok: false, error: `Key muss zwischen 1 und ${MAX_KEY_LENGTH} Zeichen lang sein.` };
  }
  if (typeof sourceValue !== "string" || sourceValue.includes("\0")) {
    return { ok: false, error: "Ungültiger Quelltext." };
  }
  if (description && (description.length > MAX_DESCRIPTION_LENGTH || description.includes("\0"))) {
    return {
      ok: false,
      error: `Beschreibung darf maximal ${MAX_DESCRIPTION_LENGTH} Zeichen lang sein.`,
    };
  }

  const [project] = await db
    .select({ id: projects.id, slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);

  if (!project) return { ok: false, error: "Projekt nicht gefunden." };

  const sourceHash = computeSourceHash(sourceValue);

  try {
    const [created] = await db
      .insert(translationKeys)
      .values({
        projectId: project.id,
        namespace,
        key,
        sourceValue,
        sourceHash,
        description,
      })
      .returning({
        id: translationKeys.id,
        namespace: translationKeys.namespace,
        key: translationKeys.key,
        description: translationKeys.description,
        sourceValue: translationKeys.sourceValue,
      });

    revalidatePath("/");
    revalidatePath(`/projects/${project.slug}`);

    return { ok: true, item: created };
  } catch (e) {
    if (pgCode(e) === "23505") {
      return {
        ok: false,
        error: `Der Key „${key}“ existiert bereits im Namespace „${namespace}“.`,
      };
    }
    throw e;
  }
}

export async function updateKeyAction(input: {
  projectId: string;
  keyId: string;
  sourceValue?: string;
  description?: string | null;
}): Promise<
  ActionResult<{
    sourceChanged: boolean;
    sourceValue: string;
    description: string | null;
  }>
> {
  await requireAdmin();

  if (!UUID_RE.test(input.projectId) || !UUID_RE.test(input.keyId)) {
    return { ok: false, error: "Ungültige ID." };
  }

  if (input.sourceValue !== undefined) {
    if (typeof input.sourceValue !== "string" || input.sourceValue.includes("\0")) {
      return { ok: false, error: "Ungültiger Quelltext." };
    }
  }

  const nextDescriptionInput =
    input.description === undefined ? undefined : input.description?.trim() || null;

  if (
    nextDescriptionInput &&
    (nextDescriptionInput.length > MAX_DESCRIPTION_LENGTH || nextDescriptionInput.includes("\0"))
  ) {
    return {
      ok: false,
      error: `Beschreibung darf maximal ${MAX_DESCRIPTION_LENGTH} Zeichen lang sein.`,
    };
  }

  const [project] = await db
    .select({ id: projects.id, slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);

  if (!project) return { ok: false, error: "Projekt nicht gefunden." };

  const result = await db.transaction(async (tx) => {
    // Same lock as imports: a concurrent target import must not re-mark this key as translated.
    await lockProject(tx, project.id);
    const [existing] = await tx
      .select({
        id: translationKeys.id,
        sourceValue: translationKeys.sourceValue,
        sourceHash: translationKeys.sourceHash,
        description: translationKeys.description,
      })
      .from(translationKeys)
      .where(
        and(eq(translationKeys.id, input.keyId), eq(translationKeys.projectId, project.id)),
      )
      .limit(1);

    if (!existing) return null;

    const nextSourceValue = input.sourceValue ?? existing.sourceValue;
    const nextSourceHash =
      input.sourceValue !== undefined ? computeSourceHash(nextSourceValue) : existing.sourceHash;
    const sourceChanged = nextSourceHash !== existing.sourceHash;
    const nextDescription =
      nextDescriptionInput !== undefined ? nextDescriptionInput : existing.description;

    await tx
      .update(translationKeys)
      .set({
        sourceValue: nextSourceValue,
        sourceHash: nextSourceHash,
        description: nextDescription,
        updatedAt: new Date(),
      })
      .where(eq(translationKeys.id, existing.id));

    if (sourceChanged) {
      await tx
        .update(translations)
        .set({ status: "outdated" })
        .where(and(eq(translations.keyId, existing.id), eq(translations.status, "translated")));
    }

    return {
      sourceChanged,
      sourceValue: nextSourceValue,
      description: nextDescription,
    };
  });

  if (!result) return { ok: false, error: "Key nicht gefunden." };

  revalidatePath("/");
  revalidatePath(`/projects/${project.slug}`);

  return { ok: true, ...result };
}

export async function deleteKeyAction(input: {
  projectId: string;
  keyId: string;
}): Promise<ActionResult> {
  await requireAdmin();

  if (!UUID_RE.test(input.projectId) || !UUID_RE.test(input.keyId)) {
    return { ok: false, error: "Ungültige ID." };
  }

  const [project] = await db
    .select({ id: projects.id, slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);

  if (!project) return { ok: false, error: "Projekt nicht gefunden." };

  const deleted = await db
    .delete(translationKeys)
    .where(and(eq(translationKeys.id, input.keyId), eq(translationKeys.projectId, project.id)))
    .returning({ id: translationKeys.id });

  if (deleted.length === 0) {
    return { ok: false, error: "Key nicht gefunden." };
  }

  revalidatePath("/");
  revalidatePath(`/projects/${project.slug}`);

  return { ok: true };
}
