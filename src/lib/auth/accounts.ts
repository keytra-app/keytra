import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { isSerializationFailure, isUniqueViolation } from "@/db/errors";
import { invites, users } from "@/db/schema";
import { sha256 } from "./crypto";
import type { Role } from "./session";

type NewUser = { name: string; email: string; passwordHash: string };

const openInvite = (token: string) =>
  and(
    eq(invites.tokenHash, sha256(token)),
    isNull(invites.usedAt),
    gt(invites.expiresAt, new Date()),
  );

export async function findOpenInviteRole(token: string): Promise<Role | null> {
  const [invite] = await db
    .select({ role: invites.role })
    .from(invites)
    .where(openInvite(token))
    .limit(1);
  return invite?.role ?? null;
}

/** Creates the first account as admin. Returns null if any user exists, also after a race. */
export async function createFirstAdmin(user: NewUser): Promise<string | null> {
  try {
    // Serializable: two concurrent setups can't both see an empty users table and both commit.
    return await db.transaction(
      async (tx) => {
        const [existing] = await tx.select({ id: users.id }).from(users).limit(1);
        if (existing) return null;
        const [created] = await tx
          .insert(users)
          .values({ ...user, role: "admin" })
          .returning({ id: users.id });
        return created.id;
      },
      { isolationLevel: "serializable" },
    );
  } catch (e) {
    if (isSerializationFailure(e) || isUniqueViolation(e)) return null;
    throw e;
  }
}

export type InviteSignupResult =
  { ok: true; userId: string } | { ok: false; reason: "invalid-invite" | "email-taken" };

export async function createUserFromInvite(
  token: string,
  user: NewUser,
): Promise<InviteSignupResult> {
  try {
    return await db.transaction(async (tx) => {
      // Atomic claim: only one request can flip usedAt from null.
      const [invite] = await tx
        .update(invites)
        .set({ usedAt: new Date() })
        .where(openInvite(token))
        .returning({ role: invites.role });
      if (!invite) return { ok: false, reason: "invalid-invite" } as const;

      const [created] = await tx
        .insert(users)
        .values({ ...user, role: invite.role })
        .returning({ id: users.id });
      return { ok: true, userId: created.id } as const;
    });
  } catch (e) {
    // Rolled back, so the invite stays usable.
    if (isUniqueViolation(e)) return { ok: false, reason: "email-taken" };
    throw e;
  }
}
