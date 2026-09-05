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

const {
  copyPageStructure,
  createPage,
  deletePage,
  listVersions,
  publishPage,
  restoreVersion,
  saveDraft,
} = await import("./actions");

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

suite("a tab that has gone stale", () => {
  let pageId: string;

  beforeEach(async () => {
    pageId = await newPage();
  });

  /** What the Editor holds: the Page's revision as it was when the screen was rendered. */
  async function revision(): Promise<number> {
    return (await readPage(pageId)).revision;
  }

  it("saves when it is writing against the current revision", async () => {
    const next = await saveDraft(pageId, layoutSaying("On time"), await revision());

    expect(headingOf((await readPage(pageId)).draftLayout)).toBe("On time");
    expect(next).toBe(await revision());
  });

  it("keeps saving through a long session, because each save returns the next revision", async () => {
    let held: number = await revision();
    held = await saveDraft(pageId, layoutSaying("One"), held);
    held = await saveDraft(pageId, layoutSaying("Two"), held);
    await saveDraft(pageId, layoutSaying("Three"), held);

    expect(headingOf((await readPage(pageId)).draftLayout)).toBe("Three");
  });

  it("refuses a save built on a revision somebody else has replaced", async () => {
    const opened = await revision();

    // Somebody else — another person, or the same person in another tab — saves first.
    await saveDraft(pageId, layoutSaying("Their work"), opened);

    await expect(saveDraft(pageId, layoutSaying("Overwriting them"), opened)).rejects.toThrow(
      /changed somewhere else/,
    );

    // The point of the refusal: their work is still there.
    expect(headingOf((await readPage(pageId)).draftLayout)).toBe("Their work");
  });

  it("refuses a publish from a stale tab, and leaves the public Page alone", async () => {
    await publishPage(pageId, layoutSaying("What visitors see"));
    const stale = (await readPage(pageId)).revision - 1;

    await expect(
      publishPage(pageId, layoutSaying("A version from before their edit"), stale),
    ).rejects.toThrow(/changed somewhere else/);

    const row = await readPage(pageId);
    expect(headingOf(row.publishedLayout)).toBe("What visitors see");
    // Refused before the transaction, so no snapshot was taken either.
    expect(await listVersions(pageId)).toHaveLength(1);
  });

  it("skips the check when no revision is offered, for callers that have none", async () => {
    await saveDraft(pageId, layoutSaying("No revision given"));

    expect(headingOf((await readPage(pageId)).draftLayout)).toBe("No revision given");
  });

  /**
   * The reason the revision is a column and the check is in the UPDATE's WHERE clause.
   *
   * Both of these read the same revision before either writes, so a check performed in
   * JavaScript would pass for both and the second would silently replace the first. Postgres
   * decides instead: the first UPDATE moves the revision, the second matches no row.
   */
  it("lets exactly one of two simultaneous saves through", async () => {
    const shared = await revision();

    const results = await Promise.allSettled([
      saveDraft(pageId, layoutSaying("First writer"), shared),
      saveDraft(pageId, layoutSaying("Second writer"), shared),
    ]);

    const won = results.filter((one) => one.status === "fulfilled");
    const lost = results.filter((one) => one.status === "rejected");

    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect((lost[0] as PromiseRejectedResult).reason.message).toMatch(/changed somewhere else/);

    // And the winner's work is what is stored — not a mixture, and not the loser's.
    const stored = headingOf((await readPage(pageId)).draftLayout);
    expect(["First writer", "Second writer"]).toContain(stored);
    expect(await revision()).toBe(shared + 1);
  });

  it("moves the revision on every write, so History and the Editor stay in step", async () => {
    const start = await revision();

    await saveDraft(pageId, layoutSaying("One"), start);
    expect(await revision()).toBe(start + 1);

    await publishPage(pageId, layoutSaying("Two"), start + 1);
    expect(await revision()).toBe(start + 2);
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


suite("a draft replaced from somewhere other than the Editor", () => {
  /**
   * The stale-tab guard, on the paths that are not `saveDraft`.
   *
   * `atRevision` and the `revision` bump used to live only in `saveDraft` and `publishPage`,
   * so four other writers replaced a Page's draft wholesale and left `revision` alone. An
   * Author with the Page open at revision 7 then pressed Save, the check matched a number
   * that had never moved, and the write silently destroyed the restore — with no STALE
   * message in either tab.
   *
   * What these assert is not the number but the consequence: after any of these, an Editor
   * holding the old revision is refused.
   */
  let pageId: string;

  beforeEach(async () => {
    pageId = await newPage();
  });

  it("moves the revision on when a version is restored", async () => {
    await saveDraft(pageId, layoutSaying("First"));
    await publishPage(pageId, layoutSaying("First"));
    await saveDraft(pageId, layoutSaying("Second"));

    const before = (await readPage(pageId)).revision;
    const [version] = await listVersions(pageId);
    await restoreVersion(pageId, version!.id);

    expect((await readPage(pageId)).revision).toBeGreaterThan(before);
  });

  it("refuses a save from a tab that was open across the restore", async () => {
    await saveDraft(pageId, layoutSaying("First"));
    await publishPage(pageId, layoutSaying("First"));
    await saveDraft(pageId, layoutSaying("Second"));

    // What the Editor is holding.
    const openTabRevision = (await readPage(pageId)).revision;

    const [version] = await listVersions(pageId);
    await restoreVersion(pageId, version!.id);

    // The Author, who saw none of that, presses Save.
    await expect(
      saveDraft(pageId, layoutSaying("Typed before the restore"), openTabRevision),
    ).rejects.toThrow();

    // And the restore survived rather than being overwritten.
    expect(headingOf((await readPage(pageId)).draftLayout)).toBe("First");
  });

  it("moves the revision on when structure is copied from another Page", async () => {
    const source = await newPage();
    await saveDraft(source, layoutSaying("Copied from here"));

    await saveDraft(pageId, layoutSaying("Original"));
    const before = (await readPage(pageId)).revision;

    await copyPageStructure({ pageId, fromPageId: source });

    expect((await readPage(pageId)).revision).toBeGreaterThan(before);
  });

  it("still lets a save through when nothing replaced the draft underneath it", async () => {
    await saveDraft(pageId, layoutSaying("First"));
    const revision = (await readPage(pageId)).revision;

    // The guard must refuse stale tabs without refusing ordinary ones.
    await expect(
      saveDraft(pageId, layoutSaying("Second"), revision),
    ).resolves.toBeTypeOf("number");
  });
});
