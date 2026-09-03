CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"title" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"draft_layout" jsonb,
	"published_layout" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pages_path_locale_idx" ON "pages" USING btree ("path","locale");