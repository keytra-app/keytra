import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { apiError, enumParam, namespaceParam } from "@/lib/api/http";
import { canAccessProject, getCurrentUser } from "@/lib/auth/session";
import {
  buildExportArchive,
  buildExportObject,
  findExportLocale,
  getExportRows,
  toJsonFile,
} from "@/lib/i18n/export";

function download(body: BodyInit, filename: string, contentType: string) {
  const ascii = filename.replace(/[^\w.-]/g, "_");
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename.toWellFormed())}`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: Request, ctx: RouteContext<"/api/projects/[slug]/export">) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "Not signed in.");

  const { slug } = await ctx.params;
  const [project] = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
  // Unknown and forbidden projects look the same.
  if (!project || !(await canAccessProject(user, project))) {
    return apiError(404, "Unknown project.");
  }

  const url = new URL(request.url);
  const all = enumParam(url, "all", ["false", "true"]);
  if (!all) return apiError(400, 'all must be "true" or "false".');
  const format = enumParam(url, "format", ["nested", "flat"]);
  if (!format) return apiError(400, 'format must be "nested" or "flat".');
  const fallback = enumParam(url, "fallback", ["source", "empty"]);
  if (!fallback) return apiError(400, 'fallback must be "source" or "empty".');
  const options = { format, fallback };

  if (all === "true") {
    return download(
      await buildExportArchive(project, options),
      `${project.slug}-translations.zip`,
      "application/zip",
    );
  }

  const locale = await findExportLocale(project, url.searchParams.get("locale"));
  if (!locale) return apiError(404, "Unknown locale.");
  const namespace = namespaceParam(url);
  if (!namespace) return apiError(400, "Invalid namespace.");

  const rows = await getExportRows(project.id, locale.id, namespace);
  return download(
    toJsonFile(buildExportObject(rows, options)),
    `${project.slug}-${locale.code}-${namespace}.json`,
    "application/json; charset=utf-8",
  );
}
