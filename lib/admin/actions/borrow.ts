"use server";

import { db } from "@/database/drizzle";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { logAuditEvent } from "@/lib/admin/audit";
import {
  getBorrowRecordsWithOverdueFlag,
  renewLoan,
  returnLoan,
} from "@/lib/domain/borrowing";

// Thin adapter over lib/domain/borrowing.ts - see that file for the
// actual logic. This layer's only job is: verify the caller is an
// admin, call into the domain function with the real db client,
// invalidate the right Next.js cache paths on success, and record an
// audit log entry. None of that belongs in the domain layer itself
// (requireAdmin needs a request context; revalidatePath is
// Next.js-specific; the audit log records *who*, which the domain layer
// has no notion of since it isn't tied to any particular caller).

export const getBorrowRecords = async () => {
  if (!(await requireAdmin())) {
    return [];
  }

  return getBorrowRecordsWithOverdueFlag(db);
};

export const renewBorrow = async (recordId: string) => {
  const adminId = await requireAdmin();
  if (!adminId) {
    return { success: false as const, error: "Not authorized" };
  }

  const result = await renewLoan(db, recordId);

  if (result.success) {
    await logAuditEvent({
      actorId: adminId,
      action: "borrow.renewed",
      entityType: "borrow_record",
      entityId: recordId,
      metadata: { newDueDate: result.dueDate },
    });
    revalidatePath("/admin/book-requests");
  }

  return result;
};

export const markBookReturned = async (recordId: string, bookId: string) => {
  const adminId = await requireAdmin();
  if (!adminId) {
    return { success: false as const, error: "Not authorized" };
  }

  const result = await returnLoan(db, recordId, bookId);

  if (result.success) {
    await logAuditEvent({
      actorId: adminId,
      action: "borrow.returned",
      entityType: "borrow_record",
      entityId: recordId,
      metadata: { bookId },
    });
    revalidatePath("/admin/book-requests");
    revalidatePath("/admin/books");
  }

  return result;
};
