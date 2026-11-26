import { authenticateApiKey } from "@/lib/api/auth";
import { apiError, enumParam, namespaceParam, unauthorized } from "@/lib/api/http";
import { buildExportObject, findExportLocale, getExportRows } from "@/lib/i18n/export";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/projects/[slug]/pull/[locale]">,
) {
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

  const locale = await findExportLocale(project, code);
  if (!locale) return apiError(404, "Unknown locale.");

  const rows = await getExportRows(project.id, locale.id, namespace);
  return Response.json(buildExportObject(rows, { format, fallback }));
}
