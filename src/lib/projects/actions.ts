"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { apiKeys, projectLocales, projects } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { generateApiKey } from "@/lib/api/auth";
import { requireAdmin, type TranslatorAccess, UUID_RE } from "@/lib/auth/session";
import { isValidLocaleCode, isValidSlug, resolveLocaleName } from "@/lib/i18n/locales";
import { replaceProjectAccess } from "./access";
import { findProjectById, revalidateProject } from "./lookup";

const PROJECT_NOT_FOUND = { ok: false, error: "Projekt nicht gefunden." } as const;
const INVALID_PROJECT_ID = { ok: false, error: "Ungültige Projekt-ID." } as const;
const INVALID_ID = { ok: false, error: "Ungültige ID." } as const;

export async function createProjectAction(input: {
  name: string;
  slug: string;
  description?: string;
  sourceLocale: string;
}): Promise<ActionResult<{ slug: string }>> {
  await requireAdmin();

  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  const description = input.description?.trim() || null;
  const sourceLocale = input.sourceLocale.trim();

  if (!name || name.length > 100) {
    return { ok: false, error: "Projektname muss zwischen 1 und 100 Zeichen lang sein." };
  }
  if (!isValidSlug(slug)) {
    return {
      ok: false,
      error: "Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.",
    };
  }
  if (description && description.length > 500) {
    return { ok: false, error: "Beschreibung darf maximal 500 Zeichen lang sein." };
  }
  if (!isValidLocaleCode(sourceLocale)) {
    return { ok: false, error: "Ungültiger Locale-Code (z. B. en, de, pt-BR)." };
  }

  try {
    await db.insert(projects).values({ name, slug, description, sourceLocale });
  } catch (e) {
    if (isUniqueViolation(e))
      return { ok: false, error: `Der Slug „${slug}“ ist bereits vergeben.` };
    throw e;
  }

  revalidatePath("/");
  return { ok: true, slug };
}

export async function addLocaleAction(input: {
  projectId: string;
  code: string;
  name?: string;
}): Promise<ActionResult<{ code: string }>> {
  await requireAdmin();

  if (!UUID_RE.test(input.projectId)) return INVALID_PROJECT_ID;

  const code = input.code.trim();
  if (!isValidLocaleCode(code)) {
    return { ok: false, error: "Ungültiger Locale-Code (z. B. de, fr, pt-BR)." };
  }

  const project = await findProjectById(input.projectId);
  if (!project) return PROJECT_NOT_FOUND;

  if (code.toLowerCase() === project.sourceLocale.toLowerCase()) {
    return { ok: false, error: `„${code}“ ist bereits die Ausgangssprache dieses Projekts.` };
  }

  try {
    await db
      .insert(projectLocales)
      .values({ projectId: project.id, code, name: resolveLocaleName(code, input.name) });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { ok: false, error: `Die Sprache „${code}“ existiert bereits im Projekt.` };
    }
    throw e;
  }

  revalidateProject(project.slug);
  return { ok: true, code };
}

export async function removeLocaleAction(input: {
  projectId: string;
  localeId: string;
}): Promise<ActionResult> {
  await requireAdmin();

  if (!UUID_RE.test(input.projectId) || !UUID_RE.test(input.localeId)) return INVALID_ID;

  const project = await findProjectById(input.projectId);
  if (!project) return PROJECT_NOT_FOUND;

  await db
    .delete(projectLocales)
    .where(
      and(eq(projectLocales.id, input.localeId), eq(projectLocales.projectId, input.projectId)),
    );

  revalidateProject(project.slug);
  return { ok: true };
}

export async function updateProjectAccessAction(input: {
  projectId: string;
  translatorAccess: TranslatorAccess;
  memberIds: string[];
}): Promise<ActionResult> {
  await requireAdmin();

  if (!UUID_RE.test(input.projectId)) return INVALID_PROJECT_ID;
  if (input.translatorAccess !== "all" && input.translatorAccess !== "selected") {
    return { ok: false, error: "Ungültiger Zugriffsmodus." };
  }

  const project = await findProjectById(input.projectId);
  if (!project) return PROJECT_NOT_FOUND;

  const memberIds = [...new Set(input.memberIds.filter((id) => UUID_RE.test(id)))];
  await replaceProjectAccess(project.id, input.translatorAccess, memberIds);

  revalidateProject(project.slug);
  return { ok: true };
}

export async function createApiKeyAction(input: {
  projectId: string;
  name: string;
}): Promise<ActionResult<{ key: string; keyPrefix: string; name: string }>> {
  await requireAdmin();

  if (!UUID_RE.test(input.projectId)) return INVALID_PROJECT_ID;

  const name = input.name.trim();
  if (!name || name.length > 80) {
    return { ok: false, error: "Bitte einen Namen (1–80 Zeichen) für den API-Key angeben." };
  }

  const project = await findProjectById(input.projectId);
  if (!project) return PROJECT_NOT_FOUND;

  const { key, keyPrefix, keyHash } = generateApiKey();
  await db.insert(apiKeys).values({ projectId: project.id, name, keyPrefix, keyHash });

  revalidatePath(`/projects/${project.slug}`);
  return { ok: true, key, keyPrefix, name };
}

export async function revokeApiKeyAction(input: {
  projectId: string;
  apiKeyId: string;
}): Promise<ActionResult> {
  await requireAdmin();

  if (!UUID_RE.test(input.projectId) || !UUID_RE.test(input.apiKeyId)) return INVALID_ID;

  const project = await findProjectById(input.projectId);
  if (!project) return PROJECT_NOT_FOUND;

  await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, input.apiKeyId), eq(apiKeys.projectId, input.projectId)));

  revalidatePath(`/projects/${project.slug}`);
  return { ok: true };
}

export async function deleteProjectAction(input: {
  projectId: string;
  confirmSlug: string;
}): Promise<ActionResult> {
  await requireAdmin();

  if (!UUID_RE.test(input.projectId)) return INVALID_PROJECT_ID;

  const project = await findProjectById(input.projectId);
  if (!project) return PROJECT_NOT_FOUND;

  if (input.confirmSlug.trim() !== project.slug) {
    return { ok: false, error: `Bitte gib exakt „${project.slug}“ zur Bestätigung ein.` };
  }

  await db.delete(projects).where(eq(projects.id, project.id));

  revalidatePath("/");
  redirect("/");
}
