ALTER TYPE "public"."role" ADD VALUE IF NOT EXISTS 'STAFF';--> statement-breakpoint

-- Users: drop the photo-ID requirement entirely, identify members by a
-- plain numeric SVYM staff ID instead.
ALTER TABLE "users" RENAME COLUMN "university_id" TO "staff_id";--> statement-breakpoint
ALTER TABLE "users" RENAME CONSTRAINT "users_university_id_unique" TO "users_staff_id_unique";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "university_card";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "member_type" varchar(50) DEFAULT 'COMMUNITY' NOT NULL;--> statement-breakpoint

-- Books: manufacturer barcode (ISBN/EAN) captured at intake, plus the
-- library's own internal barcode value that gets printed on the sticker.
-- Existing rows get a generated placeholder so the NOT NULL/UNIQUE
-- constraint can be added; replace these for any books added before this
-- migration ran.
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "isbn" varchar(32);--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "library_barcode" text;--> statement-breakpoint
UPDATE "books" SET "library_barcode" = 'SVYM-' || upper(substr(replace(id::text, '-', ''), 1, 8)) WHERE "library_barcode" IS NULL;--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "library_barcode" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_library_barcode_unique" UNIQUE("library_barcode");

