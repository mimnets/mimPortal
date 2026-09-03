CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"alt" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "seo_title" text;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "seo_description" text;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "seo_image_key" text;--> statement-breakpoint
CREATE INDEX "media_created_idx" ON "media" USING btree ("created_at");