import { authenticateApiKey } from "@/lib/api/auth";
import { apiError, enumParam, namespaceParam, unauthorized } from "@/lib/api/http";
import { flattenJson, InvalidJsonError } from "@/lib/i18n/json";
import { syncSourceKeys } from "@/lib/i18n/sync";

export async function POST(request: Request, ctx: RouteContext<"/api/v1/projects/[slug]/push">) {
  const project = await authenticateApiKey(request, (await ctx.params).slug);
  if (!project) return unauthorized();

  const url = new URL(request.url);
  const namespace = namespaceParam(url);
  if (!namespace) return apiError(400, "Invalid namespace.");
  const prune = enumParam(url, "prune", ["false", "true"]);
  if (!prune) return apiError(400, 'prune must be "true" or "false".');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Body must be valid JSON.");
  }

  let entries: Record<string, string>;
  try {
    entries = flattenJson(body);
  } catch (e) {
    if (e instanceof InvalidJsonError) return apiError(400, e.message);
    throw e;
  }
  // Almost certainly a broken CI step; it would wipe the namespace including all translations.
  if (prune === "true" && Object.keys(entries).length === 0) {
    return apiError(400, "Refusing to prune with an empty payload.");
  }

  const { added, updated, unchanged, pruned } = await syncSourceKeys({
    projectId: project.id,
    namespace,
    entries,
    prune: prune === "true",
  });
  return Response.json({ added, updated, unchanged, pruned });
}
