import { createRegistry, emptyLayout, type PageLayout } from "@mimnets/core";
import { standardBlocks } from "@mimnets/blocks";
import { describe, expect, it } from "vitest";

import {
  editorReducer,
  findBlockPath,
  findColumnTarget,
  initialState,
  newBlock,
  newSection,
  type EditorState,
} from "./state";

const registry = createRegistry([...standardBlocks]);
const heading = registry.get("heading")!;
const text = registry.get("text")!;

/** A Page with one two-column Section in `main`, holding two Blocks in the first Column. */
function fixture(): EditorState {
  const layout: PageLayout = emptyLayout();
  const section = newSection("1-1");
  section.columns[0]!.blocks.push(newBlock(heading), newBlock(text));
  layout.slots.main.push(section);
  return initialState(layout);
}

describe("moving Blocks", () => {
  it("reorders within a Column", () => {
    const state = fixture();
    const first = state.layout.slots.main[0]!.columns[0]!.blocks[0]!;

    const next = editorReducer(state, {
      type: "moveBlock",
      from: { slot: "main", section: 0, column: 0, block: 0 },
      to: { slot: "main", section: 0, column: 0, index: 1 },
    });

    const blocks = next.layout.slots.main[0]!.columns[0]!.blocks;
    expect(blocks.map((b) => b.type)).toEqual(["text", "heading"]);
    expect(blocks[1]!.id).toBe(first.id);
  });

  it("moves a Block into another Column", () => {
    const state = fixture();
    const moved = state.layout.slots.main[0]!.columns[0]!.blocks[1]!;

    const next = editorReducer(state, {
      type: "moveBlock",
      from: { slot: "main", section: 0, column: 0, block: 1 },
      to: { slot: "main", section: 0, column: 1, index: 0 },
    });

    const section = next.layout.slots.main[0]!;
    expect(section.columns[0]!.blocks).toHaveLength(1);
    expect(section.columns[1]!.blocks[0]!.id).toBe(moved.id);
  });

  it("moves a Block into another Slot", () => {
    const state = fixture();
    const withHeader = editorReducer(state, { type: "addSection", slot: "header", layout: "1" });
    const moved = withHeader.layout.slots.main[0]!.columns[0]!.blocks[0]!;

    const next = editorReducer(withHeader, {
      type: "moveBlock",
      from: { slot: "main", section: 0, column: 0, block: 0 },
      to: { slot: "header", section: 0, column: 0, index: 0 },
    });

    expect(next.layout.slots.header[0]!.columns[0]!.blocks[0]!.id).toBe(moved.id);
    expect(next.layout.slots.main[0]!.columns[0]!.blocks).toHaveLength(1);
  });

  it("does not lose a Block when moving it further down its own Column", () => {
    const state = fixture();
    const before = state.layout.slots.main[0]!.columns[0]!.blocks.length;

    const next = editorReducer(state, {
      type: "moveBlock",
      from: { slot: "main", section: 0, column: 0, block: 0 },
      to: { slot: "main", section: 0, column: 0, index: 2 },
    });

    expect(next.layout.slots.main[0]!.columns[0]!.blocks).toHaveLength(before);
  });
});

describe("changing a Section's Columns", () => {
  it("keeps Blocks from Columns that are removed", () => {
    const state = fixture();
    const withBlockInSecondColumn = editorReducer(state, {
      type: "addBlock",
      target: { slot: "main", section: 0, column: 1 },
      blockType: heading,
    });

    const next = editorReducer(withBlockInSecondColumn, {
      type: "setSectionLayout",
      path: { slot: "main", section: 0 },
      layout: "1",
    });

    const section = next.layout.slots.main[0]!;
    expect(section.columns).toHaveLength(1);
    // Two originals plus the one that had to move out of the removed Column.
    expect(section.columns[0]!.blocks).toHaveLength(3);
  });

  it("adds empty Columns when widening", () => {
    const state = fixture();
    const next = editorReducer(state, {
      type: "setSectionLayout",
      path: { slot: "main", section: 0 },
      layout: "1-1-1",
    });

    expect(next.layout.slots.main[0]!.columns).toHaveLength(3);
    expect(next.layout.slots.main[0]!.columns[2]!.blocks).toEqual([]);
  });
});

describe("editing and lookup", () => {
  it("writes a field value onto the selected Block", () => {
    const state = fixture();
    const next = editorReducer(state, {
      type: "setProp",
      path: { slot: "main", section: 0, column: 0, block: 0 },
      key: "text",
      value: "Changed",
    });

    expect(next.layout.slots.main[0]!.columns[0]!.blocks[0]!.props.text).toBe("Changed");
    expect(next.dirty).toBe(true);
    // The original document is untouched, so undo remains possible later.
    expect(state.layout.slots.main[0]!.columns[0]!.blocks[0]!.props.text).toBe("Heading");
  });

  it("gives a new Block the defaults from its own schema", () => {
    const block = newBlock(heading);
    expect(block.props).toEqual({ text: "Heading", level: "h2", align: "left" });
  });

  it("finds a Block and a Column by id, which is what drag-and-drop resolves against", () => {
    const state = fixture();
    const block = state.layout.slots.main[0]!.columns[0]!.blocks[1]!;
    const column = state.layout.slots.main[0]!.columns[1]!;

    expect(findBlockPath(state.layout, block.id)).toEqual({
      slot: "main",
      section: 0,
      column: 0,
      block: 1,
    });
    expect(findColumnTarget(state.layout, column.id)).toEqual({
      slot: "main",
      section: 0,
      column: 1,
    });
    expect(findBlockPath(state.layout, "nope")).toBeNull();
  });
});

describe("what the Editor saves", () => {
  it("produces a layout the registry accepts", () => {
    const state = fixture();
    const edited = editorReducer(state, {
      type: "addBlock",
      target: { slot: "footer", section: 0, column: 0 },
      blockType: text,
    });
    expect(() => registry.parseLayout(edited.layout)).not.toThrow();
  });
});
