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
  jsonb,
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
  // Incremented whenever an admin rejects this account or changes its
  // role (see lib/admin/actions/user.ts). The JWT issued at sign-in
  // embeds the value current at that moment; auth.ts periodically
  // re-checks it against the database and forces re-authentication if
  // they no longer match. Without this, a rejected/demoted user's
  // existing session keeps working exactly as before until it naturally
  // expires (see auth.ts's session.maxAge) - this is what makes revoking
  // access actually take effect sooner than that.
  tokenVersion: integer("token_version").notNull().default(0),
  // Set when a member leaves SVYM and an admin archives their account,
  // rather than deleting the row outright - deleting would destroy
  // their borrow history (who had what, when) with no way to recover
  // it. Archived accounts are excluded from active-member lists and
  // can't sign in (checked alongside status in auth.ts), but their
  // historical borrow_records stay intact and attributable.
  archivedAt: timestamp("archived_at", { withTimezone: true }),
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
    // Set instead of hard-deleting when a book has borrow history -
    // deleting it would silently erase which members borrowed it and
    // when. deleteBook() archives automatically in that case rather
    // than just refusing outright (see lib/admin/actions/book.ts).
    // Books with no borrow history at all can still be hard-deleted.
    archivedAt: timestamp("archived_at", { withTimezone: true }),
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

// A generic, append-only record of "who did what to what" for admin
// actions. Distinct from ordinary application logging (console.log
// error output) - this is a business-event record meant to answer
// questions like "who approved this account" or "who changed this
// book's copy count" after the fact, which nothing in this schema
// could answer before this table existed.
//
// actorId is nullable to allow for system-initiated events (e.g. a
// future automated process) that don't have a human admin behind them,
// though every current call site passes a real admin's id. No FK to
// users.id is declared here deliberately - audit history should survive
// even if the referenced admin account is later archived or, in an
// edge case, deleted; a dangling actorId is still meaningful evidence
// of what happened, and a hard FK would block deleting/archiving a user
// who has audit history, which defeats part of the point of archiving
// over deleting in the first place.
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    actorId: uuid("actor_id"),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_log_entity_idx").on(table.entityType, table.entityId),
    index("audit_log_actor_id_idx").on(table.actorId),
    index("audit_log_created_at_idx").on(table.createdAt),
  ],
);
