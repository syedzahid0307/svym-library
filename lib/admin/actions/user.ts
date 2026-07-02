"use server";

import { db } from "@/database/drizzle";
import { users } from "@/database/schema";
import { desc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { logAuditEvent } from "@/lib/admin/audit";

export const getAllUsers = async () => {
  if (!(await requireAdmin())) {
    return [];
  }

  // Archived members (see archiveUser below) are excluded from the
  // default active-member listing - their account still exists and
  // their borrow history is intact, but they're no longer someone an
  // admin needs to see in the day-to-day member list.
  const result = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      staffId: users.staffId,
      memberType: users.memberType,
      status: users.status,
      role: users.role,
      lastActivityDate: users.lastActivityDate,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(isNull(users.archivedAt))
    .orderBy(desc(users.createdAt));

  return JSON.parse(JSON.stringify(result));
};

export const getArchivedUsers = async () => {
  if (!(await requireAdmin())) {
    return [];
  }

  const result = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      staffId: users.staffId,
      memberType: users.memberType,
      status: users.status,
      role: users.role,
      archivedAt: users.archivedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(isNotNull(users.archivedAt))
    .orderBy(desc(users.archivedAt));

  return JSON.parse(JSON.stringify(result));
};

export const getPendingUsers = async () => {
  if (!(await requireAdmin())) {
    return [];
  }

  const result = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      staffId: users.staffId,
      memberType: users.memberType,
      status: users.status,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.status, "PENDING"))
    .orderBy(desc(users.createdAt));

  return JSON.parse(JSON.stringify(result));
};

export const approveUser = async (userId: string) => {
  const adminId = await requireAdmin();
  if (!adminId) {
    return { success: false, error: "Not authorized" };
  }

  try {
    await db
      .update(users)
      .set({ status: "APPROVED" })
      .where(eq(users.id, userId));

    await logAuditEvent({
      actorId: adminId,
      action: "user.approved",
      entityType: "user",
      entityId: userId,
    });

    revalidatePath("/admin/account-requests");
    revalidatePath("/admin/users");

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, error: "Could not approve this account" };
  }
};

export const rejectUser = async (userId: string) => {
  const adminId = await requireAdmin();
  if (!adminId) {
    return { success: false, error: "Not authorized" };
  }

  try {
    // Bumping tokenVersion here is what makes this rejection actually
    // take effect against a session the user might already be holding -
    // without it, someone rejected after already being approved and
    // signed in would keep full access until their session's maxAge
    // naturally expires (up to 24h - see auth.ts). See auth.ts's jwt
    // callback for the check on the other end of this.
    await db
      .update(users)
      .set({ status: "REJECTED", tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, userId));

    await logAuditEvent({
      actorId: adminId,
      action: "user.rejected",
      entityType: "user",
      entityId: userId,
    });

    revalidatePath("/admin/account-requests");
    revalidatePath("/admin/users");

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, error: "Could not reject this account" };
  }
};

export const updateUserRole = async (
  userId: string,
  role: "USER" | "STAFF" | "ADMIN",
) => {
  const adminId = await requireAdmin();
  if (!adminId) {
    return { success: false, error: "Not authorized" };
  }

  // Guard against an admin accidentally demoting themselves and getting
  // locked out of /admin with no other admin account to fix it.
  if (userId === adminId && role !== "ADMIN") {
    return {
      success: false,
      error: "You can't remove your own admin role from here",
    };
  }

  try {
    // Same reasoning as rejectUser above: bumping tokenVersion forces
    // any session this user already holds to re-validate against their
    // new role on their next request past the TTL window, rather than
    // continuing to act with their old (possibly more privileged) role
    // until the session naturally expires.
    await db
      .update(users)
      .set({ role, tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, userId));

    await logAuditEvent({
      actorId: adminId,
      action: "user.role_changed",
      entityType: "user",
      entityId: userId,
      metadata: { newRole: role },
    });

    revalidatePath("/admin/users");

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, error: "Could not update this member's role" };
  }
};

export const updateMemberType = async (
  userId: string,
  memberType: string,
) => {
  const adminId = await requireAdmin();
  if (!adminId) {
    return { success: false, error: "Not authorized" };
  }

  try {
    await db.update(users).set({ memberType }).where(eq(users.id, userId));

    await logAuditEvent({
      actorId: adminId,
      action: "user.member_type_changed",
      entityType: "user",
      entityId: userId,
      metadata: { newMemberType: memberType },
    });

    revalidatePath("/admin/users");

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, error: "Could not update this member's type" };
  }
};

export const archiveUser = async (userId: string) => {
  const adminId = await requireAdmin();
  if (!adminId) {
    return { success: false, error: "Not authorized" };
  }

  if (userId === adminId) {
    return { success: false, error: "You can't archive your own account" };
  }

  try {
    // Archiving (rather than deleting) preserves this member's borrow
    // history - who had what, when - while removing them from active
    // member lists. Bumping tokenVersion forces out any session they
    // currently hold, same mechanism as rejectUser/updateUserRole above.
    const archived = await db
      .update(users)
      .set({ archivedAt: new Date(), tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, userId))
      .returning({ id: users.id, fullName: users.fullName });

    if (!archived.length) {
      return { success: false, error: "Member not found" };
    }

    await logAuditEvent({
      actorId: adminId,
      action: "user.archived",
      entityType: "user",
      entityId: userId,
      metadata: { fullName: archived[0].fullName },
    });

    revalidatePath("/admin/users");

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, error: "Could not archive this member" };
  }
};

export const restoreUser = async (userId: string) => {
  const adminId = await requireAdmin();
  if (!adminId) {
    return { success: false, error: "Not authorized" };
  }

  try {
    const restored = await db
      .update(users)
      .set({ archivedAt: null })
      .where(eq(users.id, userId))
      .returning({ id: users.id, fullName: users.fullName });

    if (!restored.length) {
      return { success: false, error: "Member not found" };
    }

    await logAuditEvent({
      actorId: adminId,
      action: "user.restored",
      entityType: "user",
      entityId: userId,
      metadata: { fullName: restored[0].fullName },
    });

    revalidatePath("/admin/users");

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, error: "Could not restore this member" };
  }
};
