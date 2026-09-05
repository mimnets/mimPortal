import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// `generate` only reads the schema, so it works without a database. `migrate` connects, and
// fails loudly here if DATABASE_URL is missing.
const url = process.env.DATABASE_URL ?? "";

export default defineConfig({
  dialect: "postgresql",
  // The installed package, not the monorepo source. Copied from the Starter, this said
  // `../packages/core/src/…`, which is correct there and resolves to `sites/packages/…` here
  // — a directory that has never existed, so `db:generate` failed outright.
  //
  // Pointing at `dist` rather than `src` is the part that generalises: a Site outside this
  // repository has no `src` to point at, because `files` ships only the build. drizzle-kit
  // reads the compiled schema perfectly well — verified by generating against the nine
  // committed migrations, which reports no schema changes.
  schema: [
    "./node_modules/@mimnets/core/dist/db/schema.js",
    "./node_modules/@mimnets/core/dist/db/auth-schema.js",
  ],
  out: "./drizzle",
  dbCredentials: { url },
});
