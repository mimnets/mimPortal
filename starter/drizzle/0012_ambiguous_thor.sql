CREATE TABLE "blueprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"section" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
