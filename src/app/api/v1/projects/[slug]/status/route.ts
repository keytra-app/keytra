import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectLocales, translationKeys, translations } from "@/db/schema";
import { authenticateApiKey } from "@/lib/api/auth";
import { unauthorized } from "@/lib/api/http";

export async function GET(request: Request, ctx: RouteContext<"/api/v1/projects/[slug]/status">) {
  const project = await authenticateApiKey(request, (await ctx.params).slug);
  if (!project) return unauthorized();

  const [[{ total }], locales, counts] = await Promise.all([
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
  ]);

  return Response.json({
    slug: project.slug,
    sourceLocale: project.sourceLocale,
    totalKeys: total,
    locales: locales
      .filter((l) => l.code !== project.sourceLocale)
      .map(({ id, code, name }) => {
        const countOf = (status: "translated" | "outdated") =>
          counts.find((c) => c.localeId === id && c.status === status)?.n ?? 0;
        const translated = countOf("translated");
        const outdated = countOf("outdated");
        return {
          code,
          name,
          total,
          translated,
          outdated,
          missing: total - translated - outdated,
          // Floored to one decimal, so 100 really means complete.
          percentage: total ? Math.floor((translated / total) * 1000) / 10 : 0,
        };
      }),
  });
}
