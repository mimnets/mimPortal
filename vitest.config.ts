import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// A Site's configuration lives in starter/.env, not at the repo root, so integration tests
// find the database the same way the app does.
const loaded = config({ path: new URL("./starter/.env", import.meta.url).pathname.slice(1) });

export default defineConfig({
  // Packages are consumed as TypeScript source, and their tsconfig leaves JSX for the
  // bundler to handle. Vitest has to be told which transform to apply.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    env: loaded.parsed ?? {},
    include: ["packages/**/*.test.{ts,tsx}", "starter/**/*.test.{ts,tsx}"],
  },
});
