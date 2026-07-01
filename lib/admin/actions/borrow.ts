"use server";

import { db } from "@/database/drizzle";
import { books, borrowRecords, users } from "@/database/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { libraryDueDate, libraryToday, isBeforeLibraryToday } from "@/lib/date";
import { requireAdmin } from "@/lib/admin/guard";

export const getBorrowRecords = async () => {
  if (!(await requireAdmin())) {
    return [];
  }

  const records = await db
    .select({
      id: borrowRecords.id,
      borrowDate: borrowRecords.borrowDate,
      dueDate: borrowRecords.dueDate,
      returnDate: borrowRecords.returnDate,
      status: borrowRecords.status,
      bookId: books.id,
      bookTitle: books.title,
      bookCoverColor: books.coverColor,
      libraryBarcode: books.libraryBarcode,
      userId: users.id,
      userFullName: users.fullName,
      userStaffId: users.staffId,
    })
    .from(borrowRecords)
    .innerJoin(books, eq(borrowRecords.bookId, books.id))
    .innerJoin(users, eq(borrowRecords.userId, users.id))
    .orderBy(desc(borrowRecords.borrowDate));

  // Flag anything still BORROWED whose due date has passed, so the admin
  // page can show "Overdue" instead of just "Borrowed" without a separate
  // query or a cron job touching the row. Evaluated in the library's
  // configured timezone (see lib/date.ts) rather than server-local time.
  const withOverdueFlag = records.map((record) => ({
    ...record,
    isOverdue:
      record.status === "BORROWED" && isBeforeLibraryToday(record.dueDate),
  }));

  return JSON.parse(JSON.stringify(withOverdueFlag));
};

export const renewBorrow = async (recordId: string) => {
  if (!(await requireAdmin())) {
    return { success: false, error: "Not authorized" };
  }

  try {
    const newDueDate = libraryDueDate(7);

    // Only extend a record that's still actually BORROWED - without this
    // check, renewing an already-RETURNED loan would silently give it a
    // future due date again, which makes no sense for a book that's
    // physically back on the shelf. .returning() + a length check also
    // means we can tell the caller when nothing matched (wrong id, or
    // the record was returned moments ago) instead of reporting success
    // regardless.
    const updated = await db
      .update(borrowRecords)
      .set({ dueDate: newDueDate })
      .where(and(eq(borrowRecords.id, recordId), eq(borrowRecords.status, "BORROWED")))
      .returning({ id: borrowRecords.id });

    if (!updated.length) {
      return {
        success: false,
        error: "This loan is no longer active (already returned, or not found)",
      };
    }

    revalidatePath("/admin/book-requests");

    return { success: true, dueDate: newDueDate };
  } catch (error) {
    console.log(error);
    return { success: false, error: "Could not renew this loan" };
  }
};

export const markBookReturned = async (recordId: string, bookId: string) => {
  if (!(await requireAdmin())) {
    return { success: false, error: "Not authorized" };
  }

  try {
    // Same reasoning as renewBorrow above: only flip a record that's
    // still BORROWED, and check whether anything actually matched before
    // reporting success or touching the book's copy count.
    const updated = await db
      .update(borrowRecords)
      .set({ status: "RETURNED", returnDate: libraryToday() })
      .where(and(eq(borrowRecords.id, recordId), eq(borrowRecords.status, "BORROWED")))
      .returning({ id: borrowRecords.id });

    if (!updated.length) {
      return {
        success: false,
        error: "This loan is no longer active (already returned, or not found)",
      };
    }

    // Atomic, conditional increment capped at totalCopies - pushes the
    // cap into the WHERE/SET clause via SQL rather than reading
    // availableCopies into application code and writing a computed value
    // back, which had the same read-then-write race as the original
    // borrow-side bug this whole pass started from.
    await db
      .update(books)
      .set({
        availableCopies: sql`LEAST(${books.totalCopies}, ${books.availableCopies} + 1)`,
      })
      .where(eq(books.id, bookId));

    revalidatePath("/admin/book-requests");
    revalidatePath("/admin/books");

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, error: "Could not mark this book as returned" };
  }
};
