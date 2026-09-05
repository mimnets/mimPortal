"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { PageLayout } from "@mimnets/core";
import { createDatabase, pages, sharedSlots } from "@mimnets/core/db";

import { registry } from "../../blocks.config";
import { requireDatabaseUrl } from "../../lib/env";
import { requireOwner } from "../../lib/session";
import { isShareableSlot, type ShareableSlot } from "../../lib/slots";

/**
 * Shared Headers and Footers.
 *
 * All Owner-only. A Header appears on every Page that uses it, so changing one is the most
 * structural edit in the product — further-reaching than deleting a Page, which affects one.
 * An Author editing content should never be able to do it by accident.
 *
 * These save immediately rather than going through draft and publish, the same as Menus. A
 * shared Slot with its own draft state would mean a Page could be published while the Header
 * it renders is not, and there is no good answer to what a visitor should see then.
 */

export interface SharedSlotSummary {
  id: string;
  slug: string;
  name: string;
  slot: ShareableSlot;
  updatedAt: string;
  /** How many Pages use it, so deleting one can say what it will affect. */
  usedBy: number;
}

function database() {
  return createDatabase(requireDatabaseUrl());
}

/** Validates sections by parsing them as a Page's Header — same schema, same registry. */
function parseSections(sections: unknown): PageLayout["slots"]["header"] {
  const parsed = registry.parseLayout({
    version: 1,
    slots: { header: sections, main: [], sidebar: [], footer: [] },
  });
  return parsed.slots.header;
}

export async function listSharedSlotSummaries(): Promise<SharedSlotSummary[]> {
  await requireOwner();
  const db = database();

  const rows = await db.select().from(sharedSlots).orderBy(sharedSlots.slot, sharedSlots.name);
  const allPages = await db
    .select({ header: pages.headerSlotId, footer: pages.footerSlotId })
    .from(pages);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    slot: row.slot as ShareableSlot,
    updatedAt: row.updatedAt.toISOString(),
    usedBy: allPages.filter((page) =>
      row.slot === "header" ? page.header === row.id : page.footer === row.id,
    ).length,
  }));
}

export async function createSharedSlot(input: {
  name: string;
  slot: string;
  /** Copy the sections from an existing Slot, so "like that one but shorter" is two clicks. */
  copyFromId?: string;
}): Promise<string> {
  await requireOwner();
  if (!isShareableSlot(input.slot)) throw new Error("Only a Header or a Footer can be shared.");

  const db = database();
  const name = input.name.trim() || (input.slot === "header" ? "Header" : "Footer");

  let sections: unknown = [];
  if (input.copyFromId) {
    const [source] = await db
      .select()
      .from(sharedSlots)
      .where(eq(sharedSlots.id, input.copyFromId))
      .limit(1);
    if (source && source.slot === input.slot) sections = source.sections;
  }

  const [created] = await db
    .insert(sharedSlots)
    .values({ slug: await uniqueSlug(name), name, slot: input.slot, sections })
    .returning({ id: sharedSlots.id });

  revalidatePath("/admin/slots");
  return created!.id;
}

async function uniqueSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "slot";

  const db = database();
  for (let attempt = 0; ; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const [taken] = await db
      .select({ id: sharedSlots.id })
      .from(sharedSlots)
      .where(eq(sharedSlots.slug, slug))
      .limit(1);
    if (!taken) return slug;
  }
}

export async function saveSharedSlot(id: string, sections: unknown): Promise<void> {
  await requireOwner();

  // Validated before it is written, exactly like a Page's layout. A broken Header would
  // otherwise take out every Page at once.
  const parsed = parseSections(sections);

  await database()
    .update(sharedSlots)
    .set({ sections: parsed, updatedAt: new Date() })
    .where(eq(sharedSlots.id, id));

  // Every Page could be showing this, so the whole Site is revalidated.
  revalidatePath("/", "layout");
  revalidatePath("/admin/slots");
}

export async function renameSharedSlot(id: string, name: string): Promise<void> {
  await requireOwner();
  await database()
    .update(sharedSlots)
    .set({ name: name.trim() || "Untitled", updatedAt: new Date() })
    .where(eq(sharedSlots.id, id));
  revalidatePath("/admin/slots");
}

/**
 * Deleting releases every Page using it back to its own Header or Footer, which is the one
 * stored in its layout document and has been sitting there untouched the whole time.
 */
export async function deleteSharedSlot(id: string): Promise<void> {
  await requireOwner();
  const db = database();

  await db.update(pages).set({ headerSlotId: null }).where(eq(pages.headerSlotId, id));
  await db.update(pages).set({ footerSlotId: null }).where(eq(pages.footerSlotId, id));
  await db.delete(sharedSlots).where(eq(sharedSlots.id, id));

  revalidatePath("/", "layout");
  revalidatePath("/admin/slots");
}

/** Which shared Header and Footer one Page uses. Null means "this Page keeps its own". */
export async function setPageSlots(input: {
  pageId: string;
  headerSlotId: string | null;
  footerSlotId: string | null;
}): Promise<void> {
  await requireOwner();
  const db = database();

  const [page] = await db.select().from(pages).where(eq(pages.id, input.pageId)).limit(1);
  if (!page) throw new Error("That Page no longer exists.");

  const layout = registry.safeParseLayout(page.draftLayout ?? page.publishedLayout).layout;
  let draft = layout;

  /**
   * Switching a Slot to "This Page only" copies the shared one into the Page first, when
   * the Page has nothing of its own there.
   *
   * Without this, choosing "custom" deletes the Header — the Page's own sections have been
   * empty since it was created, because it was always using a shared one. Nobody means
   * "remove my navigation" when they pick "This Page only"; they mean "start from this and
   * change it".
   */
  for (const [slot, wasId, nowId] of [
    ["header", page.headerSlotId, input.headerSlotId],
    ["footer", page.footerSlotId, input.footerSlotId],
  ] as const) {
    const detaching = wasId !== null && nowId === null;
    if (!detaching) continue;
    if (draft.slots[slot].length > 0) continue;

    const [source] = await db.select().from(sharedSlots).where(eq(sharedSlots.id, wasId)).limit(1);
    if (!source) continue;

    const copied = registry.safeParseLayout({
      version: 1,
      slots: { header: [], main: [], sidebar: [], footer: [], [slot]: source.sections },
    }).layout.slots[slot];

    draft = { ...draft, slots: { ...draft.slots, [slot]: copied } };
  }

  await db
    .update(pages)
    .set({
      headerSlotId: input.headerSlotId,
      footerSlotId: input.footerSlotId,
      draftLayout: draft === layout ? page.draftLayout : draft,
      // Only when the document actually changed. Swapping which Shared Slot a Page points at
      // without rewriting its layout leaves an open Editor's copy still correct, and
      // `applySlotsToAllPages` documents the same reasoning for its own case.
      ...(draft === layout ? {} : { revision: sql`${pages.revision} + 1` }),
      updatedAt: new Date(),
    })
    .where(eq(pages.id, input.pageId));

  revalidatePath(page.path);
  revalidatePath("/admin");
}

/**
 * Puts one Page's Header and Footer onto every other Page.
 *
 * The blunt instrument, and the one an Owner actually wants after building a Header they
 * like on one Page: "use this everywhere".
 */
export async function applySlotsToAllPages(pageId: string): Promise<number> {
  await requireOwner();
  const db = database();

  const [source] = await db
    .select({ headerSlotId: pages.headerSlotId, footerSlotId: pages.footerSlotId })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);

  if (!source) throw new Error("That Page no longer exists.");

  // Every Page, deliberately — that is what the caller asked for and what the button says.
  // The only thing scoping it would achieve is a partial apply that nothing reports.
  //
  // `updatedAt` is set because every other mutation sets it, and a Page whose Header changed
  // while its timestamp did not is a Page the Dashboard sorts wrongly and a stale cache has
  // no reason to drop. The layout document is untouched, so `revision` is left alone: it
  // guards writes to the layout, and nothing here writes one.
  const changed = await db
    .update(pages)
    .set({
      headerSlotId: source.headerSlotId,
      footerSlotId: source.footerSlotId,
      updatedAt: new Date(),
    })
    .returning({ id: pages.id });

  revalidatePath("/", "layout");
  revalidatePath("/admin");
  return changed.length;
}
