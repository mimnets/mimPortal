CREATE TABLE "shared_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"slot" text NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_slots_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "header_slot_id" uuid;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "footer_slot_id" uuid;--> statement-breakpoint
CREATE INDEX "shared_slots_slot_idx" ON "shared_slots" USING btree ("slot");