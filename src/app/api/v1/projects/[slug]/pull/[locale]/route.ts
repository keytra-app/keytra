import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projectLocales } from "@/db/schema";
import { authenticateApiKey } from "@/lib/api/auth";
import { apiError, enumParam, namespaceParam, unauthorized } from "@/lib/api/http";
import { buildExportObject, getExportRows } from "@/lib/i18n/export";

export async function GET(request: Request, ctx: RouteContext<"/api/v1/projects/[slug]/pull/[locale]">) {
  const { slug, locale: code } = await ctx.params;
  const project = await authenticateApiKey(request, slug);
  if (!project) return unauthorized();

  const url = new URL(request.url);
  const namespace = namespaceParam(url);
  if (!namespace) return apiError(400, "Invalid namespace.");
  const format = enumParam(url, "format", ["nested", "flat"]);
  if (!format) return apiError(400, 'format must be "nested" or "flat".');
  const fallback = enumParam(url, "fallback", ["source", "empty"]);
  if (!fallback) return apiError(400, 'fallback must be "source" or "empty".');

  let localeId: string | null = null;
  if (code !== project.sourceLocale) {
    const locales = await db
      .select({ id: projectLocales.id, code: projectLocales.code })
      .from(projectLocales)
      .where(eq(projectLocales.projectId, project.id));
    const locale = locales.find((l) => l.code === code);
    if (!locale) return apiError(404, "Unknown locale.");
    localeId = locale.id;
  }

  const rows = await getExportRows(project.id, localeId, namespace);
  return Response.json(buildExportObject(rows, { format, fallback }));
}
