"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { invites, users } from "@/db/schema";
import type { FormState } from "@/lib/action-result";
import { getAppUrl } from "@/lib/app-url";
import { createFirstAdmin, createUserFromInvite } from "./accounts";
import { generateToken, hashPassword, sha256, verifyPassword } from "./crypto";
import {
  createSession,
  destroySession,
  hasAnyUsers,
  isRole,
  normalizeEmail,
  requireAdmin,
  UUID_RE,
} from "./session";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SETUP_DONE = { error: "403: Setup ist bereits abgeschlossen." };
const INVALID_CREDENTIALS = { error: "E-Mail oder Passwort falsch." };

// Used when the email is unknown so login timing doesn't reveal which accounts exist.
let dummyHash: Promise<string> | undefined;

async function readNewAccount(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!name || name.length > 100) return { error: "Bitte einen Namen (max. 100 Zeichen) angeben." };
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 254) {
    return { error: "Ungültige E-Mail-Adresse." };
  }
  // Upper bound keeps scrypt cost bounded for hostile input.
  if (password.length < 8 || password.length > 256) {
    return { error: "Passwort muss 8–256 Zeichen lang sein." };
  }
  return { user: { name, email, passwordHash: await hashPassword(password) } };
}

export async function setupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (await hasAnyUsers()) return SETUP_DONE;

  const account = await readNewAccount(formData);
  if ("error" in account) return account;

  const userId = await createFirstAdmin(account.user);
  if (!userId) return SETUP_DONE;

  await createSession(userId);
  redirect("/");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!email || !password || password.length > 256) return INVALID_CREDENTIALS;

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  dummyHash ??= hashPassword("keytra-dummy-password");
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !ok) return INVALID_CREDENTIALS;

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export type CreateInviteState = { error?: string; link?: string } | undefined;

export async function createInvite(
  _prev: CreateInviteState,
  formData: FormData,
): Promise<CreateInviteState> {
  const admin = await requireAdmin();
  const role = formData.get("role");
  if (!isRole(role)) return { error: "Ungültige Rolle." };

  const token = generateToken();
  await db.insert(invites).values({
    tokenHash: sha256(token),
    role,
    createdBy: admin.id,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  revalidatePath("/settings/users");
  return { link: `${getAppUrl()}/invite/${token}` };
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
  const account = await readNewAccount(formData);
  if ("error" in account) return account;

  const result = await createUserFromInvite(token, account.user);
  if (!result.ok) {
    return result.reason === "email-taken"
      ? { error: "Diese E-Mail-Adresse ist bereits vergeben." }
      : { error: "Einladung ist ungültig, abgelaufen oder wurde bereits genutzt." };
  }

  await createSession(result.userId);
  redirect("/");
}
