"use server";

import { books } from "@/database/schema";
import { db } from "@/database/drizzle";
import { randomUUID } from "crypto";
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
