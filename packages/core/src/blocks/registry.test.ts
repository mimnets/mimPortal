import { describe, expect, it } from "vitest";

import { defineBlock } from "./define";
import { field } from "./fields";
import { createRegistry } from "./registry";
import { blockStyleDefaults, sectionDefaults, type BlockInstance } from "../layout/schema";

/**
 * What a Page does when one of its Blocks will not parse.
 *
 * The answer used to be "nothing" — `safeParseLayout` returned an empty layout on any
 * failure, so removing a Block Type from `blocks.config.ts` blanked every published Page
 * that used it, and a visitor saw that before an Author did. A Page is not all-or-nothing:
 * a Block that cannot be read is dropped and the rest of the Page is still a Page.
 */

const headingBlock = defineBlock({
  name: "heading",
  label: "Heading",
  fields: { text: field.text({ label: "Text" }) },
  render: () => null,
});

const textBlock = defineBlock({
  name: "text",
  label: "Text",
  fields: { body: field.text({ label: "Body" }) },
  render: () => null,
});

const registry = createRegistry([headingBlock, textBlock]);

function block(id: string, type: string, props: Record<string, unknown>): BlockInstance {
  return { id, type, props, style: blockStyleDefaults() } as BlockInstance;
}

function documentWith(blocks: unknown[]) {
  return {
    version: 1,
    slots: {
      header: [],
      main: [
        {
          id: "sec-1",
          layout: "1",
          columns: [{ id: "col-1", blocks }],
          ...sectionDefaults(),
        },
      ],
      sidebar: [],
      footer: [],
    },
  };
}

function mainBlocks(layout: { slots: { main: { columns: { blocks: unknown[] }[] }[] } }) {
  return layout.slots.main[0]?.columns[0]?.blocks ?? [];
}

describe("a document every Block of which parses", () => {
  it("comes back whole, with nothing dropped", () => {
    const input = documentWith([block("a", "heading", { text: "Hello" })]);

    const { layout, error, dropped } = registry.safeParseLayout(input);

    expect(error).toBeNull();
    expect(dropped).toEqual([]);
    expect(mainBlocks(layout)).toHaveLength(1);
  });
});

describe("a document holding a Block this Site cannot read", () => {
  it("keeps the Page and drops only the offending Block", () => {
    const input = documentWith([
      block("a", "heading", { text: "Still here" }),
      // A Block Type this registry does not know — what removing one from blocks.config.ts
      // leaves behind in every Page that used it.
      block("b", "carousel", { slides: [] }),
      block("c", "text", { body: "Also still here" }),
    ]);

    const { layout, error, dropped } = registry.safeParseLayout(input);

    // Not an error. The Page renders.
    expect(error).toBeNull();

    const kept = mainBlocks(layout) as BlockInstance[];
    expect(kept.map((one) => one.id)).toEqual(["a", "c"]);

    expect(dropped).toHaveLength(1);
    expect(dropped[0]).toMatchObject({ slot: "main", id: "b", type: "carousel" });
    expect(dropped[0]!.reason).toBeTruthy();
  });

  it("drops a Block whose props are wrong for its type", () => {
    const input = documentWith([
      block("a", "heading", { text: "Fine" }),
      block("b", "heading", { text: 42 }),
    ]);

    const { layout, dropped } = registry.safeParseLayout(input);

    expect((mainBlocks(layout) as BlockInstance[]).map((one) => one.id)).toEqual(["a"]);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]).toMatchObject({ id: "b", type: "heading" });
  });

  it("says which Slot the Block was dropped from", () => {
    const input = documentWith([]);
    input.slots.header = [
      {
        id: "sec-h",
        layout: "1",
        columns: [{ id: "col-h", blocks: [block("h", "gallery", {})] }],
        ...sectionDefaults(),
      },
    ] as never;

    const { dropped } = registry.safeParseLayout(input);

    expect(dropped).toHaveLength(1);
    expect(dropped[0]!.slot).toBe("header");
  });

  it("leaves the Sections and Columns around it alone", () => {
    const input = documentWith([block("b", "carousel", {})]);

    const { layout } = registry.safeParseLayout(input);

    expect(layout.slots.main).toHaveLength(1);
    expect(layout.slots.main[0]!.id).toBe("sec-1");
    expect(layout.slots.main[0]!.columns).toHaveLength(1);
    expect(mainBlocks(layout)).toEqual([]);
  });
});

describe("a document whose shape is wrong", () => {
  /**
   * The distinction the salvage rests on. A bad Block is a Page with a hole in it; a bad
   * *document* is not a Page at all, and pretending otherwise would render whatever
   * fragments happened to parse.
   */
  it("is an error, and yields an empty layout", () => {
    const { layout, error, dropped } = registry.safeParseLayout({
      version: 1,
      slots: { header: [], main: "not a list of Sections", sidebar: [], footer: [] },
    });

    expect(error).toBeTruthy();
    expect(dropped).toEqual([]);
    expect(layout.slots.main).toEqual([]);
  });

  it("is an error when a Section has the wrong number of Columns for its layout", () => {
    const { error } = registry.safeParseLayout({
      version: 1,
      slots: {
        header: [],
        main: [
          {
            id: "sec-1",
            layout: "1-1",
            columns: [{ id: "col-1", blocks: [] }],
            ...sectionDefaults(),
          },
        ],
        sidebar: [],
        footer: [],
      },
    });

    expect(error).toBeTruthy();
  });

  it("is an error for something that is not a document at all", () => {
    for (const value of [null, undefined, 42, "a string", []]) {
      const { error, layout } = registry.safeParseLayout(value);
      expect(error).toBeTruthy();
      expect(layout.slots.main).toEqual([]);
    }
  });
});

describe("parseLayout, which writes rather than reads", () => {
  it("still throws on a Block it cannot read, so bad data never reaches the database", () => {
    const input = documentWith([block("b", "carousel", {})]);
    expect(() => registry.parseLayout(input)).toThrow();
  });
});
