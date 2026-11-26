import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { projectMembers, projects, users } from "@/db/schema";
import type { TranslatorAccess } from "@/lib/auth/session";

/** Sets the access mode and replaces the member list. Ids of non-translators are ignored. */
export async function replaceProjectAccess(
  projectId: string,
  translatorAccess: TranslatorAccess,
  memberIds: string[],
) {
  await db.transaction(async (tx) => {
    await tx.update(projects).set({ translatorAccess }).where(eq(projects.id, projectId));
    await tx.delete(projectMembers).where(eq(projectMembers.projectId, projectId));
    if (memberIds.length === 0) return;

    const translators = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "translator"), inArray(users.id, memberIds)));
    if (translators.length === 0) return;

    await tx
      .insert(projectMembers)
      .values(translators.map((user) => ({ projectId, userId: user.id })));
  });
}
