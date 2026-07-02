"use server";

import { books, borrowRecords } from "@/database/schema";
import { db } from "@/database/drizzle";
import { randomUUID } from "crypto";
import { and, desc, eq, isNull, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { logAuditEvent } from "@/lib/admin/audit";

export const createBook = async (params: BookParams) => {
  const adminId = await requireAdmin();
  if (!adminId) {
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

    await logAuditEvent({
      actorId: adminId,
      action: "book.created",
      entityType: "book",
      entityId: newBook[0].id,
      metadata: { title: newBook[0].title },
    });

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

  // Archived books are excluded from the default admin listing - they
  // still exist (borrow history referencing them is intact) but aren't
  // meant to clutter the working catalog view. See getArchivedBooksAdmin
  // for the separate archived-only view.
  const result = await db
    .select()
    .from(books)
    .where(isNull(books.archivedAt))
    .orderBy(desc(books.createdAt));

  return JSON.parse(JSON.stringify(result)) as Book[];
};

export const getArchivedBooksAdmin = async () => {
  if (!(await requireAdmin())) {
    return [];
  }

  const result = await db
    .select()
    .from(books)
    .where(isNotNull(books.archivedAt))
    .orderBy(desc(books.createdAt));

  return JSON.parse(JSON.stringify(result)) as Book[];
};

export const updateBook = async (id: string, params: BookParams) => {
  const adminId = await requireAdmin();
  if (!adminId) {
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
    // clamped into [0, newTotalCopies].
    const checkedOut = existing.totalCopies - existing.availableCopies;
    const newAvailableCopies = Math.max(
      0,
      Math.min(params.totalCopies - checkedOut, params.totalCopies),
    );

    // Optimistic lock: the WHERE clause re-checks that totalCopies and
    // availableCopies still match what was just read above. If another
    // admin edited this same book in the moment between that read and
    // this write, zero rows match and nothing is silently overwritten.
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

    await logAuditEvent({
      actorId: adminId,
      action: "book.updated",
      entityType: "book",
      entityId: id,
      metadata: { title: updated[0].title },
    });

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
  const adminId = await requireAdmin();
  if (!adminId) {
    return { success: false, message: "Not authorized" };
  }

  try {
    // If this book has any borrow history at all - not just active
    // loans - archive it instead of hard-deleting. Deleting it would
    // either fail on the foreign-key constraint anyway (borrow_records
    // .book_id has no ON DELETE action) or, if that constraint were ever
    // relaxed, would silently erase which members borrowed it and when.
    // Archived books are excluded from the default catalog/admin views
    // but the row (and its history) stays intact and recoverable.
    const hasHistory = await db
      .select({ id: borrowRecords.id })
      .from(borrowRecords)
      .where(eq(borrowRecords.bookId, id))
      .limit(1);

    if (hasHistory.length) {
      const archived = await db
        .update(books)
        .set({ archivedAt: new Date() })
        .where(eq(books.id, id))
        .returning({ id: books.id, title: books.title });

      if (!archived.length) {
        return { success: false, message: "Book not found" };
      }

      await logAuditEvent({
        actorId: adminId,
        action: "book.archived",
        entityType: "book",
        entityId: id,
        metadata: { title: archived[0].title, reason: "has borrow history" },
      });

      revalidatePath("/admin/books");

      return {
        success: true,
        archived: true,
        message:
          "This book has borrow history, so it was archived instead of deleted - it's hidden from the catalog but its history is preserved.",
      };
    }

    const deleted = await db
      .delete(books)
      .where(eq(books.id, id))
      .returning({ id: books.id, title: books.title });

    if (!deleted.length) {
      return { success: false, message: "Book not found" };
    }

    await logAuditEvent({
      actorId: adminId,
      action: "book.deleted",
      entityType: "book",
      entityId: id,
      metadata: { title: deleted[0].title },
    });

    revalidatePath("/admin/books");

    return { success: true, archived: false };
  } catch (error) {
    console.log(error);

    return {
      success: false,
      message: "An error occurred while deleting the book",
    };
  }
};

export const restoreBook = async (id: string) => {
  const adminId = await requireAdmin();
  if (!adminId) {
    return { success: false, message: "Not authorized" };
  }

  try {
    const restored = await db
      .update(books)
      .set({ archivedAt: null })
      .where(eq(books.id, id))
      .returning({ id: books.id, title: books.title });

    if (!restored.length) {
      return { success: false, message: "Book not found" };
    }

    await logAuditEvent({
      actorId: adminId,
      action: "book.restored",
      entityType: "book",
      entityId: id,
      metadata: { title: restored[0].title },
    });

    revalidatePath("/admin/books");

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, message: "Could not restore this book" };
  }
};
