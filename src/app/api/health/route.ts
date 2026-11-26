import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({ status: "ok", db: "connected" });
  } catch (e) {
    console.error("Health check failed", e);
    return Response.json({ status: "error", db: "disconnected" }, { status: 503 });
  }
}
