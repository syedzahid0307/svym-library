"use server";

import { db } from "@/database/drizzle";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import {
  getBorrowRecordsWithOverdueFlag,
  renewLoan,
  returnLoan,
} from "@/lib/domain/borrowing";

// Thin adapter over lib/domain/borrowing.ts - see that file for the
// actual logic. This layer's only job is: verify the caller is an
// admin, call into the domain function with the real db client, and
// invalidate the right Next.js cache paths on success. None of that
// belongs in the domain layer itself (requireAdmin needs a request
// context; revalidatePath is Next.js-specific).

export const getBorrowRecords = async () => {
  if (!(await requireAdmin())) {
    return [];
  }

  return getBorrowRecordsWithOverdueFlag(db);
};

export const renewBorrow = async (recordId: string) => {
  if (!(await requireAdmin())) {
    // `as const` matters here: without it, TypeScript widens the
    // literal `false` to `boolean` when inferring this function's
    // return type across multiple return statements, which then
    // collapses the discriminated union renewLoan() returns into
    // something callers can't narrow on (result.success ? result.dueDate
    // : result.error stops type-checking correctly). Caught by tsc
    // immediately after this file was first written this way.
    return { success: false as const, error: "Not authorized" };
  }

  const result = await renewLoan(db, recordId);

  if (result.success) {
    revalidatePath("/admin/book-requests");
  }

  return result;
};

export const markBookReturned = async (recordId: string, bookId: string) => {
  if (!(await requireAdmin())) {
    return { success: false as const, error: "Not authorized" };
  }

  const result = await returnLoan(db, recordId, bookId);

  if (result.success) {
    revalidatePath("/admin/book-requests");
    revalidatePath("/admin/books");
  }

  return result;
};
