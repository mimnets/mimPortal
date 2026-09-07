import { eq, inArray } from "drizzle-orm";
import { toSlotSticky, type PageLayout, type SlotSticky, type SlotName } from "@mimnets/core";
import { createDatabase, sharedSlots, type SharedSlotRow } from "@mimnets/core/db";

import { registry } from "../blocks.config";
import { requireDatabaseUrl } from "./env";

/**
 * Turning a Page's stored layout into the one that gets rendered.
 *
 * A Page holds Main and Sidebar itself. Its Header and Footer usually come from a shared
 * Slot, so that editing one changes every Page using it — which is what everybody expects
 * a Header to do, and what this Site claimed to do long before it was true.
 *
 * Resolution happens on the way out, never on the way in. The Page's own Header sections
 * stay in its document untouched while a shared one is selected, so switching back to
 * "this Page only" returns what was there rather than an empty band.
 */

export interface PageSlotRefs {
  headerSlotId: string | null;
  footerSlotId: string | null;
}

/**
 * What resolution produces: the document to render, and the one thing about a Slot that is
 * not inside it.
 *
 * `headerSticky` cannot live in the layout because a layout is Sections, and staying on
 * screen is a property of the Slot rather than of any band in it. Returning it beside the
 * document rather than smuggling it into one is what keeps `PageLayout` the same shape a
 * Page stores, an Editor posts back, and `restoreOwnSlots` compares.
 */
export interface ResolvedLayout {
  layout: PageLayout;
  headerSticky: SlotSticky;
}

/** Which Slots can be shared. Main and Sidebar are per-Page by definition. */
export const SHAREABLE_SLOTS = ["header", "footer"] as const;
export type ShareableSlot = (typeof SHAREABLE_SLOTS)[number];

export function isShareableSlot(value: unknown): value is ShareableSlot {
  return value === "header" || value === "footer";
}

function database() {
  return createDatabase(requireDatabaseUrl());
}

export async function listSharedSlots(): Promise<SharedSlotRow[]> {
  return database().select().from(sharedSlots).orderBy(sharedSlots.slot, sharedSlots.name);
}

/**
 * Replaces the Page's own Header and Footer with the shared ones it points at.
 *
 * A reference to a Slot that has since been deleted falls back to the Page's own sections
 * rather than rendering nothing — a Site missing its navigation because a row disappeared is
 * a worse failure than a Header that is briefly out of date.
 */
export async function resolveLayout(
  layout: PageLayout,
  refs: PageSlotRefs,
): Promise<ResolvedLayout> {
  const wanted = [refs.headerSlotId, refs.footerSlotId].filter((id): id is string => Boolean(id));
  if (wanted.length === 0) return { layout, headerSticky: "scrolls" };

  const rows = await database().select().from(sharedSlots).where(inArray(sharedSlots.id, wanted));
  const byId = new Map(rows.map((row) => [row.id, row]));

  const resolved: PageLayout = { ...layout, slots: { ...layout.slots } };
  let headerSticky: SlotSticky = "scrolls";

  for (const [slot, id] of [
    ["header", refs.headerSlotId],
    ["footer", refs.footerSlotId],
  ] as const) {
    if (!id) continue;
    const row = byId.get(id);
    if (!row || row.slot !== slot) continue;

    const sections = parseSections(row);
    if (sections) resolved.slots[slot as SlotName] = sections;

    // Read from the row that was actually used, and only for the Header. A Page whose own
    // Header is rendered -- no shared Slot, or one that has since been deleted -- has
    // nowhere to have stored this and keeps the behaviour it had.
    if (slot === "header") headerSticky = toSlotSticky(row.sticky);
  }

  return { layout: resolved, headerSticky };
}

/**
 * The inverse of `resolveLayout`, for the way back in.
 *
 * The Editor is handed the *resolved* document, so what it posts back carries a copy of
 * whichever shared Slot was rendered in its place. Writing that copy would destroy the
 * Page's own Header — the sections `resolveLayout` promises to leave untouched — and, for an
 * Author, would trip the locked-Slot check on a difference they never made. A Slot the Page
 * does not own therefore keeps what is already stored, whoever is saving and whatever they
 * sent. Changing a shared Slot happens in Headers & Footers, and nowhere else.
 */
export function restoreOwnSlots(
  incoming: PageLayout,
  stored: PageLayout,
  refs: PageSlotRefs,
): PageLayout {
  const sharedIds: Record<ShareableSlot, string | null> = {
    header: refs.headerSlotId,
    footer: refs.footerSlotId,
  };

  const shared = SHAREABLE_SLOTS.filter((slot) => sharedIds[slot]);
  if (shared.length === 0) return incoming;

  const result: PageLayout = { ...incoming, slots: { ...incoming.slots } };
  for (const slot of shared) result.slots[slot] = stored.slots[slot];
  return result;
}

/**
 * A shared Slot's sections are validated the same way a Page's are, through the same
 * registry. A Slot holding a Block Type this Site no longer registers renders as empty
 * rather than taking down every Page that uses it — which, for a Header, is all of them.
 */
export function parseSections(row: SharedSlotRow): PageLayout["slots"]["header"] | null {
  const wrapped = {
    version: 1,
    slots: { header: row.sections, main: [], sidebar: [], footer: [] },
  };
  const { layout, error, dropped } = registry.safeParseLayout(wrapped);

  if (error) {
    console.error(`[mimnets] Shared Slot "${row.slug}" failed validation: ${error}`);
    return null;
  }

  // A Block that will not parse is dropped, not fatal. Returning null here would blank a
  // Header on every Page that uses it because one Block Type was removed from the registry.
  for (const block of dropped) {
    console.error(
      `[mimnets] Shared Slot "${row.slug}" dropped a Block` +
        `${block.type ? ` of type "${block.type}"` : ""}${block.id ? ` (${block.id})` : ""}: ${block.reason}`,
    );
  }

  return layout.slots.header;
}

/** The sections of one shared Slot, ready to hand to the Editor. */
export async function sharedSlotById(id: string): Promise<SharedSlotRow | null> {
  const [row] = await database().select().from(sharedSlots).where(eq(sharedSlots.id, id)).limit(1);
  return row ?? null;
}
