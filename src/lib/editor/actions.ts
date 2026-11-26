"use server";

import type { ActionResult } from "@/lib/action-result";
import { requireAdmin, requireProjectAccess, UUID_RE } from "@/lib/auth/session";
import { findProjectById, revalidateProject } from "@/lib/projects/lookup";
import { deleteKey, insertKey, saveTranslation, updateKey } from "./keys";
import type { SourceKey } from "./queries";

const MAX_KEY_LENGTH = 512;
const MAX_NAMESPACE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1000;

const INVALID_ID = { ok: false, error: "Ungültige ID." } as const;
const INVALID_SOURCE = { ok: false, error: "Ungültiger Quelltext." } as const;
const PROJECT_NOT_FOUND = { ok: false, error: "Projekt nicht gefunden." } as const;
const KEY_NOT_FOUND = { ok: false, error: "Key nicht gefunden." } as const;
const DESCRIPTION_TOO_LONG = {
  ok: false,
  error: `Beschreibung darf maximal ${MAX_DESCRIPTION_LENGTH} Zeichen lang sein.`,
} as const;

// Server Action inputs are untrusted at runtime, whatever their static type says.
const isStorableText = (value: unknown): value is string =>
  typeof value === "string" && !value.includes("\0");

const isValidDescription = (description: string | null) =>
  !description || (description.length <= MAX_DESCRIPTION_LENGTH && isStorableText(description));

export async function saveTranslationAction(input: {
  projectId: string;
  keyId: string;
  localeId: string;
  value: string;
  /** The source text the translator saw; a mismatch means the source changed meanwhile. */
  sourceValue: string;
}): Promise<ActionResult<{ updatedAt: string; updatedByName: string }>> {
  if (![input.projectId, input.keyId, input.localeId].every((id) => UUID_RE.test(id))) {
    return INVALID_ID;
  }

  const user = await requireProjectAccess(input.projectId);

  if (!isStorableText(input.value)) return { ok: false, error: "Ungültiger Übersetzungstext." };
  if (typeof input.sourceValue !== "string") return INVALID_SOURCE;

  const result = await saveTranslation({ ...input, userId: user.id });
  if (!result.ok) return result;

  revalidateProject(result.projectSlug);
  return { ok: true, updatedAt: result.updatedAt.toISOString(), updatedByName: user.name };
}

export async function createKeyAction(input: {
  projectId: string;
  namespace?: string;
  key: string;
  sourceValue: string;
  description?: string;
}): Promise<ActionResult<{ item: SourceKey }>> {
  await requireAdmin();

  if (!UUID_RE.test(input.projectId)) return { ok: false, error: "Ungültige Projekt-ID." };

  const namespace = (input.namespace ?? "").trim() || "default";
  const key = input.key.trim();
  const description = input.description?.trim() || null;

  if (namespace.length > MAX_NAMESPACE_LENGTH || namespace.includes("\0")) {
    return {
      ok: false,
      error: `Namespace darf maximal ${MAX_NAMESPACE_LENGTH} Zeichen lang sein.`,
    };
  }
  if (!key || key.length > MAX_KEY_LENGTH || key.includes("\0")) {
    return { ok: false, error: `Key muss zwischen 1 und ${MAX_KEY_LENGTH} Zeichen lang sein.` };
  }
  if (!isStorableText(input.sourceValue)) return INVALID_SOURCE;
  if (!isValidDescription(description)) return DESCRIPTION_TOO_LONG;

  const project = await findProjectById(input.projectId);
  if (!project) return PROJECT_NOT_FOUND;

  const item = await insertKey({
    projectId: project.id,
    namespace,
    key,
    sourceValue: input.sourceValue,
    description,
  });
  if (!item) {
    return { ok: false, error: `Der Key „${key}“ existiert bereits im Namespace „${namespace}“.` };
  }

  revalidateProject(project.slug);
  return { ok: true, item };
}

export async function updateKeyAction(input: {
  projectId: string;
  keyId: string;
  sourceValue?: string;
  description?: string | null;
}): Promise<
  ActionResult<{ sourceChanged: boolean; sourceValue: string; description: string | null }>
> {
  await requireAdmin();

  if (!UUID_RE.test(input.projectId) || !UUID_RE.test(input.keyId)) return INVALID_ID;
  if (input.sourceValue !== undefined && !isStorableText(input.sourceValue)) {
    return INVALID_SOURCE;
  }

  const description =
    input.description === undefined ? undefined : input.description?.trim() || null;
  if (description !== undefined && !isValidDescription(description)) return DESCRIPTION_TOO_LONG;

  const project = await findProjectById(input.projectId);
  if (!project) return PROJECT_NOT_FOUND;

  const result = await updateKey(project.id, input.keyId, {
    sourceValue: input.sourceValue,
    description,
  });
  if (!result) return KEY_NOT_FOUND;

  revalidateProject(project.slug);
  return { ok: true, ...result };
}

export async function deleteKeyAction(input: {
  projectId: string;
  keyId: string;
}): Promise<ActionResult> {
  await requireAdmin();

  if (!UUID_RE.test(input.projectId) || !UUID_RE.test(input.keyId)) return INVALID_ID;

  const project = await findProjectById(input.projectId);
  if (!project) return PROJECT_NOT_FOUND;

  if (!(await deleteKey(project.id, input.keyId))) return KEY_NOT_FOUND;

  revalidateProject(project.slug);
  return { ok: true };
}
