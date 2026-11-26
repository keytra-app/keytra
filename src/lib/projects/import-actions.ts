"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { projectLocales, projects } from "@/db/schema";
import { isValidNamespace } from "@/lib/api/http";
import { requireAdmin, UUID_RE } from "@/lib/auth/session";
import { flattenJson, InvalidJsonError } from "@/lib/i18n/json";
import { importTargetTranslations, syncSourceKeys } from "@/lib/i18n/sync";
import type { ActionResult } from "./actions";

export type ImportInput = {
  projectId: string;
  /** null imports the source language. */
  localeId: string | null;
  namespace: string;
  json: string;
  /** Source import only: delete keys of the namespace that are missing in the file. */
  prune?: boolean;
};

export type ImportSummary = {
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
  pruned: number;
  keys: { added: string[]; updated: string[]; skipped: string[]; pruned: string[] };
};

async function runImport(input: ImportInput, dryRun: boolean): Promise<ActionResult<{ summary: ImportSummary }>> {
  await requireAdmin();

  const { projectId, localeId, json } = input;
  const namespace = String(input.namespace).trim();
  if (!UUID_RE.test(projectId)) return { ok: false, error: "Ungültige Projekt-ID." };
  if (localeId !== null && !UUID_RE.test(localeId)) return { ok: false, error: "Ungültige Sprache." };
  if (!isValidNamespace(namespace)) {
    return { ok: false, error: "Namespace muss zwischen 1 und 100 Zeichen lang sein." };
  }

  let entries: Record<string, string>;
  try {
    entries = flattenJson(JSON.parse(String(json).trim()));
  } catch (e) {
    if (e instanceof InvalidJsonError || e instanceof SyntaxError) {
      return { ok: false, error: `Ungültiges JSON: ${e.message}` };
    }
    throw e;
  }
  if (Object.keys(entries).length === 0) return { ok: false, error: "Die Datei enthält keine Keys." };

  const [project] = await db
    .select({ slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return { ok: false, error: "Projekt nicht gefunden." };

  let result;
  if (localeId === null) {
    // The preview always computes the prune candidates, so the UI can toggle without a new request.
    const prune = dryRun || input.prune === true;
    result = { skipped: 0, ...(await syncSourceKeys({ projectId, namespace, entries, prune, dryRun })) };
  } else {
    const [locale] = await db
      .select({ id: projectLocales.id })
      .from(projectLocales)
      .where(and(eq(projectLocales.id, localeId), eq(projectLocales.projectId, projectId)));
    if (!locale) return { ok: false, error: "Sprache nicht gefunden." };
    result = {
      pruned: 0,
      ...(await importTargetTranslations({ projectId, localeId, namespace, entries, dryRun })),
    };
  }

  if (!dryRun) {
    revalidatePath("/");
    revalidatePath(`/projects/${project.slug}`);
  }

  const keys: ImportSummary["keys"] = { added: [], updated: [], skipped: [], pruned: [] };
  for (const { key, action } of result.items) if (action !== "unchanged") keys[action].push(key);
  const { added, updated, unchanged, skipped, pruned } = result;
  return { ok: true, summary: { added, updated, unchanged, skipped, pruned, keys } };
}

export async function previewImportAction(input: ImportInput) {
  return runImport(input, true);
}

export async function confirmImportAction(input: ImportInput) {
  return runImport(input, false);
}
