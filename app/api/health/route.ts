import { NextResponse } from "next/server";
import { db } from "@/database/drizzle";
import { books } from "@/database/schema";
import redis from "@/database/redis";
import { sql } from "drizzle-orm";

// GET /api/health
//
// Intended for an external uptime monitor or load-balancer health check.
// Checks the two hard dependencies the app can't function without -
// Postgres (via a trivial query) and Redis (used for rate limiting on
// sign-in/sign-up) - and reports per-dependency status rather than just
// a blanket pass/fail, so an on-call person can tell at a glance which
// piece is actually down.
//
// Deliberately unauthenticated: an uptime monitor typically can't carry
// a session, and there's nothing sensitive in the response - just
// booleans and latency numbers.
export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  const dbStart = Date.now();
  try {
    await db.select({ count: sql<number>`count(*)` }).from(books).limit(1);
    checks.database = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (error) {
    checks.database = {
      ok: false,
      latencyMs: Date.now() - dbStart,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  const redisStart = Date.now();
  try {
    await redis.ping();
    checks.redis = { ok: true, latencyMs: Date.now() - redisStart };
  } catch (error) {
    checks.redis = {
      ok: false,
      latencyMs: Date.now() - redisStart,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 },
  );
}
