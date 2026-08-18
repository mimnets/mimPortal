"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Dispatch } from "react";

import type { BlockInstance, BlockRegistry, ColumnNode, PageLayout, SectionNode, SlotName } from "@mimnets/core";
import { COLUMN_LAYOUTS, columnTemplate, SLOT_NAMES } from "@mimnets/core";

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
}: Common & { block: BlockInstance; path: BlockPath }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const blockType = registry.get(block.type);
  const selected = isSelectedBlock(selection, path);

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
        <button type="button" className="mn-ed-grip" {...attributes} {...listeners} aria-label="Drag block">
          ⠿
        </button>
        <span>{blockType?.label ?? block.type}</span>
        <button
          type="button"
          aria-label="Delete block"
          onClick={(event) => {
            event.stopPropagation();
            dispatch({ type: "deleteBlock", path });
          }}
        >
          ✕
        </button>
      </div>
      <div className="mn-ed-block-body">
        {blockType ? blockType.render(block.props) : <em>Unknown Block: {block.type}</em>}
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
          />
        ))}
      </SortableContext>

      {column.blocks.length === 0 ? <p className="mn-ed-empty">Drop a Block here</p> : null}

      <select
        className="mn-ed-add"
        value=""
        aria-label="Add a Block to this Column"
        onChange={(event) => {
          const blockType = registry.get(event.target.value);
          if (blockType) {
            dispatch({ type: "addBlock", target: { slot, section, column: columnIndex }, blockType });
          }
          event.target.value = "";
        }}
      >
        <option value="">+ Add Block</option>
        {registry.blocks.map((blockType) => (
          <option key={blockType.name} value={blockType.name}>
            {blockType.label}
          </option>
        ))}
      </select>
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
      onClick={() => dispatch({ type: "select", selection: { kind: "section", path: { slot, section: index } } })}
    >
      <div className="mn-ed-section-bar">
        <button type="button" className="mn-ed-grip" {...attributes} {...listeners} aria-label="Drag section">
          ⠿
        </button>
        <select
          value={section.layout}
          aria-label="Column layout"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) =>
            dispatch({
              type: "setSectionLayout",
              path: { slot, section: index },
              layout: event.target.value as keyof typeof COLUMN_LAYOUTS,
            })
          }
        >
          {Object.keys(COLUMN_LAYOUTS).map((layout) => (
            <option key={layout} value={layout}>
              {layout}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Delete section"
          onClick={(event) => {
            event.stopPropagation();
            dispatch({ type: "deleteSection", path: { slot, section: index } });
          }}
        >
          ✕
        </button>
      </div>

      <div className="mn-ed-columns" style={{ ["--mn-columns" as string]: columnTemplate(section.layout) }}>
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
}: Common & { layout: PageLayout }) {
  return (
    <div className="mn-ed-preview" onClick={() => dispatch({ type: "select", selection: null })}>
      {SLOT_NAMES.map((slot) => (
        <div key={slot} className="mn-ed-slot" data-slot={slot}>
          <header className="mn-ed-slot-label">{slot}</header>

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
              />
            ))}
          </SortableContext>

          <button
            type="button"
            className="mn-button mn-ed-add-section"
            onClick={(event) => {
              event.stopPropagation();
              dispatch({ type: "addSection", slot, layout: "1" });
            }}
          >
            + Section
          </button>
        </div>
      ))}
    </div>
  );
}
