"use server";

import { db } from "@/database/drizzle";
import { books, borrowRecords, users } from "@/database/schema";
import { and, eq, sql } from "drizzle-orm";
import { libraryDueDate } from "@/lib/date";

// Postgres error code 23505 = unique_violation. The neon-http driver
// surfaces this on the thrown error's `code` property - checked
// defensively since the exact shape isn't part of any documented public
// type, just the observed behavior of the underlying pg wire protocol.
const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "23505";

export const getBorrowedBooksForUser = async (userId: string) => {
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
    .where(
      and(eq(borrowRecords.userId, userId), eq(borrowRecords.status, "BORROWED")),
    );

  const withFlag = records.map((record) => ({
    ...record,
    isLoanedBook: true,
  }));

  return JSON.parse(JSON.stringify(withFlag)) as Book[];
};

export const borrowBook = async (params: BorrowBookParams) => {
  const { userId, bookId } = params;

  try {
    const dueDate = libraryDueDate(7);

    // Atomic, conditional decrement first - the WHERE clause re-checks
    // availability at the moment of the write rather than trusting a
    // value read moments earlier, so two concurrent borrows can't both
    // succeed against the last remaining copy.
    //
    // Note: the neon-http driver used here doesn't support true
    // multi-statement transactions, so this decrement and the insert
    // below aren't atomic *together* - a crash between them is possible.
    // Ordering matters for which failure mode that leaves: doing the
    // decrement first means a crash mid-operation undercounts
    // availableCopies (safe - just means a copy looks unavailable when
    // it technically isn't yet), rather than risking the same copy being
    // lent to two people. See EF-23 in the engineering report for the
    // longer-term fix (a driver that supports real transactions).
    const decremented = await db
      .update(books)
      .set({ availableCopies: sql`${books.availableCopies} - 1` })
      .where(and(eq(books.id, bookId), sql`${books.availableCopies} > 0`))
      .returning({ id: books.id });

    if (!decremented.length) {
      return {
        success: false,
        error: "Book is not available for borrowing",
      };
    }

    // If this user already has an active loan of this exact book, the
    // partial unique index on (user_id, book_id) WHERE status =
    // 'BORROWED' rejects the insert - caught below - and we roll back
    // the decrement above so the copy isn't left marked unavailable for
    // a borrow that didn't actually happen.
    try {
      const record = await db
        .insert(borrowRecords)
        .values({ userId, bookId, dueDate, status: "BORROWED" })
        .returning();

      return {
        success: true,
        data: JSON.parse(JSON.stringify(record[0])),
      };
    } catch (insertError) {
      await db
        .update(books)
        .set({ availableCopies: sql`${books.availableCopies} + 1` })
        .where(eq(books.id, bookId));

      if (isUniqueViolation(insertError)) {
        return {
          success: false,
          error: "You already have this book borrowed",
        };
      }
      throw insertError;
    }
  } catch (error) {
    console.log(error);

    return {
      success: false,
      error: "An error occurred while borrowing the book",
    };
  }
};

// --- Barcode / kiosk-scan helpers ---
// These power the "enter staff ID, then scan the book's sticker" flow used
// at the physical circulation desk, as distinct from the normal logged-in
// website borrow flow above.

export const getUserByStaffId = async (staffId: number) => {
  const result = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      status: users.status,
    })
    .from(users)
    .where(eq(users.staffId, staffId))
    .limit(1);

  if (!result.length) {
    return { success: false, error: "No member found with that staff ID" };
  }

  if (result[0].status !== "APPROVED") {
    return {
      success: false,
      error: "This account has not been approved by the library admin yet",
    };
  }

  return { success: true, data: result[0] };
};

export const getBookByBarcode = async (barcode: string) => {
  const result = await db
    .select()
    .from(books)
    .where(eq(books.libraryBarcode, barcode))
    .limit(1);

  if (!result.length) {
    return { success: false, error: "No book found for that barcode" };
  }

  return { success: true, data: JSON.parse(JSON.stringify(result[0])) };
};

// Combines the two lookups above with borrowBook() so the scan kiosk can
// do "staff ID + scan" -> borrowed in a single call.
export const borrowBookByBarcode = async (params: {
  staffId: number;
  barcode: string;
}): Promise<
  | { success: true; data: { book: Book; member: { id: string; fullName: string } } }
  | { success: false; error?: string }
> => {
  const { staffId, barcode } = params;

  const user = await getUserByStaffId(staffId);
  if (!user.success || !user.data) {
    return { success: false, error: user.error };
  }

  const book = await getBookByBarcode(barcode);
  if (!book.success || !book.data) {
    return { success: false, error: book.error };
  }

  const result = await borrowBook({ userId: user.data.id, bookId: book.data.id });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: { book: book.data, member: user.data },
  };
};
