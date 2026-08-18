"use server";

import { and, desc, eq } from "drizzle-orm";
import type { PageLayout } from "@mimnets/core";
import { assertLockedSlotsUnchanged } from "@mimnets/core";
import { createDatabase, pageVersions, pages } from "@mimnets/core/db";

import { registry } from "../../blocks.config";
import { requireDatabaseUrl } from "../../lib/env";
import { lockedSlotsFor, requireUser } from "../../lib/session";

/**
 * Every mutation validates the layout and re-checks the caller's role on the server. The
 * Editor is a convenience; this is the boundary.
 */

export interface PageVersionSummary {
  id: string;
  publishedAt: string;
}

function database() {
  return createDatabase(requireDatabaseUrl());
}

async function findHomePage(db: ReturnType<typeof database>) {
  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.path, "/"), eq(pages.locale, "en")))
    .limit(1);
  if (!page) throw new Error("No Page exists at /.");
  return page;
}

export async function listVersions(pageId: string): Promise<PageVersionSummary[]> {
  const db = database();
  const rows = await db
    .select({ id: pageVersions.id, publishedAt: pageVersions.publishedAt })
    .from(pageVersions)
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.publishedAt))
    .limit(50);

  return rows.map((row) => ({ id: row.id, publishedAt: row.publishedAt.toISOString() }));
}

async function guardedLayout(incoming: unknown): Promise<{
  parsed: PageLayout;
  pageId: string;
}> {
  const person = await requireUser();
  const parsed = registry.parseLayout(incoming);

  const db = database();
  const page = await findHomePage(db);
  const locked = await lockedSlotsFor(person);

  if (locked.length > 0) {
    const { layout: current } = registry.safeParseLayout(page.draftLayout ?? page.publishedLayout);
    assertLockedSlotsUnchanged(parsed, current, locked);
  }

  return { parsed, pageId: page.id };
}

export async function saveDraft(layout: unknown): Promise<void> {
  const { parsed, pageId } = await guardedLayout(layout);

  await database()
    .update(pages)
    .set({ draftLayout: parsed, updatedAt: new Date() })
    .where(eq(pages.id, pageId));
}

/**
 * Publishing writes the draft to the public Site and records a snapshot in the same
 * transaction. A publish that half-happened — live but unrecorded — would defeat the point
 * of keeping history at all.
 */
export async function publishPage(layout: unknown): Promise<PageVersionSummary[]> {
  const { parsed, pageId } = await guardedLayout(layout);
  const db = database();

  await db.transaction(async (tx) => {
    await tx
      .update(pages)
      .set({ draftLayout: parsed, publishedLayout: parsed, updatedAt: new Date() })
      .where(eq(pages.id, pageId));

    await tx.insert(pageVersions).values({ pageId, layout: parsed });
  });

  return listVersions(pageId);
}

/**
 * Restoring loads an old version into the draft and returns it, so the Editor can show it
 * immediately. The public Site does not change until the Author publishes — a restore is a
 * proposal, not an action on live content.
 */
export async function restoreVersion(versionId: string): Promise<PageLayout> {
  const person = await requireUser();
  const db = database();
  const page = await findHomePage(db);

  const [version] = await db
    .select()
    .from(pageVersions)
    .where(and(eq(pageVersions.id, versionId), eq(pageVersions.pageId, page.id)))
    .limit(1);

  if (!version) throw new Error("That version no longer exists.");

  // Old snapshots are re-validated: a Block Type this Site has since dropped must fail here
  // rather than be restored into a Page that cannot render.
  const parsed = registry.parseLayout(version.layout);

  const locked = await lockedSlotsFor(person);
  if (locked.length > 0) {
    const { layout: current } = registry.safeParseLayout(page.draftLayout ?? page.publishedLayout);
    // Restoring a version that predates a Header change would quietly rewrite a locked Slot.
    assertLockedSlotsUnchanged(parsed, current, locked);
  }

  await db
    .update(pages)
    .set({ draftLayout: parsed, updatedAt: new Date() })
    .where(eq(pages.id, page.id));

  return parsed;
}
