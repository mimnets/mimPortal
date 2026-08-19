import { eq, inArray } from "drizzle-orm";
import type { PageLayout, SlotName } from "@mimnets/core";
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
export async function resolveLayout(layout: PageLayout, refs: PageSlotRefs): Promise<PageLayout> {
  const wanted = [refs.headerSlotId, refs.footerSlotId].filter((id): id is string => Boolean(id));
  if (wanted.length === 0) return layout;

  const rows = await database().select().from(sharedSlots).where(inArray(sharedSlots.id, wanted));
  const byId = new Map(rows.map((row) => [row.id, row]));

  const resolved: PageLayout = { ...layout, slots: { ...layout.slots } };

  for (const [slot, id] of [
    ["header", refs.headerSlotId],
    ["footer", refs.footerSlotId],
  ] as const) {
    if (!id) continue;
    const row = byId.get(id);
    if (!row || row.slot !== slot) continue;

    const sections = parseSections(row);
    if (sections) resolved.slots[slot as SlotName] = sections;
  }

  return resolved;
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
  const { layout, error } = registry.safeParseLayout(wrapped);
  if (error) {
    console.error(`[mimnets] Shared Slot "${row.slug}" failed validation: ${error}`);
    return null;
  }
  return layout.slots.header;
}

/** The sections of one shared Slot, ready to hand to the Editor. */
export async function sharedSlotById(id: string): Promise<SharedSlotRow | null> {
  const [row] = await database().select().from(sharedSlots).where(eq(sharedSlots.id, id)).limit(1);
  return row ?? null;
}
