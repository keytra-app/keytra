import { eq } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import { db } from "@/db";
import { projectLocales, projects, translationKeys } from "@/db/schema";
import { apiError, enumParam, namespaceParam } from "@/lib/api/http";
import { canAccessProject, getCurrentUser } from "@/lib/auth/session";
import { buildExportObject, getExportRows, type ExportOptions } from "@/lib/i18n/export";

const toJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

// Namespaces are free text; a slash must not create folders (or "../" entries) inside the ZIP.
const zipName = (namespace: string) => namespace.replace(/[%/\\\x00-\x1f]/g, encodeURIComponent);

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
  if (!project || !(await canAccessProject(user, project))) return apiError(404, "Unknown project.");

  const url = new URL(request.url);
  const all = enumParam(url, "all", ["false", "true"]);
  if (!all) return apiError(400, 'all must be "true" or "false".');
  const format = enumParam(url, "format", ["nested", "flat"]);
  if (!format) return apiError(400, 'format must be "nested" or "flat".');
  const fallback = enumParam(url, "fallback", ["source", "empty"]);
  if (!fallback) return apiError(400, 'fallback must be "source" or "empty".');
  const options: ExportOptions = { format, fallback };

  const targets = await db
    .select({ id: projectLocales.id, code: projectLocales.code })
    .from(projectLocales)
    .where(eq(projectLocales.projectId, project.id))
    .orderBy(projectLocales.code);
  const locales = [
    { id: null, code: project.sourceLocale },
    ...targets.filter((l) => l.code !== project.sourceLocale),
  ];

  if (all === "false") {
    const code = url.searchParams.get("locale");
    const locale = locales.find((l) => l.code === code);
    if (!locale) return apiError(404, "Unknown locale.");
    const namespace = namespaceParam(url);
    if (!namespace) return apiError(400, "Invalid namespace.");

    const rows = await getExportRows(project.id, locale.id, namespace);
    return download(
      toJson(buildExportObject(rows, options)),
      `${project.slug}-${locale.code}-${namespace}.json`,
      "application/json; charset=utf-8",
    );
  }

  const found = await db
    .selectDistinct({ namespace: translationKeys.namespace })
    .from(translationKeys)
    .where(eq(translationKeys.projectId, project.id));
  const namespaces = found.length ? found.map((n) => n.namespace) : ["default"];

  // shortcut: ZIP is built in memory; switch to fflate's streaming Zip for very large projects.
  const files: Record<string, Uint8Array> = {};
  for (const locale of locales) {
    const byNamespace = Map.groupBy(await getExportRows(project.id, locale.id), (r) => r.namespace);
    for (const namespace of namespaces) {
      const rows = byNamespace.get(namespace) ?? [];
      files[`${locale.code}/${zipName(namespace)}.json`] = strToU8(toJson(buildExportObject(rows, options)));
    }
  }
  return download(new Uint8Array(zipSync(files)), `${project.slug}-translations.zip`, "application/zip");
}
