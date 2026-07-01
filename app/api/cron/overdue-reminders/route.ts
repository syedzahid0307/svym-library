import { NextRequest, NextResponse } from "next/server";
import { db } from "@/database/drizzle";
import { books, borrowRecords, users } from "@/database/schema";
import { and, eq, lt } from "drizzle-orm";
import { sendEmail } from "@/lib/workflow";
import config from "@/lib/config";
import dayjs from "dayjs";
import { libraryToday } from "@/lib/date";

// GET /api/cron/overdue-reminders
//
// Intended to be hit once a day by a scheduler - either Vercel Cron
// (add a "crons" entry to vercel.json pointing here) or an Upstash QStash
// schedule. It finds every loan that's still BORROWED with a due date
// before today and emails the member a reminder.
//
// This is deliberately simple and re-sends a reminder on every overdue day
// rather than tracking "already notified" state, since there's no extra
// column for that yet. Running it daily means a member gets one reminder
// per day they're overdue, which is reasonable for a small library - if
// that turns out to be too noisy, add a `lastReminderSentAt` column to
// borrow_records and skip rows reminded within the last 24h.
//
// Protected by a shared secret so this can't be triggered by anyone who
// finds the URL. Set CRON_SECRET in your environment and pass it as
// `?secret=...` or an `Authorization: Bearer ...` header when scheduling.
export async function GET(request: NextRequest) {
  const secret =
    request.nextUrl.searchParams.get("secret") ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!config.env.cronSecret || secret !== config.env.cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = libraryToday();

  const overdueLoans = await db
    .select({
      recordId: borrowRecords.id,
      dueDate: borrowRecords.dueDate,
      bookTitle: books.title,
      userEmail: users.email,
      userFullName: users.fullName,
    })
    .from(borrowRecords)
    .innerJoin(books, eq(borrowRecords.bookId, books.id))
    .innerJoin(users, eq(borrowRecords.userId, users.id))
    .where(
      and(
        eq(borrowRecords.status, "BORROWED"),
        lt(borrowRecords.dueDate, today),
      ),
    );

  let sent = 0;
  const failures: string[] = [];

  for (const loan of overdueLoans) {
    try {
      await sendEmail({
        email: loan.userEmail,
        subject: `Overdue: "${loan.bookTitle}" - SVYM Library`,
        message: `Hi ${loan.userFullName},<br/><br/>"${loan.bookTitle}" was due back on ${dayjs(
          loan.dueDate,
        ).format(
          "DD MMM YYYY",
        )} and is still showing as borrowed. Please return it to the SVYM Library, or ask a librarian about renewing it if you still need it.<br/><br/>Thank you.`,
      });
      sent += 1;
    } catch (error) {
      console.log(`Failed to send overdue reminder for ${loan.recordId}`, error);
      failures.push(loan.recordId);
    }
  }

  return NextResponse.json({
    checked: overdueLoans.length,
    sent,
    failures,
  });
}
