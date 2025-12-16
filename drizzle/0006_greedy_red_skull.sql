ALTER TABLE "tournaments" ADD COLUMN "is_locked_manual" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "lock_at" timestamp;