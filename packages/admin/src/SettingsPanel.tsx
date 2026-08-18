"use client";

import type { Dispatch } from "react";

import type { BlockRegistry, FieldsShape, PageLayout } from "@mimnets/core";
import type { ColumnLayout } from "@mimnets/core";

import { FieldInput } from "./FieldInput";
import { BlockIcon, ICONS_BY_BLOCK, TrashIcon } from "./icons";
import { LayoutPicker } from "./pickers";
import { blockAt, blockTypeFor, type EditorAction, type Selection } from "./state";

/**
 * The Editor's right-hand side. Forms here are generated from a Block Type's field
 * declarations — never hand-written per Block.
 */
export function SettingsPanel({
  layout,
  registry,
  selection,
  dispatch,
}: {
  layout: PageLayout;
  registry: BlockRegistry;
  selection: Selection;
  dispatch: Dispatch<EditorAction>;
}) {
  if (selection?.kind === "block") {
    const block = blockAt(layout, selection.path);
    const blockType = blockTypeFor(registry, layout, selection.path);

    if (!block || !blockType) {
      return <p className="mn-ed-hint">That Block is no longer here.</p>;
    }

    return (
      <div className="mn-ed-panel-body">
        <h2 className="mn-ed-panel-title">
          {(() => {
            const Glyph = ICONS_BY_BLOCK[blockType.name] ?? BlockIcon;
            return <Glyph />;
          })()}
          {blockType.label}
        </h2>
        {Object.entries(blockType.fields as FieldsShape).map(([name, field]) => (
          <FieldInput
            key={name}
            name={name}
            field={field}
            value={block.props[name]}
            onChange={(value) => dispatch({ type: "setProp", path: selection.path, key: name, value })}
          />
        ))}
        <button
          type="button"
          className="mn-button mn-button-danger"
          onClick={() => dispatch({ type: "deleteBlock", path: selection.path })}
        >
          <TrashIcon />
          Delete Block
        </button>
      </div>
    );
  }

  if (selection?.kind === "section") {
    const section = layout.slots[selection.path.slot][selection.path.section];
    if (!section) return <p className="mn-ed-hint">That Section is no longer here.</p>;

    return (
      <div className="mn-ed-panel-body">
        <h2>Section</h2>
        <div className="mn-field">
          <span>Column layout</span>
          <LayoutPicker
            value={section.layout}
            onChange={(layout: ColumnLayout) =>
              dispatch({ type: "setSectionLayout", path: selection.path, layout })
            }
          />
          <small>
            Narrowing a Section keeps the Blocks from the Columns it drops — they move into the
            last one.
          </small>
        </div>
        <button
          type="button"
          className="mn-button mn-button-danger"
          onClick={() => dispatch({ type: "deleteSection", path: selection.path })}
        >
          <TrashIcon />
          Delete Section
        </button>
      </div>
    );
  }

  return (
    <div className="mn-ed-panel-body">
      <h2>Nothing selected</h2>
      <p className="mn-ed-hint">
        Click a Block to edit its fields, or a Section to change its Columns. Drag by the handle
        to reorder, including from one Column into another.
      </p>
    </div>
  );
}
