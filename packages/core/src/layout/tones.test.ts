/**
 * The two tone values M11 added, and the Pages written before they existed.
 *
 * `tone` is a closed enum on both a Section and a Block, which is the whole of ADR-0013's
 * argument: a client who can put any colour behind anything will. Growing a closed enum is
 * the one change that can break every layout already in a database, so it is the one worth a
 * test — every Page on every Site was written when these two values did not exist.
 */

import { describe, expect, it } from "vitest";

import { defineBlock } from "../blocks/define";
import { field } from "../blocks/fields";
import { createRegistry } from "../blocks/registry";
import { BLOCK_TONES, SECTION_TONES } from "./schema";

const registry = createRegistry([
  defineBlock({
    name: "spacer",
    label: "Spacer",
    fields: { note: field.text({ label: "Note", default: "" }) },
    render: () => null,
  }),
]);

/** A Section carrying whatever the caller wants to say about tone, or saying nothing. */
function layout(section: Record<string, unknown>) {
  return {
    version: 1,
    slots: {
      header: [],
      main: [
        {
          id: "sec-1",
          layout: "1",
          columns: [{ id: "col-1", blocks: [] }],
          ...section,
        },
      ],
      sidebar: [],
      footer: [],
    },
  };
}

describe("a Section's tone", () => {
  it("accepts the mesh band", () => {
    expect(registry.safeParseLayout(layout({ tone: "mesh" })).error).toBeNull();
  });

  /**
   * The reason `tone` was declared `.default("default")` rather than required, and the reason
   * it still has to be: every Section stored before this enum grew carries no `mesh`, and
   * several thousand of them carry no `tone` at all — they predate Sections being paintable.
   */
  it("still parses a Section written before any of this existed", () => {
    const parsed = registry.safeParseLayout(layout({}));

    expect(parsed.error).toBeNull();
    expect(parsed.layout?.slots.main[0]?.tone).toBe("default");
  });

  it("still refuses one that is not a tone", () => {
    // The enum is the boundary: `tone` reaches the DOM as a data attribute and selects CSS.
    expect(registry.safeParseLayout(layout({ tone: "mesh; }" })).error).not.toBeNull();
    expect(registry.safeParseLayout(layout({ tone: "rainbow" })).error).not.toBeNull();
  });

  it("offers exactly the bands the Editor draws", () => {
    // The Editor's control is hand-written options rather than a map over this list, so the
    // two drift silently. This is the reminder to add the option.
    expect([...SECTION_TONES]).toEqual(["default", "surface", "primary", "dark", "mesh"]);
  });
});

describe("a Block's tone", () => {
  function blockWithTone(tone: unknown) {
    return layout({
      columns: [
        {
          id: "col-1",
          blocks: [{ id: "blk-1", type: "spacer", props: { note: "" }, style: { tone } }],
        },
      ],
    });
  }

  it("accepts gradient type", () => {
    expect(registry.safeParseLayout(blockWithTone("gradient")).error).toBeNull();
  });

  /**
   * A Block, unlike a Section, is dropped rather than fatal — which is I-04's fix, not an
   * omission. A tone this Site does not know is one Block missing from a Page, reported to
   * the Author; the alternative, and what this used to do, was a blank Page a visitor sees
   * first.
   */
  it("drops a Block whose tone is not a tone, rather than blanking the Page", () => {
    const parsed = registry.safeParseLayout(blockWithTone("transparent"));

    expect(parsed.error).toBeNull();
    expect(parsed.dropped).toHaveLength(1);
    expect(parsed.dropped[0]?.type).toBe("spacer");
    expect(parsed.layout?.slots.main[0]?.columns[0]?.blocks).toHaveLength(0);
  });

  it("refuses it outright on the strict parse the Editor saves through", () => {
    expect(() => registry.parseLayout(blockWithTone("transparent"))).toThrow();
  });

  it("offers exactly the tones the Editor draws", () => {
    expect([...BLOCK_TONES]).toEqual(["default", "muted", "primary", "accent", "gradient"]);
  });
});
