import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// `generate` only reads the schema, so it works without a database. `migrate` connects, and
// fails loudly here if DATABASE_URL is missing.
const url = process.env.DATABASE_URL ?? "";

export default defineConfig({
  dialect: "postgresql",
  schema: "../packages/core/src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
