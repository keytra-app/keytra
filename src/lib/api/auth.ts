import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { apiKeys, projects } from "@/db/schema";
import { sha256 } from "@/lib/auth/crypto";

const API_KEY_RE = /^Bearer (ktr_[0-9a-f]{32})$/i;

/** The raw `key` is shown once; only `keyPrefix` and `keyHash` are stored. */
export function generateApiKey() {
  const key = `ktr_${randomBytes(16).toString("hex")}`;
  return { key, keyPrefix: key.slice(0, 10), keyHash: sha256(key) };
}

/**
 * Returns the project if the Bearer key belongs to it, otherwise null. Unknown keys, foreign
 * projects and unknown slugs look the same, so callers can't probe which projects exist.
 */
export async function authenticateApiKey(request: Request, projectSlug: string) {
  const token = request.headers.get("authorization")?.match(API_KEY_RE)?.[1];
  if (!token) return null;

  const [row] = await db
    .select({ apiKeyId: apiKeys.id, project: projects })
    .from(apiKeys)
    .innerJoin(projects, eq(projects.id, apiKeys.projectId))
    .where(eq(apiKeys.keyHash, sha256(token)))
    .limit(1);
  if (!row || row.project.slug !== projectSlug) return null;

  // Runs after the response; a failure must not fail the request.
  after(() =>
    db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, row.apiKeyId))
      .catch((e) => console.error("Failed to update api key lastUsedAt", e)),
  );
  return row.project;
}
