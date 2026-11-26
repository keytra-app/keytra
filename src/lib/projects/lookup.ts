import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { projects } from "@/db/schema";

export async function findProjectById(projectId: string) {
  const [project] = await db
    .select({ id: projects.id, slug: projects.slug, sourceLocale: projects.sourceLocale })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return project ?? null;
}

/** Refreshes the dashboard and the project page, which both show key and progress counts. */
export function revalidateProject(slug: string) {
  revalidatePath("/");
  revalidatePath(`/projects/${slug}`);
}
