import type {
  AnyBlockType,
  BlockInstance,
  BlockRegistry,
  ColumnLayout,
  ColumnNode,
  PageLayout,
  SectionNode,
  SlotName,
} from "@mimnets/core";
import { blockStyleDefaults, columnCount, sectionDefaults } from "@mimnets/core";
import type { BlockStyle } from "@mimnets/core";

export interface BlockPath {
  slot: SlotName;
  section: number;
  column: number;
  block: number;
}

export interface SectionPath {
  slot: SlotName;
  section: number;
}

export interface DropTarget {
  slot: SlotName;
  section: number;
  column: number;
  index: number;
}

export type Selection =
  | { kind: "block"; path: BlockPath }
  | { kind: "section"; path: SectionPath }
  | null;

/**
 * The document and what is selected in it — everything an action changes.
 *
 * Kept separate from `EditorState` so that the reducer over it stays unaware of history:
 * every case below returns one of these, and undo is composed on top rather than threaded
 * through thirteen switch arms.
 */
export interface DocumentState {
  layout: PageLayout;
  selection: Selection;
  dirty: boolean;
}

export interface EditorState extends DocumentState {
  /** Layouts as they were before each change, oldest first. Capped at `HISTORY_LIMIT`. */
  past: PageLayout[];
  /** Layouts undone away, nearest first. Emptied by any new change. */
  future: PageLayout[];
  /**
   * Which field is being typed into, or null.
   *
   * Consecutive edits to the same field collapse into one history entry, so undo returns
   * the heading as it was before the Author started typing rather than a letter at a time.
   * The run is identified rather than timed: any other action ends it, which is
   * deterministic and leaves the reducer pure. A timer would make it neither.
   */
  typing: string | null;
}

export type EditorAction =
  | { type: "select"; selection: Selection }
  | { type: "setProp"; path: BlockPath; key: string; value: unknown }
  | { type: "setBlockStyle"; path: BlockPath; style: Partial<BlockStyle> }
  | { type: "addBlock"; target: Omit<DropTarget, "index">; blockType: AnyBlockType }
  | { type: "deleteBlock"; path: BlockPath }
  | { type: "duplicateBlock"; path: BlockPath }
  | { type: "moveBlock"; from: BlockPath; to: DropTarget }
  | { type: "addSection"; slot: SlotName; layout: ColumnLayout }
  | { type: "deleteSection"; path: SectionPath }
  | { type: "duplicateSection"; path: SectionPath }
  | { type: "moveSection"; slot: SlotName; from: number; to: number }
  | { type: "setSectionLayout"; path: SectionPath; layout: ColumnLayout }
  | { type: "setSectionStyle"; path: SectionPath; style: Partial<SectionStyle> }
  | { type: "loadLayout"; layout: PageLayout }
  | { type: "undo" }
  | { type: "redo" }
  /**
   * The layout that was actually sent. `dirty` clears only if the document has not moved on
   * since — an Author who keeps typing while the request is in flight has unsaved work again
   * the moment the first keystroke lands, and telling them otherwise loses it.
   */
  | { type: "saved"; layout: PageLayout };

/** Far more than anyone reaches for, and small enough that the layouts stay cheap to hold. */
const HISTORY_LIMIT = 50;

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function emptyColumn(): ColumnNode {
  return { id: newId("col"), blocks: [] };
}

/** The three properties that decide how a Section is painted, editable together. */
export type SectionStyle = Pick<SectionNode, "tone" | "padding" | "background">;

export function newSection(layout: ColumnLayout): SectionNode {
  return {
    id: newId("sec"),
    layout,
    columns: Array.from({ length: columnCount(layout) }, emptyColumn),
    ...sectionDefaults(),
  };
}

/**
 * A copy of a Section, with a fresh id for the Section, every Column and every Block.
 *
 * The ids are the whole difficulty. A duplicate that kept them would give React two children
 * with one key and dnd-kit two draggables with one id, and the second Section would appear
 * to drag the first. `findBlockPath` would also stop at the earlier of the two, so the
 * settings panel would edit the original while the Author looked at the copy.
 */
function copySection(section: SectionNode): SectionNode {
  const copy = structuredClone(section);
  return {
    ...copy,
    id: newId("sec"),
    columns: copy.columns.map((column) => ({
      ...column,
      id: newId("col"),
      blocks: column.blocks.map((block) => ({ ...block, id: newId("blk") })),
    })),
  };
}

/** Defaults come from the Block Type's own schema, so a new Block is never half-formed. */
export function newBlock(blockType: AnyBlockType): BlockInstance {
  return {
    id: newId("blk"),
    style: blockStyleDefaults(),
    type: blockType.name,
    props: blockType.propsSchema.parse({}) as Record<string, unknown>,
  };
}

function sectionAt(layout: PageLayout, path: SectionPath): SectionNode | undefined {
  return layout.slots[path.slot][path.section];
}

function columnAt(layout: PageLayout, path: BlockPath | DropTarget): ColumnNode | undefined {
  return sectionAt(layout, path)?.columns[path.column];
}

export function blockAt(layout: PageLayout, path: BlockPath): BlockInstance | undefined {
  return columnAt(layout, path)?.blocks[path.block];
}

export function findBlockPath(layout: PageLayout, blockId: string): BlockPath | null {
  for (const slot of Object.keys(layout.slots) as SlotName[]) {
    const sections = layout.slots[slot];
    for (let s = 0; s < sections.length; s += 1) {
      const columns = sections[s]?.columns ?? [];
      for (let c = 0; c < columns.length; c += 1) {
        const blocks = columns[c]?.blocks ?? [];
        for (let b = 0; b < blocks.length; b += 1) {
          if (blocks[b]?.id === blockId) return { slot, section: s, column: c, block: b };
        }
      }
    }
  }
  return null;
}

export function findColumnTarget(
  layout: PageLayout,
  columnId: string,
): Omit<DropTarget, "index"> | null {
  for (const slot of Object.keys(layout.slots) as SlotName[]) {
    const sections = layout.slots[slot];
    for (let s = 0; s < sections.length; s += 1) {
      const columns = sections[s]?.columns ?? [];
      for (let c = 0; c < columns.length; c += 1) {
        if (columns[c]?.id === columnId) return { slot, section: s, column: c };
      }
    }
  }
  return null;
}

export function findSectionPath(layout: PageLayout, sectionId: string): SectionPath | null {
  for (const slot of Object.keys(layout.slots) as SlotName[]) {
    const index = layout.slots[slot].findIndex((section) => section.id === sectionId);
    if (index >= 0) return { slot, section: index };
  }
  return null;
}

function samePath(a: BlockPath, b: BlockPath): boolean {
  return (
    a.slot === b.slot && a.section === b.section && a.column === b.column && a.block === b.block
  );
}

/**
 * Follows the selection through a change to the document's shape.
 *
 * A selection is a *position* — slot, section, column, index — and a position means a
 * different Block after anything above it moves. Deleting the Block at index 0 while index 1
 * was selected left the selection reading 1, which now addressed what had been index 2: the
 * settings panel silently retargeted, and the Author edited a Block they had not chosen.
 * Dragging past the selection did the same thing.
 *
 * So the id is resolved *before* the mutation and the path rebuilt from it after. That fixes
 * the whole class rather than the two cases that were noticed, and a Block that no longer
 * exists clears the selection instead of pointing at its neighbour.
 *
 * Only Block selections need this. A Section selection is already a position that Sections
 * moving would break in the same way, but nothing in the Editor reorders Sections while one
 * is selected without going through `select` itself.
 */
function followSelection(before: PageLayout, after: PageLayout, selection: Selection): Selection {
  if (!selection) return null;

  if (selection.kind === "block") {
    const selected = blockAt(before, selection.path);
    if (!selected) return null;
    const path = findBlockPath(after, selected.id);
    return path ? { kind: "block", path } : null;
  }

  const selected = sectionAt(before, selection.path);
  if (!selected) return null;
  const path = findSectionPath(after, selected.id);
  return path ? { kind: "section", path } : null;
}

/**
 * Every action produces a new layout document. The Editor holds the whole tree in memory
 * and saves it whole (ADR-0004), so there is no partial state to reconcile.
 *
 * Undo is not handled here. This reducer answers "what does the document look like after
 * this action", and `editorReducer` below wraps it to remember what it looked like before.
 * An action that cannot be applied — a path that no longer resolves — returns `state`
 * itself, and the wrapper reads that identity as "nothing happened, record nothing".
 */
function documentReducer(state: DocumentState, action: EditorAction): DocumentState {
  switch (action.type) {
    case "select":
      return { ...state, selection: action.selection };

    case "saved":
      // Reference equality is the whole check: every action that changes the document builds
      // a new one with structuredClone, so an unchanged reference means nothing happened
      // while the save was in flight.
      return state.layout === action.layout ? { ...state, dirty: false } : state;

    // Restoring a version replaces the draft in place. It counts as an unsaved change,
    // because a restore is a proposal until the Author publishes it.
    case "loadLayout":
      return { layout: action.layout, selection: null, dirty: true };

    case "setProp": {
      const layout = structuredClone(state.layout);
      const block = blockAt(layout, action.path);
      if (!block) return state;
      block.props = { ...block.props, [action.key]: action.value };
      return { ...state, layout, dirty: true };
    }

    case "addBlock": {
      const layout = structuredClone(state.layout);
      const column = columnAt(layout, { ...action.target, index: 0 });
      if (!column) return state;
      column.blocks.push(newBlock(action.blockType));
      return {
        layout,
        dirty: true,
        selection: {
          kind: "block",
          path: { ...action.target, block: column.blocks.length - 1 },
        },
      };
    }

    case "deleteBlock": {
      const layout = structuredClone(state.layout);
      const column = columnAt(layout, action.path);
      if (!column) return state;
      column.blocks.splice(action.path.block, 1);

      // The deleted Block is gone from `layout`, so following the selection through resolves
      // to null for it and to a corrected path for every Block that shifted up behind it.
      return { layout, dirty: true, selection: followSelection(state.layout, layout, state.selection) };
    }

    case "duplicateBlock": {
      const layout = structuredClone(state.layout);
      const column = columnAt(layout, action.path);
      const block = column?.blocks[action.path.block];
      if (!column || !block) return state;

      // Directly below the original, which is where an Author building a row expects it,
      // and selected, because the next thing they do is change what makes it different.
      const index = action.path.block + 1;
      column.blocks.splice(index, 0, { ...block, id: newId("blk") });
      return {
        layout,
        dirty: true,
        selection: { kind: "block", path: { ...action.path, block: index } },
      };
    }

    case "moveBlock": {
      const layout = structuredClone(state.layout);
      const source = columnAt(layout, action.from);
      const destination = columnAt(layout, action.to);
      if (!source || !destination) return state;

      const [moved] = source.blocks.splice(action.from.block, 1);
      if (!moved) return state;

      // The index is a position in the list as it stands after the Block has been lifted
      // out, which is what a sortable drop reports. No shifting is needed either way.
      const index = Math.max(0, Math.min(action.to.index, destination.blocks.length));
      destination.blocks.splice(index, 0, moved);

      // Reordering does not change what is selected. Dragging the selected Block follows it
      // to its new home; dragging a different one leaves the panel where it was, with its
      // path corrected. Only a drag with nothing selected selects what was dragged, because
      // then there is nothing to preserve and the Author has just handled that Block.
      return {
        layout,
        dirty: true,
        selection: state.selection
          ? followSelection(state.layout, layout, state.selection)
          : {
              kind: "block",
              // Built field by field rather than spread from the drop target, which carries
              // an `index` that a BlockPath has no business holding.
              path: { slot: action.to.slot, section: action.to.section, column: action.to.column, block: index },
            },
      };
    }

    case "addSection": {
      const layout = structuredClone(state.layout);
      layout.slots[action.slot].push(newSection(action.layout));
      return {
        layout,
        dirty: true,
        selection: {
          kind: "section",
          path: { slot: action.slot, section: layout.slots[action.slot].length - 1 },
        },
      };
    }

    case "deleteSection": {
      const layout = structuredClone(state.layout);
      layout.slots[action.path.slot].splice(action.path.section, 1);

      // Clearing the selection outright was safe but wrong: deleting the first Section threw
      // away a selection on a Block in the third. Following it keeps that, and still clears
      // when what was selected is what was deleted.
      return { layout, dirty: true, selection: followSelection(state.layout, layout, state.selection) };
    }

    case "duplicateSection": {
      const layout = structuredClone(state.layout);
      const sections = layout.slots[action.path.slot];
      const section = sections[action.path.section];
      if (!section) return state;

      const index = action.path.section + 1;
      sections.splice(index, 0, copySection(section));
      return {
        layout,
        dirty: true,
        selection: { kind: "section", path: { slot: action.path.slot, section: index } },
      };
    }

    case "moveSection": {
      const layout = structuredClone(state.layout);
      const sections = layout.slots[action.slot];
      const [moved] = sections.splice(action.from, 1);
      if (!moved) return state;
      sections.splice(action.to, 0, moved);
      return {
        layout,
        dirty: true,
        selection: state.selection
          ? followSelection(state.layout, layout, state.selection)
          : { kind: "section", path: { slot: action.slot, section: action.to } },
      };
    }

    case "setBlockStyle": {
      const layout = structuredClone(state.layout);
      const block = blockAt(layout, action.path);
      if (!block) return state;

      block.style = { ...blockStyleDefaults(), ...block.style, ...action.style };
      return { ...state, layout, dirty: true };
    }

    case "setSectionStyle": {
      const layout = structuredClone(state.layout);
      const section = sectionAt(layout, action.path);
      if (!section) return state;

      Object.assign(section, action.style);
      return { ...state, layout, dirty: true };
    }

    case "setSectionLayout": {
      const layout = structuredClone(state.layout);
      const section = sectionAt(layout, action.path);
      if (!section) return state;

      const wanted = columnCount(action.layout);
      section.layout = action.layout;

      if (section.columns.length > wanted) {
        // Blocks in the Columns being removed are kept, not silently discarded: they move
        // into the last surviving Column.
        const removed = section.columns.splice(wanted);
        const last = section.columns[wanted - 1];
        if (last) {
          for (const column of removed) last.blocks.push(...column.blocks);
        }
      } else {
        while (section.columns.length < wanted) section.columns.push(emptyColumn());
      }

      // Blocks keep their ids but change Column, so the selected path is stale the moment
      // Columns merge. Carrying it over unchanged is worse than losing it: a path into a
      // Column that still exists stays *valid* and addresses a different Block, which is the
      // I-17 failure the audit closed as a class. `followSelection` re-finds it by id.
      return {
        layout,
        dirty: true,
        selection: followSelection(state.layout, layout, state.selection),
      };
    }

    default:
      return state;
  }
}

/**
 * Identifies a run of typing: the field being edited, not the value.
 *
 * Two edits collapse only when they are the same key of the same Block, so tabbing to the
 * next field starts a fresh history entry and undo lands on a boundary an Author recognises.
 */
function editRun(path: BlockPath, key: string): string {
  return `${path.slot}/${path.section}/${path.column}/${path.block}#${key}`;
}

/**
 * The reducer the Editor uses: `documentReducer`, plus the memory of what came before.
 *
 * Undo restores a whole layout rather than inverting an action. The Editor already holds
 * the entire tree and saves it whole (ADR-0004), so a snapshot is the natural unit and
 * there is no inverse to write for each of the thirteen cases — which is also the reason a
 * later action can be added without thinking about undo at all.
 */
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === "undo") {
    const previous = state.past[state.past.length - 1];
    if (!previous) return state;
    return {
      ...state,
      layout: previous,
      past: state.past.slice(0, -1),
      future: [state.layout, ...state.future],
      selection: followSelection(state.layout, previous, state.selection),
      // Always dirty, even when the undo lands back on what was last saved. Claiming a Page
      // is saved when it might not be is the expensive direction of that mistake; offering a
      // save that turns out to be a no-op costs nothing.
      dirty: true,
      typing: null,
    };
  }

  if (action.type === "redo") {
    const next = state.future[0];
    if (!next) return state;
    return {
      ...state,
      layout: next,
      past: [...state.past, state.layout].slice(-HISTORY_LIMIT),
      future: state.future.slice(1),
      selection: followSelection(state.layout, next, state.selection),
      dirty: true,
      typing: null,
    };
  }

  const next = documentReducer(state, action);

  // The document is untouched: a selection, a save, or an action whose path did not resolve.
  // Nothing to remember, but the typing run ends — the Author has moved on.
  if (next.layout === state.layout) {
    // An action that changed nothing at all returns the very same object, so `useReducer`
    // can skip the re-render. Building a new one here would give every no-op a render.
    if (next === state && state.typing === null) return state;
    return { ...state, ...next, typing: null };
  }

  const typing = action.type === "setProp" ? editRun(action.path, action.key) : null;
  const continues = typing !== null && typing === state.typing;

  return {
    ...state,
    ...next,
    // A continuing run keeps the entry it already pushed, which holds the layout as it was
    // before the first keystroke — so one undo returns the whole field, not one character.
    past: continues ? state.past : [...state.past, state.layout].slice(-HISTORY_LIMIT),
    // Anything new abandons the redo branch, as every editor does.
    future: [],
    typing,
  };
}

export function canUndo(state: EditorState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: EditorState): boolean {
  return state.future.length > 0;
}

export function initialState(layout: PageLayout): EditorState {
  return { layout, selection: null, dirty: false, past: [], future: [], typing: null };
}

export function blockTypeFor(
  registry: BlockRegistry,
  layout: PageLayout,
  path: BlockPath,
): AnyBlockType | undefined {
  const block = blockAt(layout, path);
  return block ? registry.get(block.type) : undefined;
}
