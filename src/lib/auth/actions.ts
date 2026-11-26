"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { invites, users } from "@/db/schema";
import type { FormState } from "@/components/auth-form";
import { generateToken, hashPassword, sha256, verifyPassword } from "./crypto";
import {
  createSession,
  destroySession,
  hasAnyUsers,
  normalizeEmail,
  requireAdmin,
  type Role,
  UUID_RE,
} from "./session";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Used when the email is unknown so login timing doesn't reveal which accounts exist.
let dummyHash: Promise<string> | undefined;

function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } } | null;
  return err?.code ?? err?.cause?.code;
}

type NewAccount = { name: string; email: string; password: string };

function readNewAccount(formData: FormData): NewAccount | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!name || name.length > 100) return { error: "Bitte einen Namen (max. 100 Zeichen) angeben." };
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 254) return { error: "Ungültige E-Mail-Adresse." };
  // Upper bound keeps scrypt cost bounded for hostile input.
  if (password.length < 8 || password.length > 256) return { error: "Passwort muss 8–256 Zeichen lang sein." };
  return { name, email, password };
}

// ── Setup ──────────────────────────────────────────────────────────────────────

export async function setupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (await hasAnyUsers()) return { error: "403: Setup ist bereits abgeschlossen." };

  const input = readNewAccount(formData);
  if ("error" in input) return input;
  const passwordHash = await hashPassword(input.password);

  let userId: string | null = null;
  try {
    // Serializable: two concurrent setups can't both see an empty users table and both commit.
    userId = await db.transaction(
      async (tx) => {
        const [existing] = await tx.select({ id: users.id }).from(users).limit(1);
        if (existing) return null;
        const [user] = await tx
          .insert(users)
          .values({ name: input.name, email: input.email, passwordHash, role: "admin" })
          .returning({ id: users.id });
        return user.id;
      },
      { isolationLevel: "serializable" },
    );
  } catch (e) {
    if (pgCode(e) !== "40001" && pgCode(e) !== "23505") throw e;
  }
  if (!userId) return { error: "403: Setup ist bereits abgeschlossen." };

  await createSession(userId);
  redirect("/");
}

// ── Login / Logout ─────────────────────────────────────────────────────────────

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!email || !password || password.length > 256) return { error: "E-Mail oder Passwort falsch." };

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  dummyHash ??= hashPassword("keytra-dummy-password");
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !ok) return { error: "E-Mail oder Passwort falsch." };

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// ── Invites ────────────────────────────────────────────────────────────────────

export type CreateInviteState = { error?: string; link?: string } | undefined;

export async function createInvite(_prev: CreateInviteState, formData: FormData): Promise<CreateInviteState> {
  const admin = await requireAdmin();
  const role = formData.get("role");
  if (!users.role.enumValues.includes(role as Role)) return { error: "Ungültige Rolle." };

  const token = generateToken();
  await db.insert(invites).values({
    tokenHash: sha256(token),
    role: role as Role,
    createdBy: admin.id,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  revalidatePath("/settings/users");
  return { link: `${base}/invite/${token}` };
}

/** Deletes an invite that hasn't been used yet. Used invites stay for the audit trail. */
export async function revokeInvite(inviteId: string): Promise<void> {
  await requireAdmin();
  if (!UUID_RE.test(inviteId)) return;
  await db.delete(invites).where(and(eq(invites.id, inviteId), isNull(invites.usedAt)));
  revalidatePath("/settings/users");
}

export async function acceptInviteAction(
  token: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const input = readNewAccount(formData);
  if ("error" in input) return input;
  const passwordHash = await hashPassword(input.password);

  let userId: string | null;
  try {
    userId = await db.transaction(async (tx) => {
      // Atomic claim: only one request can flip usedAt from null.
      const [invite] = await tx
        .update(invites)
        .set({ usedAt: new Date() })
        .where(
          and(eq(invites.tokenHash, sha256(token)), isNull(invites.usedAt), gt(invites.expiresAt, new Date())),
        )
        .returning({ role: invites.role });
      if (!invite) return null;

      const [user] = await tx
        .insert(users)
        .values({ name: input.name, email: input.email, passwordHash, role: invite.role })
        .returning({ id: users.id });
      return user.id;
    });
  } catch (e) {
    // Rolled back, so the invite stays usable.
    if (pgCode(e) === "23505") return { error: "Diese E-Mail-Adresse ist bereits vergeben." };
    throw e;
  }
  if (!userId) return { error: "Einladung ist ungültig, abgelaufen oder wurde bereits genutzt." };

  await createSession(userId);
  redirect("/");
}
