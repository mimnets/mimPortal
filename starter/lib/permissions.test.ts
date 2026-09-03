import "dotenv/config";

import {
  assertLockedSlotsUnchanged,
  blockStyleDefaults,
  emptyLayout,
  sectionDefaults,
  type PageLayout,
} from "@mimnets/core";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

import { lockedSlotsForRole } from "./permissions";

/**
 * These run against the Site's real database, because what is being checked is the
 * composition of a stored policy with the rule that enforces it — mocking the storage would
 * only test the mock.
 *
 *   docker compose up -d db
 *
 * Skipped, not failed, when that container is not running — the same contract every other
 * container-backed suite here keeps.
 *
 * The gate asks whether the database *answers*, not whether `DATABASE_URL` is set. Those are
 * not the same question and treating them as one is what used to break this file: `.env`
 * always sets the variable, so the suite always believed a database was there and failed
 * with ECONNREFUSED on a machine that simply had nothing running. A contributor without
 * Docker got a red suite and no way to tell it from a real regression.
 */
const url = process.env.DATABASE_URL;

const reachable = url ? await answers(url) : false;

async function answers(connectionString: string): Promise<boolean> {
  const client = postgres(connectionString, {
    max: 1,
    connect_timeout: 2,
    onnotice: () => {},
  });
  try {
    await client`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await client.end({ timeout: 2 }).catch(() => {});
  }
}

const suite = reachable ? describe : describe.skip;

function layoutWithHeader(text: string): PageLayout {
  const layout = emptyLayout();
  layout.slots.header = [
    {
      id: "sec-h",
      layout: "1",
      columns: [{ id: "col-h", blocks: [{ id: "blk-h", type: "text", props: { body: text }, style: blockStyleDefaults() }] }],
      ...sectionDefaults(),
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
