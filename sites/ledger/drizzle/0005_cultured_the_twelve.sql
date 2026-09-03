CREATE TABLE "form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"path" text DEFAULT '' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"sender_hash" text DEFAULT '' NOT NULL,
	"read_at" timestamp with time zone,
	"delivery_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "form_submissions_created_idx" ON "form_submissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "form_submissions_sender_idx" ON "form_submissions" USING btree ("sender_hash","created_at");