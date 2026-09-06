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

  it("falls back to default for a tone it does not know, rather than blanking the Page", () => {
    // The enum is still the boundary — `tone` reaches the DOM as a data attribute and selects
    // CSS, and neither of these values reaches it. What changed is the failure: a Section is
    // repainted rather than the Page emptied. `lenientLayoutSchema` relaxes only the Block
    // schema, so before the catch both of these failed the salvage parse too and a visitor
    // met a blank Page. This is the case a rollback produces, and the one a Shared Slot
    // published from a Site on newer packages produces.
    for (const tone of ["mesh; }", "rainbow"]) {
      const parsed = registry.safeParseLayout(layout({ tone }));

      expect(parsed.error).toBeNull();
      expect(parsed.layout?.slots.main[0]?.tone).toBe("default");
    }
  });

  it("keeps a tone it does know", () => {
    // The other half of the catch: it must not be swallowing valid values as well.
    for (const tone of SECTION_TONES) {
      expect(registry.safeParseLayout(layout({ tone })).layout?.slots.main[0]?.tone).toBe(tone);
    }
  });

  it("falls back to normal padding it does not know, for the same reason", () => {
    // `padding` sits beside `tone` on the same Section and had the same hole. It has not
    // bitten only because this enum has not grown yet, which is not a property worth
    // relying on: the next value added to it would blank every Page written afterwards on
    // any Site still running the older package.
    const parsed = registry.safeParseLayout(layout({ padding: "generous" }));

    expect(parsed.error).toBeNull();
    expect(parsed.layout?.slots.main[0]?.padding).toBe("normal");
  });

  it("still refuses a layout it does not know, which is not the same case", () => {
    // The deliberate asymmetry. `tone` and `padding` are decoration and a Section survives
    // losing them; `layout` decides how many Columns the Section must have, so quietly
    // rewriting it to "1" would produce a document that fails its own structural rule.
    // Refusing is right here, and the Page-level salvage is what stops it being fatal.
    expect(registry.safeParseLayout(layout({ layout: "3-2-1" })).error).not.toBeNull();
  });

  it("offers exactly the bands the Editor draws", () => {
    // The Editor's control is hand-written options rather than a map over this list, so the
    // two drift silently. This is the reminder to add the option.
    //
    // It is also the reminder to check `blocks.css`, and there is a specific thing to check.
    // A "flat" card is drawn in `--mn-color-surface`, which is the colour the `surface` band
    // is painted in, so cards on that band are lifted onto `--mn-color-background` by an
    // override. `mesh` is four tints laid over that same surface colour and needed the same
    // override; it did not get one when it landed, and every quote, plan, accordion item and
    // carousel slide on a mesh band dissolved into it.
    //
    // So: a new tone painted in `--mn-color-surface` must be added to the
    // `--mn-surface-background` override in `packages/blocks/src/blocks.css`. That cannot be
    // asserted from here -- this package cannot read that stylesheet, and `@mimnets/blocks`
    // deliberately has no Node types, because the day it does is the day a Block can import
    // `node:fs` without tsc objecting. A reminder is what is available, so this is one.
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
