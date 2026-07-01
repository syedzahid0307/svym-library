import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

// All borrow/return/due-date arithmetic should route through this file
// rather than calling dayjs() directly. Without an explicit timezone,
// dayjs() uses whatever timezone the server process happens to be
// running in - UTC by default on Vercel. For a library in IST
// (UTC+5:30), a book borrowed late at night is already past midnight
// UTC, so a due date computed with bare dayjs() can silently land on a
// different calendar day than a librarian working in IST would expect,
// for a roughly 5.5-hour window every day.
//
// LIBRARY_TIMEZONE defaults to Asia/Kolkata (SVYM's location) but is
// configurable via env var so this isn't hardcoded for anyone who reuses
// this project elsewhere.
export const LIBRARY_TIMEZONE = process.env.LIBRARY_TIMEZONE || "Asia/Kolkata";

// "Now", pinned to the library's configured timezone rather than the
// server process's ambient one.
export const libraryNow = () => dayjs().tz(LIBRARY_TIMEZONE);

// A due date `days` from now, in the library's timezone, formatted as a
// plain YYYY-MM-DD string for storage in a `date` column.
export const libraryDueDate = (days: number) =>
  libraryNow().add(days, "day").format("YYYY-MM-DD");

// Today's date in the library's timezone, as a plain YYYY-MM-DD string -
// use this instead of new Date() or dayjs() when comparing against a
// stored `date` column (e.g. "is this loan overdue").
export const libraryToday = () => libraryNow().format("YYYY-MM-DD");

// True if `dateString` (a stored due/return date) is strictly before
// today, evaluated in the library's timezone.
export const isBeforeLibraryToday = (dateString: string) =>
  dayjs(dateString).isBefore(libraryNow(), "day");
