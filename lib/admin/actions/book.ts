"use server";

import { books, borrowRecords } from "@/database/schema";
import { db } from "@/database/drizzle";
import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";

export const createBook = async (params: BookParams) => {
  if (!(await requireAdmin())) {
    return { success: false, message: "Not authorized" };
  }

  try {
    // Generate the internal library barcode used on the printed sticker.
    // Format: SVYM-XXXXXXXX (8 hex chars from a UUID) - short enough to
    // print legibly, unique enough not to collide.
    const libraryBarcode = `SVYM-${randomUUID().split("-")[0].toUpperCase()}`;

    const newBook = await db
      .insert(books)
      .values({
        ...params,
        availableCopies: params.totalCopies,
        libraryBarcode,
      })
      .returning();

    revalidatePath("/admin/books");

    return {
      success: true,
      data: JSON.parse(JSON.stringify(newBook[0])),
    };
  } catch (error) {
    console.log(error);

    return {
      success: false,
      message: "An error occurred while creating the book",
    };
  }
};

export const getAllBooksAdmin = async () => {
  if (!(await requireAdmin())) {
    return [];
  }

  const result = await db.select().from(books).orderBy(desc(books.createdAt));

  return JSON.parse(JSON.stringify(result)) as Book[];
};

export const updateBook = async (id: string, params: BookParams) => {
  if (!(await requireAdmin())) {
    return { success: false, message: "Not authorized" };
  }

  try {
    const existingRows = await db
      .select({
        totalCopies: books.totalCopies,
        availableCopies: books.availableCopies,
      })
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    if (!existingRows.length) {
      return { success: false, message: "Book not found" };
    }

    const existing = existingRows[0];

    // totalCopies can change on edit, but availableCopies isn't a field
    // the admin edits directly - it has to be recomputed so that the
    // number of copies *currently checked out* stays correct across the
    // edit. checkedOut is derived, then the new availableCopies is
    // clamped into [0, newTotalCopies] - e.g. if 3 of 5 copies are out
    // and an admin reduces totalCopies to 2, availableCopies becomes 0
    // (not negative), even though technically more books are "out" than
    // now exist on paper - that mismatch is a data-entry problem for the
    // admin to resolve physically, not something this function can fix.
    const checkedOut = existing.totalCopies - existing.availableCopies;
    const newAvailableCopies = Math.max(
      0,
      Math.min(params.totalCopies - checkedOut, params.totalCopies),
    );

    // Optimistic lock: the WHERE clause re-checks that totalCopies and
    // availableCopies still match what was just read above. If another
    // admin edited this same book in the moment between that read and
    // this write, zero rows match and nothing is silently overwritten -
    // the caller gets a clear "someone else edited this" instead of one
    // admin's change clobbering the other's with no trace.
    const updated = await db
      .update(books)
      .set({ ...params, availableCopies: newAvailableCopies })
      .where(
        and(
          eq(books.id, id),
          eq(books.totalCopies, existing.totalCopies),
          eq(books.availableCopies, existing.availableCopies),
        ),
      )
      .returning();

    if (!updated.length) {
      return {
        success: false,
        message:
          "This book was edited by someone else just now - please refresh and try again",
      };
    }

    revalidatePath("/admin/books");
    revalidatePath(`/books/${id}`);

    return { success: true, data: JSON.parse(JSON.stringify(updated[0])) };
  } catch (error) {
    console.log(error);

    return {
      success: false,
      message: "An error occurred while updating the book",
    };
  }
};

export const deleteBook = async (id: string) => {
  if (!(await requireAdmin())) {
    return { success: false, message: "Not authorized" };
  }

  try {
    // There's currently no "archive a book" alternative to hard-delete
    // (see the engineering report's EF-05 for that - deliberately
    // deferred, not part of this pass). Until that exists, refuse to
    // delete a book with any borrow history at all - not just active
    // loans - since deleting it would either fail on the foreign-key
    // constraint anyway (borrow_records.book_id has no ON DELETE
    // action) or, if that constraint were ever relaxed, would silently
    // erase a member's borrowing history along with the book. Checking
    // this proactively gives a clear message instead of a raw
    // constraint-violation error surfacing from the database.
    const hasHistory = await db
      .select({ id: borrowRecords.id })
      .from(borrowRecords)
      .where(eq(borrowRecords.bookId, id))
      .limit(1);

    if (hasHistory.length) {
      return {
        success: false,
        message:
          "This book has borrow history and can't be deleted. Set total copies to 0 instead if it's no longer available.",
      };
    }

    const deleted = await db
      .delete(books)
      .where(eq(books.id, id))
      .returning({ id: books.id });

    if (!deleted.length) {
      return { success: false, message: "Book not found" };
    }

    revalidatePath("/admin/books");

    return { success: true };
  } catch (error) {
    console.log(error);

    return {
      success: false,
      message: "An error occurred while deleting the book",
    };
  }
};
