import {
  varchar,
  uuid,
  integer,
  text,
  pgTable,
  date,
  pgEnum,
  timestamp,
  check,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const STATUS_ENUM = pgEnum("status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);
export const ROLE_ENUM = pgEnum("role", ["USER", "STAFF", "ADMIN"]);
export const BORROW_STATUS_ENUM = pgEnum("borrow_status", [
  "BORROWED",
  "RETURNED",
]);

export const users = pgTable("users", {
  id: uuid("id").notNull().primaryKey().defaultRandom().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: text("email").notNull().unique(),
  staffId: integer("staff_id").notNull().unique(),
  password: text("password").notNull(),
  memberType: varchar("member_type", { length: 50 }).notNull().default("COMMUNITY"),
  status: STATUS_ENUM("status").default("PENDING"),
  role: ROLE_ENUM("role").default("USER"),
  lastActivityDate: date("last_activity_date").defaultNow(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
  }).defaultNow(),
});

export const books = pgTable(
  "books",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    author: varchar("author", { length: 255 }).notNull(),
    genre: text("genre").notNull(),
    rating: integer("rating").notNull(),
    coverUrl: text("cover_url").notNull(),
    coverColor: varchar("cover_color", { length: 7 }).notNull(),
    description: text("description").notNull(),
    totalCopies: integer("total_copies").notNull().default(1),
    availableCopies: integer("available_copies").notNull().default(0),
    videoUrl: text("video_url").notNull(),
    summary: varchar("summary").notNull(),
    // Manufacturer barcode (ISBN/EAN/UPC) used to look up the book when first adding it
    isbn: varchar("isbn", { length: 32 }),
    // Internal library barcode value (encoded in the printed sticker's QR code).
    // Defaults to the book's own id but kept as a separate column so it can be
    // reprinted/reassigned independently of the primary key if a sticker is lost.
    libraryBarcode: text("library_barcode").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    // Ratings are meant to be a 1-5 scale; nothing in the app UI currently
    // lets a value outside that range in, but there was no database-level
    // guarantee against a bad import/migration/direct-SQL edit doing so.
    check("books_rating_range", sql`${table.rating} >= 1 AND ${table.rating} <= 5`),
  ],
);

export const borrowRecords = pgTable(
  "borrow_records",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom().unique(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    bookId: uuid("book_id")
      .references(() => books.id)
      .notNull(),
    borrowDate: timestamp("borrow_date", { withTimezone: true })
      .defaultNow()
      .notNull(),
    dueDate: date("due_date").notNull(),
    returnDate: date("return_date"),
    status: BORROW_STATUS_ENUM("status").default("BORROWED").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    // These hot paths (my-profile's "my borrowed books", the admin
    // book-requests table, and the overdue-reminder cron) all filter by
    // one or more of these columns without an index today - fine at
    // current row counts, a real cost the moment the table grows.
    index("borrow_records_user_id_idx").on(table.userId),
    index("borrow_records_book_id_idx").on(table.bookId),
    index("borrow_records_status_due_date_idx").on(table.status, table.dueDate),

    // Enforces "a member can only have one active loan of a given book
    // at a time" at the database level. Without this, a double-submitted
    // form or two open tabs can both succeed whenever 2+ copies are
    // available, since nothing previously checked whether the *same
    // user* already had this exact title checked out - only whether a
    // copy was available at all. The partial WHERE clause means returned
    // loans don't count, so borrowing the same book again after
    // returning it is unaffected.
    uniqueIndex("borrow_records_one_active_loan_per_book")
      .on(table.userId, table.bookId)
      .where(sql`${table.status} = 'BORROWED'`),
  ],
);
