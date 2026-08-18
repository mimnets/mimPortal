"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { PageLayout } from "@mimnets/core";
import { assertLockedSlotsUnchanged, emptyLayout, menuItemsSchema } from "@mimnets/core";
import { createDatabase, menus, pageVersions, pages } from "@mimnets/core/db";

import { registry } from "../../blocks.config";
import { requireDatabaseUrl } from "../../lib/env";
import { lockedSlotsFor, requireOwner, requireUser } from "../../lib/session";

/**
 * Every mutation validates its input and re-checks the caller's role on the server. The
 * Editor is a convenience; this is the boundary.
 */

export interface PageVersionSummary {
  id: string;
  publishedAt: string;
}

function database() {
  return createDatabase(requireDatabaseUrl());
}

function normalisePath(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, "-").toLowerCase();
  if (trimmed === "" || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

/* ---- Pages ------------------------------------------------------------- */

export async function createPage(input: { title: string; path: string }): Promise<string> {
  // Creating and deleting Pages is structural, so it belongs to the Owner. An Author works
  // inside the Pages they are given.
  await requireOwner();

  const path = normalisePath(input.path);
  const title = input.title.trim() || "Untitled";

  const existing = await database()
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.path, path), eq(pages.locale, "en")))
    .limit(1);

  if (existing.length > 0) throw new Error(`A Page already exists at ${path}.`);

  const [created] = await database()
    .insert(pages)
    .values({ path, title, locale: "en", draftLayout: emptyLayout() })
    .returning({ id: pages.id });

  revalidatePath("/admin");
  return created!.id;
}

export async function deletePage(pageId: string): Promise<void> {
  await requireOwner();
  await database().delete(pages).where(eq(pages.id, pageId));
  revalidatePath("/admin");
}

export async function renamePage(input: {
  pageId: string;
  title: string;
  path: string;
}): Promise<void> {
  await requireOwner();
  await database()
    .update(pages)
    .set({ title: input.title.trim(), path: normalisePath(input.path), updatedAt: new Date() })
    .where(eq(pages.id, input.pageId));
  revalidatePath("/admin");
}

/* ---- Layout ------------------------------------------------------------ */

export async function listVersions(pageId: string): Promise<PageVersionSummary[]> {
  const rows = await database()
    .select({ id: pageVersions.id, publishedAt: pageVersions.publishedAt })
    .from(pageVersions)
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.publishedAt))
    .limit(50);

  return rows.map((row) => ({ id: row.id, publishedAt: row.publishedAt.toISOString() }));
}

async function guardedLayout(pageId: string, incoming: unknown): Promise<PageLayout> {
  const person = await requireUser();
  const parsed = registry.parseLayout(incoming);
  const locked = await lockedSlotsFor(person);

  if (locked.length > 0) {
    const [page] = await database().select().from(pages).where(eq(pages.id, pageId)).limit(1);
    if (!page) throw new Error("That Page no longer exists.");
    const { layout: current } = registry.safeParseLayout(page.draftLayout ?? page.publishedLayout);
    assertLockedSlotsUnchanged(parsed, current, locked);
  }

  return parsed;
}

export async function saveDraft(pageId: string, layout: unknown): Promise<void> {
  const parsed = await guardedLayout(pageId, layout);

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
export async function publishPage(pageId: string, layout: unknown): Promise<PageVersionSummary[]> {
  const parsed = await guardedLayout(pageId, layout);
  const db = database();

  const [page] = await db.select({ path: pages.path }).from(pages).where(eq(pages.id, pageId));

  await db.transaction(async (tx) => {
    await tx
      .update(pages)
      .set({ draftLayout: parsed, publishedLayout: parsed, updatedAt: new Date() })
      .where(eq(pages.id, pageId));

    await tx.insert(pageVersions).values({ pageId, layout: parsed });
  });

  if (page) revalidatePath(page.path);
  return listVersions(pageId);
}

/**
 * Restoring loads an old version into the draft and returns it. The public Site does not
 * change until the Author publishes — a restore is a proposal, not an action on live content.
 */
export async function restoreVersion(pageId: string, versionId: string): Promise<PageLayout> {
  const person = await requireUser();
  const db = database();

  const [version] = await db
    .select()
    .from(pageVersions)
    .where(and(eq(pageVersions.id, versionId), eq(pageVersions.pageId, pageId)))
    .limit(1);

  if (!version) throw new Error("That version no longer exists.");

  // Old snapshots are re-validated: a Block Type this Site has since dropped must fail here
  // rather than be restored into a Page that cannot render.
  const parsed = registry.parseLayout(version.layout);

  const locked = await lockedSlotsFor(person);
  if (locked.length > 0) {
    const [page] = await db.select().from(pages).where(eq(pages.id, pageId)).limit(1);
    const { layout: current } = registry.safeParseLayout(page?.draftLayout ?? page?.publishedLayout);
    // Restoring a version that predates a Header change would quietly rewrite a locked Slot.
    assertLockedSlotsUnchanged(parsed, current, locked);
  }

  await db
    .update(pages)
    .set({ draftLayout: parsed, updatedAt: new Date() })
    .where(eq(pages.id, pageId));

  return parsed;
}

/* ---- Menus -------------------------------------------------------------- */

export async function saveMenu(slug: string, items: unknown): Promise<void> {
  // A Menu appears in the Header and the Footer of every Page, so editing one is structural
  // rather than per-Page content.
  await requireOwner();

  const parsed = menuItemsSchema.parse(items);
  const db = database();

  const existing = await db.select({ id: menus.id }).from(menus).where(eq(menus.slug, slug)).limit(1);

  if (existing.length > 0) {
    await db.update(menus).set({ items: parsed, updatedAt: new Date() }).where(eq(menus.slug, slug));
  } else {
    await db.insert(menus).values({ slug, name: slug, items: parsed });
  }

  revalidatePath("/", "layout");
}

export async function listPages() {
  await requireUser();
  return database()
    .select({
      id: pages.id,
      path: pages.path,
      title: pages.title,
      published: pages.publishedLayout,
      updatedAt: pages.updatedAt,
    })
    .from(pages)
    .orderBy(asc(pages.path));
}
