import "dotenv/config";

import { assertLockedSlotsUnchanged, emptyLayout, type PageLayout } from "@mimnets/core";
import { describe, expect, it } from "vitest";

import { lockedSlotsForRole } from "./permissions";

/**
 * These run against the Site's real database, because what is being checked is the
 * composition of a stored policy with the rule that enforces it — mocking the storage would
 * only test the mock. Skipped when no database is configured.
 */
const url = process.env.DATABASE_URL;
const suite = url ? describe : describe.skip;

function layoutWithHeader(text: string): PageLayout {
  const layout = emptyLayout();
  layout.slots.header = [
    {
      id: "sec-h",
      layout: "1",
      columns: [{ id: "col-h", blocks: [{ id: "blk-h", type: "text", props: { body: text } }] }],
    },
  ];
  return layout;
}

suite("what a role may change", () => {
  it("locks nothing for an Owner", async () => {
    expect(await lockedSlotsForRole("owner", url!)).toEqual([]);
  });

  it("locks the Header and Footer for an Author", async () => {
    expect(await lockedSlotsForRole("author", url!)).toEqual(["header", "footer"]);
  });

  it("refuses an Author's Header edit, using the Site's stored policy", async () => {
    const locked = await lockedSlotsForRole("author", url!);
    const current = layoutWithHeader("Original");
    const incoming = layoutWithHeader("Rewritten by the client");

    expect(() => assertLockedSlotsUnchanged(incoming, current, locked)).toThrow(
      /header is locked/,
    );
  });

  it("allows the same edit for an Owner", async () => {
    const locked = await lockedSlotsForRole("owner", url!);
    expect(() =>
      assertLockedSlotsUnchanged(layoutWithHeader("b"), layoutWithHeader("a"), locked),
    ).not.toThrow();
  });
});
