ALTER TABLE "share_links" ADD COLUMN "failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "locked_until" timestamp;