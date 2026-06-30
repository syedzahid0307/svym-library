import "server-only";

import { auth } from "@/auth";
import { db } from "@/database/drizzle";
import { users } from "@/database/schema";
import { eq } from "drizzle-orm";

// Every admin server action must call this first. Page-level layout
// checks (app/admin/layout.tsx) only stop someone from *rendering* the
// admin UI - they do nothing to stop a request hitting the underlying
// server action directly, since Next.js exposes each "use server"
// function as its own callable endpoint regardless of which page
// imported it. Without this check, any logged-in user could call e.g.
// updateUserRole(ownId, "ADMIN") directly and grant themselves admin.
//
// Returns the verified admin's user id on success, or null if the
// caller is not signed in / not an admin. Every action below must check
// this and bail out early on null - it does not throw, since each
// caller needs to return its own typed { success, error } shape.
export const requireAdmin = async (): Promise<string | null> => {
  const session = await auth();

  if (!session?.user?.id) return null;

  const result = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (result[0]?.role !== "ADMIN") return null;

  return session.user.id;
};
