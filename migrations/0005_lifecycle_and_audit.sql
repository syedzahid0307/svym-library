ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid,
  "action" varchar(100) NOT NULL,
  "entity_type" varchar(50) NOT NULL,
  "entity_id" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_log_entity_idx" ON "audit_log" ("entity_type", "entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_actor_id_idx" ON "audit_log" ("actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_created_at_idx" ON "audit_log" ("created_at");
