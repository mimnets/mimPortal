import "dotenv/config";

import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  blockStyleDefaults,
  emptyLayout,
  sectionDefaults,
  type PageLayout,
} from "@mimnets/core";
import { createDatabase, pageVersions, pages } from "@mimnets/core/db";

/**
 * The Draft/Published transitions, against a real database.
 *
 * These are the promises M3 exists to keep — an edit is invisible until published, every
 * publish is recorded, and a restore is a proposal rather than an action on live content —
 * and until now not one of them had a test. The audit found that no test file imported this
 * module at all, which meant the codebase's only transaction was unexercised and a
 * regression in publishing would have surfaced on a client's Site rather than here.
 *
 *   docker compose up -d db
 *
 * Skipped, not failed, when that container is not running.
 *
 * A real database rather than a mocked one, for the same reason permissions.test.ts uses
 * one: what is being checked is a transaction and the row it leaves behind, and a mocked
 * Drizzle would only prove the mock copies fields the way the test told it to.
 */
const url = process.env.DATABASE_URL;

const reachable = url ? await answers(url) : false;

async function answers(connectionString: string): Promise<boolean> {
  const client = postgres(connectionString, { max: 1, connect_timeout: 2, onnotice: () => {} });
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

/**
 * Who the server thinks is asking. The role boundary itself is permissions.test.ts's
 * subject; here it is a fixture, so that what these tests fail on is a Draft/Published
 * mistake rather than a session one.
 */
const OWNER = {
  id: "00000000-0000-0000-0000-0000000000aa",
  name: "Test Owner",
  email: "owner@example.test",
  role: "owner" as const,
};

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("../../lib/session", () => ({
  requireUser: async () => OWNER,
  requireOwner: async () => OWNER,
  lockedSlotsFor: async () => [],
}));

const { createPage, deletePage, listVersions, publishPage, restoreVersion, saveDraft } =
  await import("./actions");

const db = reachable ? createDatabase(url!) : null;

/** A layout carrying one identifiable heading, so a document can be told apart by content. */
function layoutSaying(text: string): PageLayout {
  const layout = emptyLayout();
  layout.slots.main = [
    {
      id: "sec-1",
      layout: "1",
      columns: [
        {
          id: "col-1",
          blocks: [
            {
              id: "blk-1",
              type: "heading",
              props: { text, level: "h2" },
              style: blockStyleDefaults(),
            },
          ],
        },
      ],
      ...sectionDefaults(),
    },
  ];
  return layout;
}

function headingOf(layout: unknown): string | undefined {
  const doc = layout as PageLayout | null;
  return doc?.slots?.main?.[0]?.columns?.[0]?.blocks?.[0]?.props?.text as string | undefined;
}

async function readPage(id: string) {
  const [row] = await db!.select().from(pages).where(eq(pages.id, id)).limit(1);
  return row!;
}

const created: string[] = [];

async function newPage(): Promise<string> {
  const id = await createPage({
    title: "Transition fixture",
    path: `/test-transitions-${crypto.randomUUID()}`,
  });
  created.push(id);
  return id;
}

afterAll(async () => {
  if (!db) return;
  for (const id of created) await db.delete(pages).where(eq(pages.id, id)).catch(() => {});
});

suite("what a save does to a Page", () => {
  let pageId: string;

  beforeEach(async () => {
    pageId = await newPage();
  });

  it("writes the draft and leaves the published Page untouched", async () => {
    await saveDraft(pageId, layoutSaying("Only in the Dashboard"));

    const row = await readPage(pageId);
    expect(headingOf(row.draftLayout)).toBe("Only in the Dashboard");
    expect(row.publishedLayout).toBeNull();
  });

  it("does not record a version — a save is not a publish", async () => {
    await saveDraft(pageId, layoutSaying("Draft one"));
    await saveDraft(pageId, layoutSaying("Draft two"));

    expect(await listVersions(pageId)).toHaveLength(0);
  });

  it("refuses a layout the registry cannot parse", async () => {
    await expect(saveDraft(pageId, { slots: { main: "not a list" } })).rejects.toThrow();

    const row = await readPage(pageId);
    expect(row.draftLayout).not.toBeNull();
    expect(headingOf(row.draftLayout)).toBeUndefined();
  });
});

suite("what publishing does to a Page", () => {
  let pageId: string;

  beforeEach(async () => {
    pageId = await newPage();
  });

  it("makes the draft public", async () => {
    await publishPage(pageId, layoutSaying("Now visible"));

    const row = await readPage(pageId);
    expect(headingOf(row.publishedLayout)).toBe("Now visible");
    expect(headingOf(row.draftLayout)).toBe("Now visible");
  });

  it("records a version every time, in the same transaction", async () => {
    await publishPage(pageId, layoutSaying("First"));
    expect(await listVersions(pageId)).toHaveLength(1);

    await publishPage(pageId, layoutSaying("Second"));
    expect(await listVersions(pageId)).toHaveLength(2);
  });

  it("lists versions newest first", async () => {
    await publishPage(pageId, layoutSaying("Older"));
    await publishPage(pageId, layoutSaying("Newer"));

    const versions = await listVersions(pageId);
    const [newer, older] = versions;
    expect(Date.parse(newer!.publishedAt)).toBeGreaterThanOrEqual(Date.parse(older!.publishedAt));

    const rows = await db!
      .select()
      .from(pageVersions)
      .where(eq(pageVersions.id, newer!.id))
      .limit(1);
    expect(headingOf(rows[0]!.layout)).toBe("Newer");
  });

  it("leaves nothing behind when the layout is refused", async () => {
    await expect(publishPage(pageId, { slots: { main: 42 } })).rejects.toThrow();

    const row = await readPage(pageId);
    expect(row.publishedLayout).toBeNull();
    expect(await listVersions(pageId)).toHaveLength(0);
  });
});

suite("what restoring does to a Page", () => {
  let pageId: string;

  beforeEach(async () => {
    pageId = await newPage();
  });

  it("writes the old version into the draft without changing the public Page", async () => {
    await publishPage(pageId, layoutSaying("The version they liked"));
    const [first] = await listVersions(pageId);
    await publishPage(pageId, layoutSaying("The version they regret"));

    const restored = await restoreVersion(pageId, first!.id);

    expect(headingOf(restored)).toBe("The version they liked");

    const row = await readPage(pageId);
    expect(headingOf(row.draftLayout)).toBe("The version they liked");
    // The whole argument for restoring into the draft: a restore is a proposal, and the
    // public Site does not move until the Author publishes it.
    expect(headingOf(row.publishedLayout)).toBe("The version they regret");
  });

  it("refuses a version belonging to a different Page", async () => {
    const otherId = await newPage();
    await publishPage(otherId, layoutSaying("Someone else's history"));
    const [theirs] = await listVersions(otherId);

    await expect(restoreVersion(pageId, theirs!.id)).rejects.toThrow(/no longer exists/);
  });
});

suite("what deleting a Page takes with it", () => {
  it("removes the Page's versions too", async () => {
    const pageId = await newPage();
    await publishPage(pageId, layoutSaying("Published once"));
    expect(await listVersions(pageId)).toHaveLength(1);

    await deletePage(pageId);

    expect(await listVersions(pageId)).toHaveLength(0);
    const [row] = await db!.select().from(pages).where(eq(pages.id, pageId)).limit(1);
    expect(row).toBeUndefined();
  });
});
