"use server";

import { db } from "@/database/drizzle";
import { books, borrowRecords, users } from "@/database/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import dayjs from "dayjs";
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
  // query or a cron job touching the row.
  const withOverdueFlag = records.map((record) => ({
    ...record,
    isOverdue:
      record.status === "BORROWED" &&
      dayjs(record.dueDate).isBefore(dayjs(), "day"),
  }));

  return JSON.parse(JSON.stringify(withOverdueFlag));
};

export const renewBorrow = async (recordId: string) => {
  if (!(await requireAdmin())) {
    return { success: false, error: "Not authorized" };
  }

  try {
    const newDueDate = dayjs().add(7, "day").toDate().toDateString();

    await db
      .update(borrowRecords)
      .set({ dueDate: newDueDate })
      .where(eq(borrowRecords.id, recordId));

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
    await db
      .update(borrowRecords)
      .set({ status: "RETURNED", returnDate: dayjs().toDate().toDateString() })
      .where(eq(borrowRecords.id, recordId));

    const book = await db
      .select({ availableCopies: books.availableCopies, totalCopies: books.totalCopies })
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);

    if (book.length) {
      const nextAvailable = Math.min(
        book[0].availableCopies + 1,
        book[0].totalCopies,
      );

      await db
        .update(books)
        .set({ availableCopies: nextAvailable })
        .where(eq(books.id, bookId));
    }

    revalidatePath("/admin/book-requests");
    revalidatePath("/admin/books");

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, error: "Could not mark this book as returned" };
  }
};
