import { describe, expect, it } from "vitest";

import { assertLockedSlotsUnchanged, lockedSlotViolation } from "./locking";
import { blockStyleDefaults, emptyLayout, sectionDefaults, type PageLayout, type SectionNode } from "./schema";

function section(id: string, blockText = "hello"): SectionNode {
  return {
    id,
    layout: "1",
    columns: [{ id: `${id}-col`, blocks: [{ id: `${id}-blk`, type: "text", props: { body: blockText }, style: blockStyleDefaults() }] }],
    ...sectionDefaults(),
  };
}

function layoutWith(parts: Partial<Record<"header" | "main" | "footer", SectionNode[]>>): PageLayout {
  const layout = emptyLayout();
  layout.slots.header = parts.header ?? [];
  layout.slots.main = parts.main ?? [];
  layout.slots.footer = parts.footer ?? [];
  return layout;
}

describe("locked Slots", () => {
  const locked = ["header", "footer"];

  it("allows an Author to change an unlocked Slot", () => {
    const current = layoutWith({ header: [section("h")], main: [section("m")] });
    const incoming = layoutWith({ header: [section("h")], main: [section("m"), section("m2")] });

    expect(lockedSlotViolation(incoming, current, locked)).toBeNull();
    expect(() => assertLockedSlotsUnchanged(incoming, current, locked)).not.toThrow();
  });

  it("refuses an edit to a Block inside a locked Slot", () => {
    const current = layoutWith({ header: [section("h", "Original")] });
    const incoming = layoutWith({ header: [section("h", "Rewritten")] });

    expect(lockedSlotViolation(incoming, current, locked)).toBe("header");
  });

  it("refuses a deleted Section in a locked Slot", () => {
    const current = layoutWith({ header: [section("h")], footer: [section("f")] });
    const incoming = layoutWith({ header: [section("h")], footer: [] });

    expect(lockedSlotViolation(incoming, current, locked)).toBe("footer");
  });

  it("refuses a Block moved out of a locked Slot into an unlocked one", () => {
    const current = layoutWith({ header: [section("h")], main: [] });
    const incoming = layoutWith({ header: [], main: [section("h")] });

    expect(lockedSlotViolation(incoming, current, locked)).toBe("header");
  });

  it("names the offending Slot, so the refusal can say what it refused", () => {
    const current = layoutWith({ header: [section("h")], footer: [section("f", "a")] });
    const incoming = layoutWith({ header: [section("h")], footer: [section("f", "b")] });

    expect(() => assertLockedSlotsUnchanged(incoming, current, locked)).toThrow(/footer is locked/);
  });

  it("restricts nothing when no Slots are locked, which is the Owner's case", () => {
    const current = layoutWith({ header: [section("h", "a")] });
    const incoming = layoutWith({ header: [section("h", "b")] });

    expect(lockedSlotViolation(incoming, current, [])).toBeNull();
  });
});
