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

export interface EditorState {
  layout: PageLayout;
  selection: Selection;
  dirty: boolean;
}

export type EditorAction =
  | { type: "select"; selection: Selection }
  | { type: "setProp"; path: BlockPath; key: string; value: unknown }
  | { type: "setBlockStyle"; path: BlockPath; style: Partial<BlockStyle> }
  | { type: "addBlock"; target: Omit<DropTarget, "index">; blockType: AnyBlockType }
  | { type: "deleteBlock"; path: BlockPath }
  | { type: "moveBlock"; from: BlockPath; to: DropTarget }
  | { type: "addSection"; slot: SlotName; layout: ColumnLayout }
  | { type: "deleteSection"; path: SectionPath }
  | { type: "moveSection"; slot: SlotName; from: number; to: number }
  | { type: "setSectionLayout"; path: SectionPath; layout: ColumnLayout }
  | { type: "setSectionStyle"; path: SectionPath; style: Partial<SectionStyle> }
  | { type: "loadLayout"; layout: PageLayout }
  | { type: "saved" };

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
 * Every action produces a new layout document. The Editor holds the whole tree in memory
 * and saves it whole (ADR-0004), so there is no partial state to reconcile.
 */
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "select":
      return { ...state, selection: action.selection };

    case "saved":
      return { ...state, dirty: false };

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
      const stillSelected =
        state.selection?.kind === "block" && samePath(state.selection.path, action.path);
      return { layout, dirty: true, selection: stillSelected ? null : state.selection };
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
      return {
        layout,
        dirty: true,
        selection: { kind: "block", path: { ...action.to, block: index } },
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
      return { layout, dirty: true, selection: null };
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
        selection: { kind: "section", path: { slot: action.slot, section: action.to } },
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
      return { layout, dirty: true, selection: state.selection };
    }

    default:
      return state;
  }
}

export function initialState(layout: PageLayout): EditorState {
  return { layout, selection: null, dirty: false };
}

export function blockTypeFor(
  registry: BlockRegistry,
  layout: PageLayout,
  path: BlockPath,
): AnyBlockType | undefined {
  const block = blockAt(layout, path);
  return block ? registry.get(block.type) : undefined;
}
