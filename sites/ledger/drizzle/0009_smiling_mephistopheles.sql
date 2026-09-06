ALTER TABLE "form_submissions" ADD COLUMN "extra" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "source" text DEFAULT 'upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "source_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "credit" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "credit_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "media_source_idx" ON "media" USING btree ("source");