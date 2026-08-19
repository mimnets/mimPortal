"use client";

import type { Dispatch } from "react";

import type {
  BlockRegistry,
  FieldsShape,
  PageLayout,
  SectionPadding,
  SectionTone,
} from "@mimnets/core";
import { field, type ColumnLayout } from "@mimnets/core";

import { FieldInput } from "./FieldInput";
import { BlockIcon, ICONS_BY_BLOCK, TrashIcon } from "./icons";
import { LayoutPicker } from "./pickers";
import { blockAt, blockTypeFor, type EditorAction, type Selection } from "./state";

/**
 * A Section background reuses the image field, so it opens the same media library an image
 * Block does. Declared once out here rather than rebuilt on every render.
 */
const backgroundField = field.image({
  label: "Background image",
  help: "Optional. A band with a photograph behind it is the one place a Page can be loud.",
});

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
        <label className="mn-field" htmlFor="section-tone">
          <span>Background</span>
          <select
            id="section-tone"
            value={section.tone}
            onChange={(event) =>
              dispatch({
                type: "setSectionStyle",
                path: selection.path,
                style: { tone: event.target.value as SectionTone },
              })
            }
          >
            <option value="default">Page background</option>
            <option value="surface">Tinted</option>
            <option value="primary">Primary colour</option>
            <option value="dark">Dark</option>
          </select>
          <small>
            A Section is a full-width band, so this paints the whole width. Alternating bands
            down a Page is what stops it reading as one long document.
          </small>
        </label>

        <label className="mn-field" htmlFor="section-padding">
          <span>Height</span>
          <select
            id="section-padding"
            value={section.padding}
            onChange={(event) =>
              dispatch({
                type: "setSectionStyle",
                path: selection.path,
                style: { padding: event.target.value as SectionPadding },
              })
            }
          >
            <option value="normal">Normal</option>
            <option value="large">Tall</option>
            <option value="flush">No space</option>
          </select>
        </label>

        <FieldInput
          name="section-background"
          field={backgroundField}
          value={{ key: section.background.key, alt: "" }}
          onChange={(value) =>
            dispatch({
              type: "setSectionStyle",
              path: selection.path,
              style: {
                background: {
                  ...section.background,
                  key: String((value as { key?: unknown }).key ?? ""),
                },
              },
            })
          }
        />

        {section.background.key ? (
          <label className="mn-field" htmlFor="section-overlay">
            <span>Darken the image ({Math.round(section.background.overlay * 100)}%)</span>
            <input
              id="section-overlay"
              type="range"
              min={0}
              max={100}
              value={Math.round(section.background.overlay * 100)}
              onChange={(event) =>
                dispatch({
                  type: "setSectionStyle",
                  path: selection.path,
                  style: {
                    background: {
                      ...section.background,
                      overlay: Number(event.target.value) / 100,
                    },
                  },
                })
              }
            />
            <small>Text over a photograph is unreadable somewhere in every photograph.</small>
          </label>
        ) : null}

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
