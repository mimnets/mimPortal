import { createRegistry, emptyLayout, type PageLayout, type SectionNode } from "@mimnets/core";
import { standardBlocks } from "@mimnets/blocks";
import { describe, expect, it } from "vitest";

import {
  blockAt,
  canRedo,
  canUndo,
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

/**
 * What a structural change does to the selection.
 *
 * A selection is a *position* — slot, section, column, index — so anything that moves what
 * is above it changes which Block that position names. Deleting index 0 while index 1 was
 * selected left the selection reading 1, now addressing what had been index 2: the settings
 * panel silently retargeted and the Author edited a Block they had not chosen.
 *
 * The rule these check is one sentence: a structural change never changes *what* is
 * selected, only where that thing now is.
 */
describe("following the selection through a change", () => {
  /** Three Blocks in one Column, so there is something above and below any of them. */
  function threeBlocks(): EditorState {
    const layout: PageLayout = emptyLayout();
    const section = newSection("1");
    section.columns[0]!.blocks.push(newBlock(heading), newBlock(text), newBlock(heading));
    layout.slots.main.push(section);
    return initialState(layout);
  }

  const at = (block: number) => ({ slot: "main" as const, section: 0, column: 0, block });

  it("keeps the same Block selected when one above it is deleted", () => {
    const state = { ...threeBlocks(), selection: { kind: "block" as const, path: at(1) } };
    const chosen = state.layout.slots.main[0]!.columns[0]!.blocks[1]!;

    const next = editorReducer(state, { type: "deleteBlock", path: at(0) });

    // The index moved from 1 to 0; the Block it names did not change.
    expect(next.selection).toEqual({ kind: "block", path: at(0) });
    expect(findBlockPath(next.layout, chosen.id)).toEqual(at(0));
  });

  it("clears the selection when the selected Block is the one deleted", () => {
    const state = { ...threeBlocks(), selection: { kind: "block" as const, path: at(1) } };

    const next = editorReducer(state, { type: "deleteBlock", path: at(1) });

    expect(next.selection).toBeNull();
  });

  it("leaves the selection alone when the deleted Block is below it", () => {
    const state = { ...threeBlocks(), selection: { kind: "block" as const, path: at(0) } };

    const next = editorReducer(state, { type: "deleteBlock", path: at(2) });

    expect(next.selection).toEqual({ kind: "block", path: at(0) });
  });

  it("does not retarget the panel when a different Block is dragged past it", () => {
    const state = { ...threeBlocks(), selection: { kind: "block" as const, path: at(2) } };
    const chosen = state.layout.slots.main[0]!.columns[0]!.blocks[2]!;

    // Drag the first Block to the end, moving it past the selected one.
    const next = editorReducer(state, {
      type: "moveBlock",
      from: at(0),
      to: { slot: "main", section: 0, column: 0, index: 2 },
    });

    expect(next.selection).toEqual({ kind: "block", path: at(1) });
    expect(findBlockPath(next.layout, chosen.id)).toEqual(at(1));
  });

  it("follows the selected Block when it is the one dragged", () => {
    const state = { ...threeBlocks(), selection: { kind: "block" as const, path: at(0) } };
    const chosen = state.layout.slots.main[0]!.columns[0]!.blocks[0]!;

    const next = editorReducer(state, {
      type: "moveBlock",
      from: at(0),
      to: { slot: "main", section: 0, column: 0, index: 2 },
    });

    expect(next.selection).toEqual({ kind: "block", path: at(2) });
    expect(findBlockPath(next.layout, chosen.id)).toEqual(at(2));
  });

  it("selects what was dragged only when nothing was selected", () => {
    const state = threeBlocks();

    const next = editorReducer(state, {
      type: "moveBlock",
      from: at(0),
      to: { slot: "main", section: 0, column: 0, index: 2 },
    });

    expect(next.selection).toEqual({ kind: "block", path: at(2) });
  });

  it("keeps a Block selected when a Section above it is deleted", () => {
    const layout: PageLayout = emptyLayout();
    const first = newSection("1");
    const second = newSection("1");
    second.columns[0]!.blocks.push(newBlock(heading));
    layout.slots.main.push(first, second);

    const state = {
      ...initialState(layout),
      selection: { kind: "block" as const, path: { slot: "main" as const, section: 1, column: 0, block: 0 } },
    };
    const chosen = second.columns[0]!.blocks[0]!;

    const next = editorReducer(state, { type: "deleteSection", path: { slot: "main", section: 0 } });

    // This used to clear the selection outright, which threw away a Block the Author was
    // editing because a different Section was removed.
    expect(next.selection).toEqual({ kind: "block", path: at(0) });
    expect(findBlockPath(next.layout, chosen.id)).toEqual(at(0));
  });

  it("clears the selection when the Section holding the selected Block is deleted", () => {
    const state = { ...threeBlocks(), selection: { kind: "block" as const, path: at(1) } };

    const next = editorReducer(state, { type: "deleteSection", path: { slot: "main", section: 0 } });

    expect(next.selection).toBeNull();
  });
});

describe("duplicating", () => {
  it("puts the copy of a Block directly below the original and selects it", () => {
    const state = fixture();
    const original = state.layout.slots.main[0]!.columns[0]!.blocks[0]!;

    const next = editorReducer(state, {
      type: "duplicateBlock",
      path: { slot: "main", section: 0, column: 0, block: 0 },
    });

    const blocks = next.layout.slots.main[0]!.columns[0]!.blocks;
    expect(blocks.map((b) => b.type)).toEqual(["heading", "heading", "text"]);
    expect(blocks[1]!.props).toEqual(original.props);
    expect(next.selection).toEqual({
      kind: "block",
      path: { slot: "main", section: 0, column: 0, block: 1 },
    });
  });

  it("gives the copied Block an id of its own", () => {
    const state = fixture();
    const original = state.layout.slots.main[0]!.columns[0]!.blocks[0]!;

    const next = editorReducer(state, {
      type: "duplicateBlock",
      path: { slot: "main", section: 0, column: 0, block: 0 },
    });

    const blocks = next.layout.slots.main[0]!.columns[0]!.blocks;
    expect(blocks[1]!.id).not.toBe(original.id);
    // The original still resolves to its own position rather than to the copy.
    expect(findBlockPath(next.layout, original.id)).toEqual({
      slot: "main",
      section: 0,
      column: 0,
      block: 0,
    });
  });

  it("changing the copy leaves the original alone", () => {
    const state = fixture();

    const copied = editorReducer(state, {
      type: "duplicateBlock",
      path: { slot: "main", section: 0, column: 0, block: 0 },
    });
    const edited = editorReducer(copied, {
      type: "setProp",
      path: { slot: "main", section: 0, column: 0, block: 1 },
      key: "text",
      value: "Only the copy",
    });

    const blocks = edited.layout.slots.main[0]!.columns[0]!.blocks;
    expect(blocks[1]!.props.text).toBe("Only the copy");
    expect(blocks[0]!.props.text).not.toBe("Only the copy");
  });

  it("gives a duplicated Section fresh ids all the way down", () => {
    const state = fixture();
    const original = state.layout.slots.main[0]!;

    const next = editorReducer(state, {
      type: "duplicateSection",
      path: { slot: "main", section: 0 },
    });

    const sections = next.layout.slots.main;
    expect(sections).toHaveLength(2);

    const copy = sections[1]!;
    expect(copy.id).not.toBe(original.id);
    expect(copy.layout).toBe(original.layout);

    // Every id in the tree must be new: a shared one would give dnd-kit two draggables with
    // the same identity, and the second Section would drag the first.
    const idsOf = (section: SectionNode) => [
      section.id,
      ...section.columns.flatMap((column) => [column.id, ...column.blocks.map((b) => b.id)]),
    ];
    const before = idsOf(original);
    const after = idsOf(copy);
    expect(after).toHaveLength(before.length);
    expect(after.filter((id) => before.includes(id))).toEqual([]);
    expect(new Set(after).size).toBe(after.length);
  });

  it("leaves a Section alone when the path does not resolve", () => {
    const state = fixture();
    const next = editorReducer(state, {
      type: "duplicateSection",
      path: { slot: "main", section: 4 },
    });
    expect(next).toBe(state);
  });
});

describe("undo and redo", () => {
  it("has nothing to undo on a freshly opened Page", () => {
    const state = fixture();
    expect(canUndo(state)).toBe(false);
    expect(canRedo(state)).toBe(false);
    expect(editorReducer(state, { type: "undo" })).toBe(state);
  });

  it("brings back a deleted Section", () => {
    const state = fixture();
    const deleted = editorReducer(state, {
      type: "deleteSection",
      path: { slot: "main", section: 0 },
    });
    expect(deleted.layout.slots.main).toHaveLength(0);

    const undone = editorReducer(deleted, { type: "undo" });
    expect(undone.layout.slots.main).toHaveLength(1);
    expect(undone.layout).toEqual(state.layout);
    expect(canRedo(undone)).toBe(true);
  });

  it("redoes what it just undid", () => {
    const state = fixture();
    const deleted = editorReducer(state, {
      type: "deleteSection",
      path: { slot: "main", section: 0 },
    });
    const redone = editorReducer(editorReducer(deleted, { type: "undo" }), { type: "redo" });

    expect(redone.layout.slots.main).toHaveLength(0);
    expect(canRedo(redone)).toBe(false);
    expect(canUndo(redone)).toBe(true);
  });

  it("abandons the redo branch once something new happens", () => {
    const state = fixture();
    const deleted = editorReducer(state, {
      type: "deleteSection",
      path: { slot: "main", section: 0 },
    });
    const undone = editorReducer(deleted, { type: "undo" });
    expect(canRedo(undone)).toBe(true);

    const diverged = editorReducer(undone, { type: "addSection", slot: "main", layout: "1" });
    expect(canRedo(diverged)).toBe(false);
  });

  it("collapses a run of typing into one entry", () => {
    const path = { slot: "main", section: 0, column: 0, block: 0 } as const;
    let state = fixture();
    const before = state.layout.slots.main[0]!.columns[0]!.blocks[0]!.props.text;

    for (const value of ["A", "Ab", "Abo", "Abou", "About"]) {
      state = editorReducer(state, { type: "setProp", path, key: "text", value });
    }

    expect(state.past).toHaveLength(1);
    const undone = editorReducer(state, { type: "undo" });
    expect(undone.layout.slots.main[0]!.columns[0]!.blocks[0]!.props.text).toBe(before);
  });

  it("starts a new entry when the Author moves to another field", () => {
    const path = { slot: "main", section: 0, column: 0, block: 0 } as const;
    let state = fixture();

    state = editorReducer(state, { type: "setProp", path, key: "text", value: "About" });
    state = editorReducer(state, { type: "setProp", path, key: "level", value: "h1" });
    state = editorReducer(state, { type: "setProp", path, key: "text", value: "About us" });

    expect(state.past).toHaveLength(3);
  });

  it("ends the typing run when the selection changes", () => {
    const path = { slot: "main", section: 0, column: 0, block: 0 } as const;
    let state = fixture();

    state = editorReducer(state, { type: "setProp", path, key: "text", value: "A" });
    state = editorReducer(state, { type: "select", selection: null });
    state = editorReducer(state, { type: "setProp", path, key: "text", value: "About" });

    expect(state.past).toHaveLength(2);
  });

  it("records nothing for a selection or a save", () => {
    const state = editorReducer(fixture(), { type: "select", selection: null });
    expect(state.past).toEqual([]);
    expect(editorReducer(state, { type: "saved", layout: state.layout }).past).toEqual([]);
  });

  it("follows the selection back through an undo", () => {
    const state = editorReducer(fixture(), {
      type: "select",
      selection: { kind: "block", path: { slot: "main", section: 0, column: 0, block: 1 } },
    });

    // Deleting the Block above shifts the selected one up to index 0.
    const deleted = editorReducer(state, {
      type: "deleteBlock",
      path: { slot: "main", section: 0, column: 0, block: 0 },
    });
    expect(deleted.selection).toEqual({
      kind: "block",
      path: { slot: "main", section: 0, column: 0, block: 0 },
    });

    // Undoing puts it back, and the selection has to come back with it.
    const undone = editorReducer(deleted, { type: "undo" });
    expect(undone.selection).toEqual({
      kind: "block",
      path: { slot: "main", section: 0, column: 0, block: 1 },
    });
  });

  it("stays dirty after undoing back to the opening state", () => {
    const state = fixture();
    const undone = editorReducer(
      editorReducer(state, { type: "addSection", slot: "main", layout: "1" }),
      { type: "undo" },
    );
    expect(undone.layout).toEqual(state.layout);
    expect(undone.dirty).toBe(true);
  });

  it("forgets the oldest change once the limit is passed", () => {
    let state = fixture();
    for (let i = 0; i < 60; i += 1) {
      state = editorReducer(state, { type: "addSection", slot: "main", layout: "1" });
    }
    expect(state.past).toHaveLength(50);

    // Fifty undos are available and the fifty-first does nothing, rather than throwing.
    for (let i = 0; i < 50; i += 1) state = editorReducer(state, { type: "undo" });
    expect(canUndo(state)).toBe(false);
    expect(editorReducer(state, { type: "undo" })).toBe(state);
  });
});



describe("changing a Section's Column layout", () => {
  /**
   * The selected path after Columns are merged.
   *
   * `setSectionLayout` keeps Blocks when Columns are removed — they move into the last
   * surviving Column — so every id survives and every *path* changes. It was the one
   * structural action returning `state.selection` untouched while every other one called
   * `followSelection`.
   *
   * The mild failure is a selection pointing at a Column that no longer exists: the panel
   * says "That Block is no longer here" while the Block is plainly on screen. The bad one is
   * the case below, where the stale path stays valid and quietly addresses a different Block
   * — which is precisely the I-17 failure the August audit closed as a class.
   */
  function threeColumns(): EditorState {
    const layout: PageLayout = emptyLayout();
    const section = newSection("1-1-1");
    section.columns[0]!.blocks.push(newBlock(heading));
    section.columns[1]!.blocks.push(newBlock(text));
    section.columns[2]!.blocks.push(newBlock(heading));
    layout.slots.main.push(section);
    return initialState(layout);
  }

  function withBlockSelected(state: EditorState, column: number): EditorState {
    return editorReducer(state, {
      type: "select",
      selection: { kind: "block", path: { slot: "main", section: 0, column, block: 0 } },
    });
  }

  it("keeps the selection on the same Block when Columns merge", () => {
    const state = withBlockSelected(threeColumns(), 2);
    const selected = state.layout.slots.main[0]!.columns[2]!.blocks[0]!;

    const next = editorReducer(state, {
      type: "setSectionLayout",
      path: { slot: "main", section: 0 },
      layout: "1",
    });

    const path = next.selection?.kind === "block" ? next.selection.path : null;
    expect(path).not.toBeNull();
    expect(next.layout.slots.main[0]!.columns[path!.column]!.blocks[path!.block]!.id).toBe(
      selected.id,
    );
  });

  it("merges Blocks onto the end, so a surviving Column keeps its own", () => {
    // Worth pinning down because the audit claimed the opposite. Merging *appends*, so a
    // stale path into a Column that still exists addresses the Block it always did — the
    // silent "you are now editing something else" failure is not reachable here. What is
    // reachable is the milder one above: a path into a Column that has gone.
    const state = threeColumns();
    const [a, b, c] = state.layout.slots.main[0]!.columns.map((column) => column.blocks[0]!.id);

    const next = editorReducer(state, {
      type: "setSectionLayout",
      path: { slot: "main", section: 0 },
      layout: "1-1",
    });

    const columns = next.layout.slots.main[0]!.columns;
    expect(columns).toHaveLength(2);
    expect(columns[0]!.blocks.map((block) => block.id)).toEqual([a]);
    expect(columns[1]!.blocks.map((block) => block.id)).toEqual([b, c]);
  });

  it("keeps every Block when Columns are removed", () => {
    const state = threeColumns();
    const before = state.layout.slots.main[0]!.columns.flatMap((c) => c.blocks.map((b) => b.id));

    const next = editorReducer(state, {
      type: "setSectionLayout",
      path: { slot: "main", section: 0 },
      layout: "1",
    });

    const after = next.layout.slots.main[0]!.columns.flatMap((c) => c.blocks.map((b) => b.id));
    expect(after.sort()).toEqual(before.sort());
  });

  it("leaves a Section selection alone", () => {
    const state = editorReducer(threeColumns(), {
      type: "select",
      selection: { kind: "section", path: { slot: "main", section: 0 } },
    });

    const next = editorReducer(state, {
      type: "setSectionLayout",
      path: { slot: "main", section: 0 },
      layout: "1-1",
    });

    // The Section did not move, so the Author stays where they were.
    expect(next.selection).toEqual({
      kind: "section",
      path: { slot: "main", section: 0 },
    });
  });
});


describe("what a save does to the unsaved-changes flag", () => {
  /**
   * A save reports on the document it sent, not on the one in front of the Author.
   *
   * `onSave` receives the layout as it was when the button was pressed. The request then
   * takes as long as it takes, and an Author who carries on typing has changed the document
   * before it resolves. Clearing `dirty` unconditionally told them "All changes saved",
   * disabled the Save button and unregistered the beforeunload guard — so closing the tab
   * lost the edits, silently, immediately after being told they were safe.
   */
  const path = { slot: "main", section: 0, column: 0, block: 0 } as const;

  it("clears the flag when nothing changed while the save was in flight", () => {
    const state = editorReducer(fixture(), {
      type: "setProp",
      path,
      key: "text",
      value: "Typed once",
    });
    expect(state.dirty).toBe(true);

    const saved = editorReducer(state, { type: "saved", layout: state.layout });

    expect(saved.dirty).toBe(false);
  });

  it("keeps the flag when the Author typed while the save was in flight", () => {
    const sent = editorReducer(fixture(), {
      type: "setProp",
      path,
      key: "text",
      value: "Typed before saving",
    });

    // The Author keeps typing; the request has not come back yet.
    const later = editorReducer(sent, {
      type: "setProp",
      path,
      key: "text",
      value: "Typed while saving",
    });

    // Now it does, reporting on the document that was actually sent.
    const saved = editorReducer(later, { type: "saved", layout: sent.layout });

    expect(saved.dirty).toBe(true);
    expect(blockAt(saved.layout, path)?.props.text).toBe("Typed while saving");
  });

  it("does not disturb anything else about the state", () => {
    const state = editorReducer(fixture(), {
      type: "select",
      selection: { kind: "block", path },
    });

    const saved = editorReducer(state, { type: "saved", layout: state.layout });

    expect(saved.selection).toEqual(state.selection);
    expect(saved.layout).toBe(state.layout);
  });
});
