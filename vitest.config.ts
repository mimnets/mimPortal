import { defineConfig } from "vitest/config";

export default defineConfig({
  // Packages are consumed as TypeScript source, and their tsconfig leaves JSX for the
  // bundler to handle. Vitest has to be told which transform to apply.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["packages/**/*.test.{ts,tsx}", "starter/**/*.test.{ts,tsx}"],
  },
});
