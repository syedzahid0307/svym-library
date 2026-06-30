"use server";

import { db } from "@/database/drizzle";
import { books, borrowRecords, users } from "@/database/schema";
import { and, eq } from "drizzle-orm";
import dayjs from "dayjs";

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
    const book = await db
      .select({ availableCopies: books.availableCopies })
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);

    if (!book.length || book[0].availableCopies <= 0) {
      return {
        success: false,
        error: "Book is not available for borrowing",
      };
    }

    const dueDate = dayjs().add(7, "day").toDate().toDateString();

    const record = await db.insert(borrowRecords).values({
      userId,
      bookId,
      dueDate,
      status: "BORROWED",
    });

    await db
      .update(books)
      .set({ availableCopies: book[0].availableCopies - 1 })
      .where(eq(books.id, bookId));

    return {
      success: true,
      data: JSON.parse(JSON.stringify(record)),
    };
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
