"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { apiKeys, projectLocales, projectMembers, projects, users } from "@/db/schema";
import { generateApiKey } from "@/lib/api/auth";
import { requireAdmin, UUID_RE } from "@/lib/auth/session";
import { isValidLocaleCode, isValidSlug, resolveLocaleName } from "@/lib/i18n/locales";

function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } } | null;
  return err?.code ?? err?.cause?.code;
}

export type ActionResult<T = void> = T extends void
  ? { ok: true } | { ok: false; error: string }
  : ({ ok: true } & T) | { ok: false; error: string };

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
    return { ok: false, error: "Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten." };
  }
  if (description && description.length > 500) {
    return { ok: false, error: "Beschreibung darf maximal 500 Zeichen lang sein." };
  }
  if (!isValidLocaleCode(sourceLocale)) {
    return { ok: false, error: "Ungültiger Locale-Code (z. B. en, de, pt-BR)." };
  }

  try {
    await db.insert(projects).values({
      name,
      slug,
      description,
      sourceLocale,
    });
  } catch (e) {
    if (pgCode(e) === "23505") {
      return { ok: false, error: `Der Slug „${slug}“ ist bereits vergeben.` };
    }
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

  if (!UUID_RE.test(input.projectId)) {
    return { ok: false, error: "Ungültige Projekt-ID." };
  }

  const code = input.code.trim();
  if (!isValidLocaleCode(code)) {
    return { ok: false, error: "Ungültiger Locale-Code (z. B. de, fr, pt-BR)." };
  }

  const [project] = await db
    .select({ id: projects.id, slug: projects.slug, sourceLocale: projects.sourceLocale })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);

  if (!project) {
    return { ok: false, error: "Projekt nicht gefunden." };
  }

  if (code.toLowerCase() === project.sourceLocale.toLowerCase()) {
    return { ok: false, error: `„${code}“ ist bereits die Ausgangssprache dieses Projekts.` };
  }

  const name = resolveLocaleName(code, input.name);

  try {
    await db.insert(projectLocales).values({
      projectId: project.id,
      code,
      name,
    });
  } catch (e) {
    if (pgCode(e) === "23505") {
      return { ok: false, error: `Die Sprache „${code}“ existiert bereits im Projekt.` };
    }
    throw e;
  }

  revalidatePath("/");
  revalidatePath(`/projects/${project.slug}`);
  return { ok: true, code };
}

export async function removeLocaleAction(input: {
  projectId: string;
  localeId: string;
}): Promise<ActionResult> {
  await requireAdmin();

  if (!UUID_RE.test(input.projectId) || !UUID_RE.test(input.localeId)) {
    return { ok: false, error: "Ungültige ID." };
  }

  const [project] = await db
    .select({ slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);

  if (!project) {
    return { ok: false, error: "Projekt nicht gefunden." };
  }

  await db
    .delete(projectLocales)
    .where(and(eq(projectLocales.id, input.localeId), eq(projectLocales.projectId, input.projectId)));

  revalidatePath("/");
  revalidatePath(`/projects/${project.slug}`);
  return { ok: true };
}

export async function updateProjectAccessAction(input: {
  projectId: string;
  translatorAccess: "all" | "selected";
  memberIds: string[];
}): Promise<ActionResult> {
  await requireAdmin();

  if (!UUID_RE.test(input.projectId)) {
    return { ok: false, error: "Ungültige Projekt-ID." };
  }
  if (input.translatorAccess !== "all" && input.translatorAccess !== "selected") {
    return { ok: false, error: "Ungültiger Zugriffsmodus." };
  }

  const cleanIds = [...new Set(input.memberIds.filter((id) => UUID_RE.test(id)))];

  const [project] = await db
    .select({ id: projects.id, slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);

  if (!project) {
    return { ok: false, error: "Projekt nicht gefunden." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(projects)
      .set({ translatorAccess: input.translatorAccess })
      .where(eq(projects.id, project.id));

    await tx.delete(projectMembers).where(eq(projectMembers.projectId, project.id));

    if (cleanIds.length > 0) {
      const validTranslators = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "translator"), inArray(users.id, cleanIds)));

      if (validTranslators.length > 0) {
        await tx.insert(projectMembers).values(
          validTranslators.map((u) => ({
            projectId: project.id,
            userId: u.id,
          })),
        );
      }
    }
  });

  revalidatePath("/");
  revalidatePath(`/projects/${project.slug}`);
  return { ok: true };
}

export async function createApiKeyAction(input: {
  projectId: string;
  name: string;
}): Promise<ActionResult<{ key: string; keyPrefix: string; name: string }>> {
  await requireAdmin();

  if (!UUID_RE.test(input.projectId)) {
    return { ok: false, error: "Ungültige Projekt-ID." };
  }

  const name = input.name.trim();
  if (!name || name.length > 80) {
    return { ok: false, error: "Bitte einen Namen (1–80 Zeichen) für den API-Key angeben." };
  }

  const [project] = await db
    .select({ id: projects.id, slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);

  if (!project) {
    return { ok: false, error: "Projekt nicht gefunden." };
  }

  const { key, keyPrefix, keyHash } = generateApiKey();
  await db.insert(apiKeys).values({
    projectId: project.id,
    name,
    keyPrefix,
    keyHash,
  });

  revalidatePath(`/projects/${project.slug}`);
  return { ok: true, key, keyPrefix, name };
}

export async function revokeApiKeyAction(input: {
  projectId: string;
  apiKeyId: string;
}): Promise<ActionResult> {
  await requireAdmin();

  if (!UUID_RE.test(input.projectId) || !UUID_RE.test(input.apiKeyId)) {
    return { ok: false, error: "Ungültige ID." };
  }

  const [project] = await db
    .select({ slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);

  if (!project) {
    return { ok: false, error: "Projekt nicht gefunden." };
  }

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

  if (!UUID_RE.test(input.projectId)) {
    return { ok: false, error: "Ungültige Projekt-ID." };
  }

  const [project] = await db
    .select({ id: projects.id, slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);

  if (!project) {
    return { ok: false, error: "Projekt nicht gefunden." };
  }

  if (input.confirmSlug.trim() !== project.slug) {
    return { ok: false, error: `Bitte gib exakt „${project.slug}“ zur Bestätigung ein.` };
  }

  await db.delete(projects).where(eq(projects.id, project.id));

  revalidatePath("/");
  redirect("/");
}
