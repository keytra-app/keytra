"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectLocales } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { isValidNamespace } from "@/lib/api/http";
import { requireAdmin, UUID_RE } from "@/lib/auth/session";
import { flattenJson, InvalidJsonError } from "@/lib/i18n/json";
import { importTargetTranslations, syncSourceKeys } from "@/lib/i18n/sync";
import { findProjectById, revalidateProject } from "./lookup";

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

type ImportResult = Omit<ImportSummary, "keys"> & {
  items: { key: string; action: "added" | "updated" | "unchanged" | "skipped" | "pruned" }[];
};

function parseEntries(json: string): { entries: Record<string, string> } | { error: string } {
  try {
    return { entries: flattenJson(JSON.parse(json.trim())) };
  } catch (e) {
    if (e instanceof InvalidJsonError || e instanceof SyntaxError) {
      return { error: `Ungültiges JSON: ${e.message}` };
    }
    throw e;
  }
}

async function localeBelongsToProject(localeId: string, projectId: string) {
  const [locale] = await db
    .select({ id: projectLocales.id })
    .from(projectLocales)
    .where(and(eq(projectLocales.id, localeId), eq(projectLocales.projectId, projectId)));
  return Boolean(locale);
}

async function importSourceFile(
  input: { projectId: string; namespace: string; entries: Record<string, string>; prune: boolean },
  dryRun: boolean,
): Promise<ImportResult> {
  // The preview always computes the prune candidates, so the UI can toggle without a new request.
  const prune = dryRun || input.prune;
  return { skipped: 0, ...(await syncSourceKeys({ ...input, prune, dryRun })) };
}

function toSummary(result: ImportResult): ImportSummary {
  const keys: ImportSummary["keys"] = { added: [], updated: [], skipped: [], pruned: [] };
  for (const { key, action } of result.items) if (action !== "unchanged") keys[action].push(key);
  const { added, updated, unchanged, skipped, pruned } = result;
  return { added, updated, unchanged, skipped, pruned, keys };
}

async function runImport(
  input: ImportInput,
  dryRun: boolean,
): Promise<ActionResult<{ summary: ImportSummary }>> {
  await requireAdmin();

  const { projectId, localeId } = input;
  const namespace = String(input.namespace).trim();
  if (!UUID_RE.test(projectId)) return { ok: false, error: "Ungültige Projekt-ID." };
  if (localeId !== null && !UUID_RE.test(localeId)) {
    return { ok: false, error: "Ungültige Sprache." };
  }
  if (!isValidNamespace(namespace)) {
    return { ok: false, error: "Namespace muss zwischen 1 und 100 Zeichen lang sein." };
  }

  const parsed = parseEntries(String(input.json));
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const { entries } = parsed;
  if (Object.keys(entries).length === 0) {
    return { ok: false, error: "Die Datei enthält keine Keys." };
  }

  const project = await findProjectById(projectId);
  if (!project) return { ok: false, error: "Projekt nicht gefunden." };

  let result: ImportResult;
  if (localeId === null) {
    result = await importSourceFile(
      { projectId, namespace, entries, prune: input.prune === true },
      dryRun,
    );
  } else {
    if (!(await localeBelongsToProject(localeId, projectId))) {
      return { ok: false, error: "Sprache nicht gefunden." };
    }
    const imported = await importTargetTranslations({
      projectId,
      localeId,
      namespace,
      entries,
      dryRun,
    });
    result = { pruned: 0, ...imported };
  }

  if (!dryRun) revalidateProject(project.slug);
  return { ok: true, summary: toSummary(result) };
}

export async function previewImportAction(input: ImportInput) {
  return runImport(input, true);
}

export async function confirmImportAction(input: ImportInput) {
  return runImport(input, false);
}
