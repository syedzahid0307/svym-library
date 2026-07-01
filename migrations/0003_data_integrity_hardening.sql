-- Data-integrity hardening pass.
--
-- Before running against a database with existing data, check for and
-- resolve any rows that would violate the new constraints:
--
--   -- ratings outside 1-5
--   SELECT id, title, rating FROM books WHERE rating < 1 OR rating > 5;
--
--   -- duplicate active loans of the same book by the same user
--   SELECT user_id, book_id, count(*) FROM borrow_records
--   WHERE status = 'BORROWED' GROUP BY user_id, book_id HAVING count(*) > 1;
--
-- Fix or manually resolve any rows found before applying this migration -
-- it will fail to apply otherwise.

ALTER TABLE "books" ADD CONSTRAINT "books_rating_range" CHECK ("books"."rating" >= 1 AND "books"."rating" <= 5);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "borrow_records_user_id_idx" ON "borrow_records" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "borrow_records_book_id_idx" ON "borrow_records" ("book_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "borrow_records_status_due_date_idx" ON "borrow_records" ("status", "due_date");--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "borrow_records_one_active_loan_per_book"
ON "borrow_records" ("user_id", "book_id")
WHERE "status" = 'BORROWED';
