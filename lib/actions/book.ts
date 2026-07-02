"use server";

import { db } from "@/database/drizzle";
import {
  borrowBookForUser,
  borrowBookByBarcode as borrowBookByBarcodeDomain,
  getBorrowedBooksForUser as getBorrowedBooksForUserDomain,
  getUserByStaffId as getUserByStaffIdDomain,
  getBookByBarcode as getBookByBarcodeDomain,
} from "@/lib/domain/borrowing";

// This file is a thin adapter over lib/domain/borrowing.ts - it exists
// so the actual business logic (atomic decrement, duplicate-loan
// handling, kiosk lookups) isn't welded to being a Next.js Server
// Action and can be called/tested independently of one. See
// lib/domain/types.ts for why `db` is passed as a parameter rather than
// imported directly inside the domain functions.
//
// None of these previously called auth() - borrowBook takes userId
// directly from its caller (the signed-in member's own id, resolved by
// whichever page calls this), and the barcode functions are for the
// /scan kiosk flow, which deliberately uses staff-ID entry instead of a
// browser session (see app/scan/page.tsx). That's unchanged here.

export const getBorrowedBooksForUser = async (userId: string) =>
  getBorrowedBooksForUserDomain(db, userId);

export const borrowBook = async (params: BorrowBookParams) =>
  borrowBookForUser(db, params.userId, params.bookId);

export const getUserByStaffId = async (staffId: number) =>
  getUserByStaffIdDomain(db, staffId);

export const getBookByBarcode = async (barcode: string) =>
  getBookByBarcodeDomain(db, barcode);

export const borrowBookByBarcode = async (params: {
  staffId: number;
  barcode: string;
}) => borrowBookByBarcodeDomain(db, params.staffId, params.barcode);
