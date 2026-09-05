import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// A Site's configuration lives in starter/.env, not at the repo root, so integration tests
// find the database the same way the app does.
const loaded = config({ path: new URL("./starter/.env", import.meta.url).pathname.slice(1) });

export default defineConfig({
  test: {
    environment: "node",
    env: loaded.parsed ?? {},
    include: ["packages/**/*.test.{ts,tsx}", "starter/**/*.test.{ts,tsx}"],
  },
});
