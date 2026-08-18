import type { PageLayout, SlotName } from "./schema";

/**
 * An Owner can lock a Slot so an Author cannot change it. Header and Footer are locked by
 * default, because that is where a client does the most damage and the least intentional
 * editing.
 *
 * This is a domain rule rather than a route detail: it decides what one person may do to a
 * document, so it lives with the document and is tested with it.
 */
export function lockedSlotViolation(
  incoming: PageLayout,
  current: PageLayout,
  lockedSlots: readonly string[],
): SlotName | null {
  for (const slot of lockedSlots as SlotName[]) {
    // Comparing serialised Slots catches every change — a moved Block, an edited field, a
    // deleted Section — without enumerating the ways a tree can differ.
    if (JSON.stringify(incoming.slots[slot]) !== JSON.stringify(current.slots[slot])) {
      return slot;
    }
  }
  return null;
}

export function assertLockedSlotsUnchanged(
  incoming: PageLayout,
  current: PageLayout,
  lockedSlots: readonly string[],
): void {
  const slot = lockedSlotViolation(incoming, current, lockedSlots);
  if (slot) {
    throw new Error(`The ${slot} is locked. Ask an Owner to change it.`);
  }
}
