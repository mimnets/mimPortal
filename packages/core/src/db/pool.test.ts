import { describe, expect, it } from "vitest";

import { createDatabase } from "./index";

/**
 * These are about connection lifetime, not about queries, so they need no server.
 *
 * The bug they exist to prevent was real and cost an afternoon: `createDatabase` is called
 * from every page render, every route handler and every server action — the public Page
 * calls it twice, once for its metadata and once for its body — and each call opened a pool
 * that nothing closed. Postgres started refusing connections at 100, which under real
 * traffic is a Site that stops serving.
 */
describe("database pooling", () => {
  const url = "postgres://someone:secret@localhost:5432/never-connected";

  it("hands back the same pool for the same connection string", () => {
    // postgres.js connects lazily, so building these opens nothing.
    expect(createDatabase(url)).toBe(createDatabase(url));
  });

  it("keeps one pool per Site, because a Site owns its own database", () => {
    const other = createDatabase("postgres://someone:secret@localhost:5432/another-site");
    expect(other).not.toBe(createDatabase(url));
  });

  it("survives a module being re-evaluated, which is what a dev server does on every edit", () => {
    // The registry lives on globalThis under a Symbol.for key precisely so a reload finds
    // the pools the previous evaluation made. A module-level Map would leak per edit.
    const registry = (globalThis as Record<symbol, unknown>)[Symbol.for("mimnets.database.pools")];
    expect(registry).toBeInstanceOf(Map);
    expect((registry as Map<string, unknown>).has(url)).toBe(true);
  });
});
