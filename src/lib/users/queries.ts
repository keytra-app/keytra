import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invites, users } from "@/db/schema";
import type { Role } from "@/lib/auth/session";

export type UserListRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
};

export type OpenInviteRow = {
  id: string;
  role: Role;
  creatorName: string;
  createdAt: string;
  expiresAt: string;
};

export async function getUsersAndOpenInvites(): Promise<{
  users: UserListRow[];
  invites: OpenInviteRow[];
}> {
  const [userRows, inviteRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.createdAt)),
    db
      .select({
        id: invites.id,
        role: invites.role,
        creatorName: users.name,
        createdAt: invites.createdAt,
        expiresAt: invites.expiresAt,
      })
      .from(invites)
      .innerJoin(users, eq(users.id, invites.createdBy))
      .where(and(isNull(invites.usedAt), gt(invites.expiresAt, new Date())))
      .orderBy(desc(invites.createdAt)),
  ]);

  return {
    users: userRows.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
    })),
    invites: inviteRows.map((inv) => ({
      ...inv,
      createdAt: inv.createdAt.toISOString(),
      expiresAt: inv.expiresAt.toISOString(),
    })),
  };
}
