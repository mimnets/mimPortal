"use client";

import type { Dispatch } from "react";

import type {
  BlockRegistry,
  FieldsShape,
  PageLayout,
  SectionDivider,
  SectionPadding,
  SectionTone,
  SectionWidth,
} from "@mimnets/core";
import { BLOCK_ANIMATIONS, BLOCK_FONTS, BLOCK_TONES, field, type ColumnLayout } from "@mimnets/core";
import type { BlockAnimation, BlockFont, BlockTone } from "@mimnets/core";

import { FieldInput } from "./FieldInput";
import { BlockIcon, ICONS_BY_BLOCK, TrashIcon } from "./icons";
import { LayoutPicker } from "./pickers";
import { blockAt, blockTypeFor, type EditorAction, type Selection } from "./state";

/**
 * "no-image" reads as "No image". Variants are declared as the strings that reach CSS, so
 * this is the one place they are turned into something an Author reads — a label map on the
 * Block Type would be a second thing to keep in step for no gain.
 */
function variantLabel(variant: string): string {
  const words = variant.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

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
      // Keyed on the Block, so selecting another one remounts this panel rather than reusing
      // it. That is what cancels an Assist request still streaming into the previous Block.
      <div className="mn-ed-panel-body" key={block.id}>
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
        <fieldset className="mn-field-group">
          <legend>Appearance</legend>

          {/* Generated from the Block Type's own `variants`, the same way every field above
              is generated from its `fields`. A Block Type with no variants declared gets no
              control, rather than a control with one option in it. */}
          {blockType.variants?.length ? (
            <label className="mn-field" htmlFor="block-variant">
              <span>Look</span>
              <select
                id="block-variant"
                value={block.style?.variant ?? blockType.variants[0]}
                onChange={(event) =>
                  dispatch({
                    type: "setBlockStyle",
                    path: selection.path,
                    style: { variant: event.target.value },
                  })
                }
              >
                {blockType.variants.map((variant) => (
                  <option key={variant} value={variant}>
                    {variantLabel(variant)}
                  </option>
                ))}
              </select>
              <small>
                The same content, arranged differently. Every look is styled in the Site's
                Theme, so all of them stay on-brand and all of them change when it does.
              </small>
            </label>
          ) : null}

          <label className="mn-field" htmlFor="block-tone">
            <span>Text colour</span>
            <select
              id="block-tone"
              value={block.style?.tone ?? "default"}
              onChange={(event) =>
                dispatch({
                  type: "setBlockStyle",
                  path: selection.path,
                  style: { tone: event.target.value as BlockTone },
                })
              }
            >
              <option value="default">Normal</option>
              <option value="muted">Muted</option>
              <option value="primary">Primary colour</option>
              <option value="accent">Accent colour</option>
              <option value="gradient">Gradient (headings)</option>
            </select>
            <small>
              From the Site's Theme, not a colour picker — so changing the Theme still
              changes this, and nothing here can be off-brand.
            </small>
          </label>

          <label className="mn-field" htmlFor="block-font">
            <span>Typeface</span>
            <select
              id="block-font"
              value={block.style?.font ?? "default"}
              onChange={(event) =>
                dispatch({
                  type: "setBlockStyle",
                  path: selection.path,
                  style: { font: event.target.value as BlockFont },
                })
              }
            >
              <option value="default">As the Block normally is</option>
              <option value="heading">Heading face</option>
              <option value="body">Body face</option>
            </select>
            <small>Setting a paragraph in the heading face makes it read as a lead.</small>
          </label>

          <label className="mn-field" htmlFor="block-animate">
            <span>Appears with</span>
            <select
              id="block-animate"
              value={block.style?.animate ?? "none"}
              onChange={(event) =>
                dispatch({
                  type: "setBlockStyle",
                  path: selection.path,
                  style: { animate: event.target.value as BlockAnimation },
                })
              }
            >
              <option value="none">No animation</option>
              <option value="fade">Fade in</option>
              <option value="rise">Rise and fade</option>
            </select>
            <small>
              Plays as the Block scrolls into view. Skipped entirely for anyone who has
              asked their system to reduce motion.
            </small>
          </label>
        </fieldset>
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
      <div className="mn-ed-panel-body" key={section.id}>
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
            <option value="mesh">Mesh gradient</option>
          </select>
          <small>
            A Section is a full-width band, so this paints the whole width. Alternating bands
            down a Page is what stops it reading as one long document.
          </small>
        </label>

        <label className="mn-field" htmlFor="section-divider">
          <span>Bottom edge</span>
          <select
            id="section-divider"
            value={section.divider}
            onChange={(event) =>
              dispatch({
                type: "setSectionStyle",
                path: selection.path,
                style: { divider: event.target.value as SectionDivider },
              })
            }
          >
            <option value="none">Straight</option>
            <option value="angle">Angled</option>
            <option value="curve">Curved</option>
          </select>
          <small>
            Drawn in this band&rsquo;s own colour, so it shows only where the band has one — a
            Section on the page background has nothing to extend over the next.
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

        <label className="mn-field" htmlFor="section-width">
          <span>Width</span>
          <select
            id="section-width"
            value={section.width}
            onChange={(event) =>
              dispatch({
                type: "setSectionStyle",
                path: selection.path,
                style: { width: event.target.value as SectionWidth },
              })
            }
          >
            <option value="measure">Normal</option>
            <option value="wide">Wide</option>
            <option value="full">Full width</option>
          </select>
          <small>
            How wide the content runs, not the band &mdash; a band is always the full width of
            the window. Full width also removes the side gutter, which is what a gallery, a
            carousel or a map wants and what a paragraph does not.
          </small>
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
