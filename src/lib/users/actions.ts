"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { isRole, requireAdmin, type Role, UUID_RE } from "@/lib/auth/session";

export async function updateUserRoleAction(userId: string, role: Role): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (!UUID_RE.test(userId)) {
    return { ok: false, error: "Ungültige Benutzer-ID." };
  }
  if (!isRole(role)) {
    return { ok: false, error: "Ungültige Rolle." };
  }
  if (userId === admin.id) {
    return { ok: false, error: "Die eigene Rolle kann nicht geändert werden." };
  }

  const [updated] = await db
    .update(users)
    .set({ role })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  if (!updated) {
    return { ok: false, error: "Benutzer nicht gefunden." };
  }

  revalidatePath("/settings/users");
  return { ok: true };
}

export async function deleteUserAction(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (!UUID_RE.test(userId)) {
    return { ok: false, error: "Ungültige Benutzer-ID." };
  }
  if (userId === admin.id) {
    return { ok: false, error: "Der eigene Account kann nicht gelöscht werden." };
  }

  const [deleted] = await db.delete(users).where(eq(users.id, userId)).returning({ id: users.id });
  if (!deleted) {
    return { ok: false, error: "Benutzer nicht gefunden." };
  }

  revalidatePath("/settings/users");
  return { ok: true };
}
