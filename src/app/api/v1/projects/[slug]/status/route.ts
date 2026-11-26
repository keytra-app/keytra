import { authenticateApiKey } from "@/lib/api/auth";
import { unauthorized } from "@/lib/api/http";
import { getProjectProgress } from "@/lib/projects/progress";

export async function GET(request: Request, ctx: RouteContext<"/api/v1/projects/[slug]/status">) {
  const project = await authenticateApiKey(request, (await ctx.params).slug);
  if (!project) return unauthorized();

  const { totalKeys, locales } = await getProjectProgress(project);
  return Response.json({
    slug: project.slug,
    sourceLocale: project.sourceLocale,
    totalKeys,
    locales: locales.map(({ code, name, total, translated, outdated, missing, percentage }) => ({
      code,
      name,
      total,
      translated,
      outdated,
      missing,
      percentage,
    })),
  });
}
