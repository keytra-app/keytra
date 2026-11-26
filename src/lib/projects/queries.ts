import { asc, count, desc, eq, inArray, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  apiKeys,
  projectLocales,
  projectMembers,
  projects,
  translationKeys,
  users,
} from "@/db/schema";
import { getAppUrl } from "@/lib/app-url";
import {
  type CurrentUser,
  requireAuth,
  requireProjectAccess,
  type TranslatorAccess,
} from "@/lib/auth/session";
import type { SourceKey } from "@/lib/editor/queries";
import {
  countTranslationsByLocale,
  getProjectProgress,
  type LocaleProgress,
  toLocaleProgress,
} from "./progress";

export type DashboardProject = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sourceLocale: string;
  translatorAccess: TranslatorAccess;
  totalKeys: number;
  namespaces: string[];
  locales: LocaleProgress[];
};

export type ProjectApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export type TranslatorOption = {
  id: string;
  name: string;
  email: string;
};

type ProjectAdminData = {
  translators: TranslatorOption[];
  memberIds: string[];
  apiKeys: ProjectApiKeyRow[];
  keys: SourceKey[];
  appUrl: string;
};

export type ProjectDetail = {
  project: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    sourceLocale: string;
    translatorAccess: TranslatorAccess;
  };
  totalKeys: number;
  locales: LocaleProgress[];
  namespaces: string[];
  adminData: ProjectAdminData | null;
};

async function listAccessibleProjects(user: CurrentUser) {
  if (user.role === "admin") {
    return db.select().from(projects).orderBy(projects.name);
  }

  const memberships = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, user.id));
  const memberProjectIds = memberships.map((m) => m.projectId);
  const openToAll = eq(projects.translatorAccess, "all");

  return db
    .select()
    .from(projects)
    .where(
      memberProjectIds.length > 0
        ? or(openToAll, inArray(projects.id, memberProjectIds))
        : openToAll,
    )
    .orderBy(projects.name);
}

export async function getAccessibleProjects(user: CurrentUser): Promise<DashboardProject[]> {
  const accessibleProjects = await listAccessibleProjects(user);
  if (accessibleProjects.length === 0) return [];

  const projectIds = accessibleProjects.map((p) => p.id);
  const [keyCounts, allLocales, countsByLocale] = await Promise.all([
    db
      .select({
        projectId: translationKeys.projectId,
        namespace: translationKeys.namespace,
        total: count(),
      })
      .from(translationKeys)
      .where(inArray(translationKeys.projectId, projectIds))
      .groupBy(translationKeys.projectId, translationKeys.namespace)
      .orderBy(translationKeys.namespace),
    db
      .select({
        id: projectLocales.id,
        projectId: projectLocales.projectId,
        code: projectLocales.code,
        name: projectLocales.name,
      })
      .from(projectLocales)
      .where(inArray(projectLocales.projectId, projectIds))
      .orderBy(projectLocales.code),
    countTranslationsByLocale(projectIds),
  ]);

  return accessibleProjects.map((project) => {
    const namespaceCounts = keyCounts.filter((row) => row.projectId === project.id);
    const totalKeys = namespaceCounts.reduce((sum, row) => sum + row.total, 0);
    const locales = allLocales
      .filter((l) => l.projectId === project.id && l.code !== project.sourceLocale)
      .map((l) => toLocaleProgress(l, totalKeys, countsByLocale.get(l.id)));

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      sourceLocale: project.sourceLocale,
      translatorAccess: project.translatorAccess,
      totalKeys,
      namespaces: namespaceCounts.map((row) => row.namespace),
      locales,
    };
  });
}

async function getProjectAdminData(projectId: string): Promise<ProjectAdminData> {
  const [translators, members, keys, sourceKeys] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.role, "translator"))
      .orderBy(users.name),
    db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId)),
    db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.projectId, projectId))
      .orderBy(desc(apiKeys.createdAt)),
    db
      .select({
        id: translationKeys.id,
        namespace: translationKeys.namespace,
        key: translationKeys.key,
        description: translationKeys.description,
        sourceValue: translationKeys.sourceValue,
      })
      .from(translationKeys)
      .where(eq(translationKeys.projectId, projectId))
      .orderBy(translationKeys.namespace, translationKeys.key),
  ]);

  return {
    translators,
    memberIds: members.map((m) => m.userId),
    apiKeys: keys.map((k) => ({
      ...k,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
    keys: sourceKeys,
    appUrl: getAppUrl(),
  };
}

export async function getProjectDetailBySlug(
  slug: string,
): Promise<{ user: CurrentUser; detail: ProjectDetail }> {
  // Auth first: otherwise 404 vs. login redirect reveals which slugs exist.
  await requireAuth();
  const [project] = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
  if (!project) notFound();

  const user = await requireProjectAccess(project.id);

  const [progress, namespaceRows, adminData] = await Promise.all([
    getProjectProgress(project),
    db
      .selectDistinct({ namespace: translationKeys.namespace })
      .from(translationKeys)
      .where(eq(translationKeys.projectId, project.id))
      .orderBy(asc(translationKeys.namespace)),
    user.role === "admin" ? getProjectAdminData(project.id) : null,
  ]);

  return {
    user,
    detail: {
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        description: project.description,
        sourceLocale: project.sourceLocale,
        translatorAccess: project.translatorAccess,
      },
      totalKeys: progress.totalKeys,
      locales: progress.locales,
      namespaces: namespaceRows.map((r) => r.namespace),
      adminData,
    },
  };
}
