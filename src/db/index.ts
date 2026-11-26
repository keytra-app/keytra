import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

declare global {
  // Reuse one pool across dev hot reloads so connections don't pile up.
  var pgPool: Pool | undefined;
}

const pool =
  globalThis.pgPool ??
  // Without a timeout an unreachable DB hangs requests (and the health check) indefinitely.
  new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
if (process.env.NODE_ENV !== "production") globalThis.pgPool = pool;

export const db = drizzle(pool, { schema });
