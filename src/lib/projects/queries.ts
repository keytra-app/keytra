import { count, desc, eq, inArray, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  apiKeys,
  projectLocales,
  projectMembers,
  projects,
  translationKeys,
  translations,
  users,
} from "@/db/schema";
import { type CurrentUser, requireAuth, requireProjectAccess } from "@/lib/auth/session";
import type { SourceKey } from "@/lib/editor/queries";
import { formatPercentage } from "@/lib/i18n/locales";

export type LocaleProgress = {
  id: string;
  code: string;
  name: string;
  total: number;
  translated: number;
  outdated: number;
  missing: number;
  percentage: number;
};

export type DashboardProject = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sourceLocale: string;
  translatorAccess: "all" | "selected";
  totalKeys: number;
  namespaces: string[];
  locales: LocaleProgress[];
};

export async function getAccessibleProjects(user: CurrentUser): Promise<DashboardProject[]> {
  let accessibleProjects;
  if (user.role === "admin") {
    accessibleProjects = await db.select().from(projects).orderBy(projects.name);
  } else {
    const memberships = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, user.id));
    const memberProjectIds = memberships.map((m) => m.projectId);

    accessibleProjects = await db
      .select()
      .from(projects)
      .where(
        memberProjectIds.length > 0
          ? or(eq(projects.translatorAccess, "all"), inArray(projects.id, memberProjectIds))
          : eq(projects.translatorAccess, "all"),
      )
      .orderBy(projects.name);
  }

  if (accessibleProjects.length === 0) return [];

  const projectIds = accessibleProjects.map((p) => p.id);

  const [keyCounts, allLocales, translationCounts] = await Promise.all([
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
    db
      .select({
        localeId: translations.localeId,
        status: translations.status,
        n: count(),
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translationKeys.id, translations.keyId))
      .where(inArray(translationKeys.projectId, projectIds))
      .groupBy(translations.localeId, translations.status),
  ]);

  const countsByLocale = new Map<string, { translated: number; outdated: number }>();
  for (const row of translationCounts) {
    const entry = countsByLocale.get(row.localeId) ?? { translated: 0, outdated: 0 };
    entry[row.status] = row.n;
    countsByLocale.set(row.localeId, entry);
  }

  return accessibleProjects.map((project) => {
    const namespaceCounts = keyCounts.filter((row) => row.projectId === project.id);
    const totalKeys = namespaceCounts.reduce((sum, row) => sum + row.total, 0);
    const locales: LocaleProgress[] = allLocales
      .filter((l) => l.projectId === project.id && l.code !== project.sourceLocale)
      .map((l) => {
        const stats = countsByLocale.get(l.id) ?? { translated: 0, outdated: 0 };
        const missing = Math.max(0, totalKeys - stats.translated - stats.outdated);
        return {
          id: l.id,
          code: l.code,
          name: l.name,
          total: totalKeys,
          translated: stats.translated,
          outdated: stats.outdated,
          missing,
          percentage: formatPercentage(stats.translated, totalKeys),
        };
      });

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

export type ProjectDetail = {
  project: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    sourceLocale: string;
    translatorAccess: "all" | "selected";
  };
  totalKeys: number;
  locales: LocaleProgress[];
  namespaces: string[];
  adminData: {
    translators: TranslatorOption[];
    memberIds: string[];
    apiKeys: ProjectApiKeyRow[];
    keys: SourceKey[];
    appUrl: string;
  } | null;
};

export async function getProjectDetailBySlug(slug: string): Promise<{
  user: CurrentUser;
  detail: ProjectDetail;
}> {
  // Auth first: otherwise 404 vs. login redirect reveals which slugs exist.
  await requireAuth();
  const [project] = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
  if (!project) notFound();

  const user = await requireProjectAccess(project.id);

  const [[{ total }], locales, statusCounts, namespaceRows] = await Promise.all([
    db.select({ total: count() }).from(translationKeys).where(eq(translationKeys.projectId, project.id)),
    db
      .select({ id: projectLocales.id, code: projectLocales.code, name: projectLocales.name })
      .from(projectLocales)
      .where(eq(projectLocales.projectId, project.id))
      .orderBy(projectLocales.code),
    db
      .select({ localeId: translations.localeId, status: translations.status, n: count() })
      .from(translations)
      .innerJoin(translationKeys, eq(translationKeys.id, translations.keyId))
      .where(eq(translationKeys.projectId, project.id))
      .groupBy(translations.localeId, translations.status),
    db
      .selectDistinct({ namespace: translationKeys.namespace })
      .from(translationKeys)
      .where(eq(translationKeys.projectId, project.id))
      .orderBy(translationKeys.namespace),
  ]);

  const localeMetrics: LocaleProgress[] = locales
    .filter((l) => l.code !== project.sourceLocale)
    .map((l) => {
      const translated = statusCounts.find((c) => c.localeId === l.id && c.status === "translated")?.n ?? 0;
      const outdated = statusCounts.find((c) => c.localeId === l.id && c.status === "outdated")?.n ?? 0;
      return {
        id: l.id,
        code: l.code,
        name: l.name,
        total,
        translated,
        outdated,
        missing: Math.max(0, total - translated - outdated),
        percentage: formatPercentage(translated, total),
      };
    });

  let adminData: ProjectDetail["adminData"] = null;
  if (user.role === "admin") {
    const [translators, members, keys, sourceKeys] = await Promise.all([
      db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.role, "translator"))
        .orderBy(users.name),
      db
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, project.id)),
      db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          lastUsedAt: apiKeys.lastUsedAt,
          createdAt: apiKeys.createdAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.projectId, project.id))
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
        .where(eq(translationKeys.projectId, project.id))
        .orderBy(translationKeys.namespace, translationKeys.key),
    ]);

    adminData = {
      translators,
      memberIds: members.map((m) => m.userId),
      apiKeys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
        createdAt: k.createdAt.toISOString(),
      })),
      keys: sourceKeys,
      appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
    };
  }

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
      totalKeys: total,
      locales: localeMetrics,
      namespaces: namespaceRows.map((r) => r.namespace),
      adminData,
    },
  };
}
