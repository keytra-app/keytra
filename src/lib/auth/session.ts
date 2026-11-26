import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "@/db";
import { projectMembers, projects, sessions, translatorAccess, users } from "@/db/schema";
import { generateToken, hashPassword, sha256 } from "./crypto";

export const SESSION_COOKIE = "keytra_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Role = (typeof users.role.enumValues)[number];
export type TranslatorAccess = (typeof translatorAccess.enumValues)[number];
export type CurrentUser = { id: string; email: string; name: string; role: Role };

export const isRole = (value: unknown): value is Role =>
  users.role.enumValues.some((role) => role === value);

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * True if at least one user exists. If none exist and ADMIN_EMAIL + ADMIN_PASSWORD are set,
 * the admin is created first (idempotent via unique email).
 */
export const hasAnyUsers = cache(async (): Promise<boolean> => {
  // Never prerender: the answer changes at runtime and the image is built without a database.
  await connection();
  const [row] = await db.select({ id: users.id }).from(users).limit(1);
  if (row) return true;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return false;

  await db
    .insert(users)
    .values({
      email: normalizeEmail(email),
      name: process.env.ADMIN_NAME || "Admin",
      passwordHash: await hashPassword(password),
      role: "admin",
    })
    .onConflictDoNothing({ target: users.email });
  return true;
});

/** Creates a DB session and sets the cookie. Only callable from Server Actions / Route Handlers. */
export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  // Opportunistic cleanup of this user's expired sessions.
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_URL?.startsWith("https://") ?? false,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  store.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
});

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect((await hasAnyUsers()) ? "/login" : "/setup");
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireAuth();
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function canAccessProject(
  user: CurrentUser,
  project: { id: string; translatorAccess: TranslatorAccess },
): Promise<boolean> {
  if (user.role === "admin" || project.translatorAccess === "all") return true;
  const [member] = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, user.id)))
    .limit(1);
  return Boolean(member);
}

export async function requireProjectAccess(projectId: string): Promise<CurrentUser> {
  const user = await requireAuth();
  // Non-UUID ids would make Postgres throw (22P02); treat them as unknown.
  if (!UUID_RE.test(projectId)) notFound();

  const [project] = await db
    .select({ translatorAccess: projects.translatorAccess })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) notFound();
  // Forbidden looks like unknown, so translators can't probe which projects exist.
  if (!(await canAccessProject(user, { id: projectId, ...project }))) notFound();
  return user;
}
