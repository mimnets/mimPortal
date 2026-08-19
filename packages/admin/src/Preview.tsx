"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Dispatch } from "react";

import type {
  RenderContext,
  BlockInstance,
  BlockRegistry,
  ColumnLayout,
  ColumnNode,
  PageLayout,
  SectionNode,
  SlotName,
} from "@mimnets/core";
import { columnTemplate, emptyContext, SLOT_NAMES, SlotView } from "@mimnets/core";

import { BlockIcon, GripIcon, ICONS_BY_BLOCK, LockIcon, SlotIcon, TrashIcon } from "./icons";
import { BlockPicker, LayoutPicker } from "./pickers";
import type { BlockPath, EditorAction, Selection } from "./state";

/**
 * The preview is the Editor's left-hand side. It renders Blocks with their real `render`
 * function — the same one the public Site uses — wrapped in selection and drag chrome, so
 * what an Author sees while editing is what visitors get.
 */

interface Common {
  registry: BlockRegistry;
  selection: Selection;
  dispatch: Dispatch<EditorAction>;
  /** Resolved once by the Site, so the preview shows real Menus rather than placeholders. */
  context: RenderContext;
}

function isSelectedBlock(selection: Selection, path: BlockPath): boolean {
  return (
    selection?.kind === "block" &&
    selection.path.slot === path.slot &&
    selection.path.section === path.section &&
    selection.path.column === path.column &&
    selection.path.block === path.block
  );
}

function BlockCard({
  block,
  path,
  registry,
  selection,
  dispatch,
  context,
}: Common & { block: BlockInstance; path: BlockPath }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const blockType = registry.get(block.type);
  const selected = isSelectedBlock(selection, path);
  const Glyph = ICONS_BY_BLOCK[block.type] ?? BlockIcon;

  return (
    <div
      ref={setNodeRef}
      className={`mn-ed-block${selected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={(event) => {
        event.stopPropagation();
        dispatch({ type: "select", selection: { kind: "block", path } });
      }}
    >
      <div className="mn-ed-block-bar">
        <button
          type="button"
          className="mn-icon-button mn-ed-grip"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${blockType?.label ?? block.type} block`}
          title="Drag to move"
        >
          <GripIcon />
        </button>
        <span className="mn-ed-tag">
          <Glyph />
          {blockType?.label ?? block.type}
        </span>
        <button
          type="button"
          className="mn-icon-button mn-icon-button-danger"
          aria-label={`Delete ${blockType?.label ?? block.type} block`}
          title="Delete Block"
          onClick={(event) => {
            event.stopPropagation();
            dispatch({ type: "deleteBlock", path });
          }}
        >
          <TrashIcon />
        </button>
      </div>
      <div className="mn-ed-block-body">
        {blockType ? blockType.render(block.props, context) : <em>Unknown Block: {block.type}</em>}
      </div>
    </div>
  );
}

function Column({
  column,
  slot,
  section,
  columnIndex,
  registry,
  selection,
  dispatch,
  context,
}: Common & {
  column: ColumnNode;
  slot: SlotName;
  section: number;
  columnIndex: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.id}` });

  return (
    <div ref={setNodeRef} className={`mn-ed-column${isOver ? " is-over" : ""}`}>
      <SortableContext items={column.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        {column.blocks.map((block, index) => (
          <BlockCard
            key={block.id}
            block={block}
            path={{ slot, section, column: columnIndex, block: index }}
            registry={registry}
            selection={selection}
            dispatch={dispatch}
            context={context}
          />
        ))}
      </SortableContext>

      {column.blocks.length === 0 ? (
        <p className="mn-ed-empty">Drop a Block here</p>
      ) : null}

      <BlockPicker
        registry={registry}
        onPick={(name) => {
          const blockType = registry.get(name);
          if (blockType) {
            dispatch({ type: "addBlock", target: { slot, section, column: columnIndex }, blockType });
          }
        }}
      />
    </div>
  );
}

function Section({
  section,
  slot,
  index,
  registry,
  selection,
  dispatch,
  context,
}: Common & { section: SectionNode; slot: SlotName; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `sec:${section.id}`,
  });
  const selected =
    selection?.kind === "section" &&
    selection.path.slot === slot &&
    selection.path.section === index;

  return (
    <section
      ref={setNodeRef}
      className={`mn-ed-section${selected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={() =>
        dispatch({ type: "select", selection: { kind: "section", path: { slot, section: index } } })
      }
    >
      <div className="mn-ed-section-bar">
        <button
          type="button"
          className="mn-icon-button mn-ed-grip"
          {...attributes}
          {...listeners}
          aria-label="Drag section"
          title="Drag to reorder"
        >
          <GripIcon />
        </button>
        <span className="mn-ed-tag">Section</span>

        <LayoutPicker
          compact
          value={section.layout}
          onChange={(layout: ColumnLayout) =>
            dispatch({ type: "setSectionLayout", path: { slot, section: index }, layout })
          }
        />

        <button
          type="button"
          className="mn-icon-button mn-icon-button-danger"
          aria-label="Delete section"
          title="Delete Section"
          onClick={(event) => {
            event.stopPropagation();
            dispatch({ type: "deleteSection", path: { slot, section: index } });
          }}
        >
          <TrashIcon />
        </button>
      </div>

      <div
        className="mn-ed-columns"
        style={{ ["--mn-columns" as string]: columnTemplate(section.layout) }}
      >
        {section.columns.map((column, columnIndex) => (
          <Column
            key={column.id}
            column={column}
            slot={slot}
            section={index}
            columnIndex={columnIndex}
            registry={registry}
            selection={selection}
            dispatch={dispatch}
            context={context}
          />
        ))}
      </div>
    </section>
  );
}

export function Preview({
  layout,
  registry,
  selection,
  dispatch,
  context,
  lockedSlots = [],
  slotNotes = {},
  visibleSlots,
}: Common & {
  layout: PageLayout;
  lockedSlots?: SlotName[];
  /**
   * Which Slots to draw. Defaults to all four; a shared Header is edited on a screen that
   * shows only that one, because the other three belong to a Page and this is not one.
   */
  visibleSlots?: SlotName[];
  /**
   * Why a Slot cannot be edited here. A Header that is shared across Pages is not "locked
   * by the Owner" — it is edited somewhere else, and saying so is the difference between
   * a person finding that place and concluding the product is broken.
   */
  slotNotes?: Partial<Record<SlotName, string>>;
}) {
  return (
    <div className="mn-ed-preview" onClick={() => dispatch({ type: "select", selection: null })}>
      {(visibleSlots ?? SLOT_NAMES).map((slot) =>
        lockedSlots.includes(slot) ? (
          // A locked Slot renders through the public renderer: an Author sees exactly what a
          // visitor sees, with no handles to grab and nothing to delete.
          <div key={slot} className="mn-ed-slot is-locked" data-slot={slot}>
            <header className="mn-ed-slot-label">
              <SlotIcon slot={slot} />
              <span>{slot}</span>
              <span className="mn-ed-lock">
                <LockIcon />
                {slotNotes[slot] ?? "Locked by the Owner"}
              </span>
            </header>
            <div className="mn-ed-locked-body">
              <SlotView layout={layout} slot={slot} registry={registry} context={context} />
            </div>
          </div>
        ) : (
        <div key={slot} className="mn-ed-slot" data-slot={slot}>
          <header className="mn-ed-slot-label">
            <SlotIcon slot={slot} />
            <span>{slot}</span>
          </header>

          <SortableContext
            items={layout.slots[slot].map((section) => `sec:${section.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {layout.slots[slot].map((section, index) => (
              <Section
                key={section.id}
                section={section}
                slot={slot}
                index={index}
                registry={registry}
                selection={selection}
                dispatch={dispatch}
                context={context}
              />
            ))}
          </SortableContext>

          <button
            type="button"
            className="mn-button mn-button-ghost"
            onClick={(event) => {
              event.stopPropagation();
              dispatch({ type: "addSection", slot, layout: "1" });
            }}
          >
            + Add Section
          </button>
        </div>
        ),
      )}
    </div>
  );
}
