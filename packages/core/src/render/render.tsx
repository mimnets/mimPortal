import type { ReactNode } from "react";

import type { BlockRegistry } from "../blocks/registry";
import { emptyContext, type RenderContext } from "./context";
import {
  columnTemplate,
  type BlockInstance,
  type ColumnNode,
  type PageLayout,
  type SectionNode,
  type SlotName,
} from "../layout/schema";

/**
 * Walks a validated layout document and renders it. Server-only: no hooks, no state. The
 * Editor renders the same components, which is what makes the preview honest.
 */

function BlockView({
  block,
  registry,
  context,
}: {
  block: BlockInstance;
  registry: BlockRegistry;
  context: RenderContext;
}) {
  const blockType = registry.get(block.type);

  // Unreachable through a validated layout, but a Site whose registry changed under an old
  // Page should show a gap rather than crash the request.
  if (!blockType) return null;

  return (
    <div
      className="mn-block"
      data-block={block.type}
      // Every value here is a Theme token, resolved in CSS. Nothing inline, so a Block
      // cannot carry a colour the Theme does not know about.
      data-tone={block.style?.tone !== "default" ? block.style?.tone : undefined}
      data-font={block.style?.font !== "default" ? block.style?.font : undefined}
      data-animate={block.style?.animate !== "none" ? block.style?.animate : undefined}
      // The variant is emitted whatever it is, including the first one. A Block Type's looks
      // are a set of equals rather than a default and some deviations, so there is no value
      // here that means "unstyled" and nothing to leave off.
      data-variant={block.style?.variant}
    >
      {blockType.render(block.props, context)}
    </div>
  );
}

function ColumnView({
  column,
  registry,
  context,
}: {
  column: ColumnNode;
  registry: BlockRegistry;
  context: RenderContext;
}) {
  return (
    <div className="mn-column">
      {column.blocks.map((block) => (
        <BlockView key={block.id} block={block} registry={registry} context={context} />
      ))}
    </div>
  );
}

function SectionView({
  section,
  registry,
  context,
}: {
  section: SectionNode;
  registry: BlockRegistry;
  context: RenderContext;
}) {
  const image = section.background.key
    ? `${context.mediaBaseUrl}/${section.background.key}`
    : null;

  return (
    <section
      className="mn-section"
      data-layout={section.layout}
      data-tone={section.tone}
      data-padding={section.padding}
      data-has-image={image ? "true" : undefined}
      style={
        image
          ? {
              // The gradient is the overlay: two identical stops make a flat wash, and
              // stacking it above the image in one property keeps this to a single layer.
              backgroundImage:
                `linear-gradient(rgb(0 0 0 / ${section.background.overlay}), ` +
                `rgb(0 0 0 / ${section.background.overlay})), url("${image}")`,
            }
          : undefined
      }
    >
      <div
        className="mn-columns"
        // The template is a custom property so the stylesheet's media query can collapse
        // Columns to a single stack on narrow screens without fighting an inline style.
        style={{ ["--mn-columns" as string]: columnTemplate(section.layout) }}
      >
        {section.columns.map((column) => (
          <ColumnView key={column.id} column={column} registry={registry} context={context} />
        ))}
      </div>
    </section>
  );
}

export function SlotView({
  layout,
  slot,
  registry,
  context = emptyContext(),
}: {
  layout: PageLayout;
  slot: SlotName;
  registry: BlockRegistry;
  context?: RenderContext;
}): ReactNode {
  const sections = layout.slots[slot];
  if (sections.length === 0) return null;

  // The Header and Footer are landmarks, not decoration. Rendered as <div> they were
  // invisible to the one navigation aid that would have made a long Shared Header bearable:
  // without a banner and a contentinfo, somebody using a screen reader has no way to jump
  // past the Menu and meets it again on every Page of the Site.
  const Tag = slot === "header" ? "header" : slot === "footer" ? "footer" : "div";

  return (
    <Tag className="mn-slot" data-slot={slot}>
      {sections.map((section) => (
        <SectionView key={section.id} section={section} registry={registry} context={context} />
      ))}
    </Tag>
  );
}
