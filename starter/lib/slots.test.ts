import {
  blockStyleDefaults,
  emptyLayout,
  sectionDefaults,
  type PageLayout,
  type SlotName,
} from "@mimnets/core";
import { describe, expect, it } from "vitest";

import { restoreOwnSlots } from "./slots";

/**
 * The way back in from the Editor.
 *
 * These need no database: what is being checked is which sections survive a save, and that
 * is a decision about two documents. The database only decides whether a Slot is shared,
 * which arrives here as a plain id.
 */

function withText(slot: SlotName, text: string): PageLayout {
  const layout = emptyLayout();
  layout.slots[slot] = [
    {
      id: `sec-${slot}`,
      layout: "1",
      columns: [
        {
          id: `col-${slot}`,
          blocks: [{ id: `blk-${slot}`, type: "text", props: { body: text }, style: blockStyleDefaults() }],
        },
      ],
      ...sectionDefaults(),
    },
  ];
  return layout;
}

const NO_SHARED = { headerSlotId: null, footerSlotId: null };

describe("what a Page save may write", () => {
  it("writes the incoming document untouched when the Page owns every Slot", () => {
    const incoming = withText("header", "the Page's own Header");
    const stored = withText("header", "something older");

    expect(restoreOwnSlots(incoming, stored, NO_SHARED)).toBe(incoming);
  });

  it("keeps the Page's own Header when the Header is shared", () => {
    // What the Editor posts back is the *resolved* document, so its header is a copy of the
    // shared Slot. Writing it would destroy the Page's own sections.
    const incoming = withText("header", "a copy of the shared Header");
    const stored = withText("header", "the Page's own Header");

    const kept = restoreOwnSlots(incoming, stored, { headerSlotId: "slot-1", footerSlotId: null });

    expect(kept.slots.header).toEqual(stored.slots.header);
  });

  it("leaves Main alone while restoring a shared Header", () => {
    const incoming = withText("main", "new body copy");
    incoming.slots.header = withText("header", "a copy of the shared Header").slots.header;
    const stored = withText("header", "the Page's own Header");

    const kept = restoreOwnSlots(incoming, stored, { headerSlotId: "slot-1", footerSlotId: null });

    expect(kept.slots.main).toEqual(incoming.slots.main);
    expect(kept.slots.header).toEqual(stored.slots.header);
  });

  it("restores the Footer independently of the Header", () => {
    const incoming = withText("footer", "a copy of the shared Footer");
    incoming.slots.header = withText("header", "an edited Header").slots.header;
    const stored = withText("footer", "the Page's own Footer");
    stored.slots.header = withText("header", "an older Header").slots.header;

    const kept = restoreOwnSlots(incoming, stored, { headerSlotId: null, footerSlotId: "slot-2" });

    expect(kept.slots.footer).toEqual(stored.slots.footer);
    expect(kept.slots.header).toEqual(incoming.slots.header);
  });

  it("does not mutate the document it was given", () => {
    const incoming = withText("header", "a copy of the shared Header");
    const before = structuredClone(incoming);
    const stored = withText("header", "the Page's own Header");

    restoreOwnSlots(incoming, stored, { headerSlotId: "slot-1", footerSlotId: null });

    expect(incoming).toEqual(before);
  });
});
