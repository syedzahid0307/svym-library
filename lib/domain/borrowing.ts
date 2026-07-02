import { books, borrowRecords, users } from "@/database/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { libraryDueDate, libraryToday, isBeforeLibraryToday } from "@/lib/date";
import type { Database } from "@/lib/domain/types";

// Postgres error code 23505 = unique_violation. The neon-http driver
// surfaces this on the thrown error's `code` property - checked
// defensively since the exact shape isn't part of any documented public
// type, just the observed behavior of the underlying pg wire protocol.
const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "23505";

export type BorrowResult =
  | { success: true; data: unknown }
  | { success: false; error: string };

// The core borrow operation. Two invariants are enforced at the
// database level rather than trusted from application code:
//   1. A copy must actually be available (atomic conditional decrement)
//   2. The same user can't hold two simultaneously-active loans of the
//      same book (partial unique index on borrow_records)
// See the comments inline for why the decrement happens before the
// insert, and what happens on a crash between the two (the neon-http
// driver doesn't support true multi-statement transactions).
export const borrowBookForUser = async (
  db: Database,
  userId: string,
  bookId: string,
): Promise<BorrowResult> => {
  try {
    const dueDate = libraryDueDate(7);

    const decremented = await db
      .update(books)
      .set({ availableCopies: sql`${books.availableCopies} - 1` })
      .where(and(eq(books.id, bookId), sql`${books.availableCopies} > 0`))
      .returning({ id: books.id });

    if (!decremented.length) {
      return { success: false, error: "Book is not available for borrowing" };
    }

    try {
      const record = await db
        .insert(borrowRecords)
        .values({ userId, bookId, dueDate, status: "BORROWED" })
        .returning();

      return { success: true, data: JSON.parse(JSON.stringify(record[0])) };
    } catch (insertError) {
      // Roll back the decrement above - the loan didn't actually happen.
      await db
        .update(books)
        .set({ availableCopies: sql`${books.availableCopies} + 1` })
        .where(eq(books.id, bookId));

      if (isUniqueViolation(insertError)) {
        return { success: false, error: "You already have this book borrowed" };
      }
      throw insertError;
    }
  } catch (error) {
    console.log(error);
    return { success: false, error: "An error occurred while borrowing the book" };
  }
};

export const returnLoan = async (
  db: Database,
  recordId: string,
  bookId: string,
): Promise<BorrowResult> => {
  try {
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

    // Atomic, conditional increment capped at totalCopies.
    await db
      .update(books)
      .set({
        availableCopies: sql`LEAST(${books.totalCopies}, ${books.availableCopies} + 1)`,
      })
      .where(eq(books.id, bookId));

    return { success: true, data: undefined };
  } catch (error) {
    console.log(error);
    return { success: false, error: "Could not mark this book as returned" };
  }
};

export const renewLoan = async (
  db: Database,
  recordId: string,
): Promise<{ success: true; dueDate: string } | { success: false; error: string }> => {
  try {
    const newDueDate = libraryDueDate(7);

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

    return { success: true, dueDate: newDueDate };
  } catch (error) {
    console.log(error);
    return { success: false, error: "Could not renew this loan" };
  }
};

export const getBorrowedBooksForUser = async (db: Database, userId: string) => {
  const records = await db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      genre: books.genre,
      rating: books.rating,
      totalCopies: books.totalCopies,
      availableCopies: books.availableCopies,
      description: books.description,
      coverColor: books.coverColor,
      coverUrl: books.coverUrl,
      videoUrl: books.videoUrl,
      summary: books.summary,
      isbn: books.isbn,
      libraryBarcode: books.libraryBarcode,
      createdAt: books.createdAt,
      borrowRecordId: borrowRecords.id,
      dueDate: borrowRecords.dueDate,
    })
    .from(borrowRecords)
    .innerJoin(books, eq(borrowRecords.bookId, books.id))
    .where(and(eq(borrowRecords.userId, userId), eq(borrowRecords.status, "BORROWED")));

  const withFlag = records.map((record) => ({ ...record, isLoanedBook: true }));

  return JSON.parse(JSON.stringify(withFlag)) as Book[];
};

export const getBorrowRecordsWithOverdueFlag = async (db: Database) => {
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

  const withOverdueFlag = records.map((record) => ({
    ...record,
    isOverdue: record.status === "BORROWED" && isBeforeLibraryToday(record.dueDate),
  }));

  return JSON.parse(JSON.stringify(withOverdueFlag));
};

// --- Kiosk / barcode-scan helpers ---
// These power the "enter staff ID, then scan the book's sticker" flow at
// the physical circulation desk, distinct from the normal signed-in
// website borrow flow above.

export const getUserByStaffId = async (db: Database, staffId: number) => {
  const result = await db
    .select({ id: users.id, fullName: users.fullName, status: users.status })
    .from(users)
    .where(eq(users.staffId, staffId))
    .limit(1);

  if (!result.length) {
    return { success: false as const, error: "No member found with that staff ID" };
  }

  if (result[0].status !== "APPROVED") {
    return {
      success: false as const,
      error: "This account has not been approved by the library admin yet",
    };
  }

  return { success: true as const, data: result[0] };
};

export const getBookByBarcode = async (db: Database, barcode: string) => {
  const result = await db
    .select()
    .from(books)
    .where(eq(books.libraryBarcode, barcode))
    .limit(1);

  if (!result.length) {
    return { success: false as const, error: "No book found for that barcode" };
  }

  return { success: true as const, data: JSON.parse(JSON.stringify(result[0])) as Book };
};

export const borrowBookByBarcode = async (
  db: Database,
  staffId: number,
  barcode: string,
): Promise<
  | { success: true; data: { book: Book; member: { id: string; fullName: string } } }
  | { success: false; error?: string }
> => {
  const user = await getUserByStaffId(db, staffId);
  if (!user.success) {
    return { success: false, error: user.error };
  }

  const book = await getBookByBarcode(db, barcode);
  if (!book.success) {
    return { success: false, error: book.error };
  }

  const result = await borrowBookForUser(db, user.data.id, book.data.id);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, data: { book: book.data, member: user.data } };
};
