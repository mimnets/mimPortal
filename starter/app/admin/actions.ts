"use server";

import { and, desc, eq } from "drizzle-orm";
import type { PageLayout } from "@mimnets/core";
import { createDatabase, pageVersions, pages } from "@mimnets/core/db";

import { registry } from "../../blocks.config";

/**
 * Everything here validates the layout on the server before the database sees it. The
 * Editor is a convenience, not the boundary. Roles are checked at M4; until then every
 * caller is treated as the Owner.
 */

export interface PageVersionSummary {
  id: string;
  publishedAt: string;
}

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  return createDatabase(url);
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

export async function saveDraft(layout: unknown): Promise<void> {
  const parsed = registry.parseLayout(layout);
  const db = database();

  await db
    .update(pages)
    .set({ draftLayout: parsed, updatedAt: new Date() })
    .where(and(eq(pages.path, "/"), eq(pages.locale, "en")));
}

/**
 * Publishing writes the draft to the public Site and records a snapshot in the same
 * transaction. A publish that half-happened — live but unrecorded — would defeat the point
 * of keeping history at all.
 */
export async function publishPage(layout: unknown): Promise<PageVersionSummary[]> {
  const parsed = registry.parseLayout(layout);
  const db = database();
  const page = await findHomePage(db);

  await db.transaction(async (tx) => {
    await tx
      .update(pages)
      .set({ draftLayout: parsed, publishedLayout: parsed, updatedAt: new Date() })
      .where(eq(pages.id, page.id));

    await tx.insert(pageVersions).values({ pageId: page.id, layout: parsed });
  });

  return listVersions(page.id);
}

/**
 * Restoring loads an old version into the draft and returns it, so the Editor can show it
 * immediately. The public Site does not change until the Author publishes — a restore is a
 * proposal, not an action on live content.
 */
export async function restoreVersion(versionId: string): Promise<PageLayout> {
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

  await db
    .update(pages)
    .set({ draftLayout: parsed, updatedAt: new Date() })
    .where(eq(pages.id, page.id));

  return parsed;
}
