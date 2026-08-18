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
    <div className="mn-block" data-block={block.type}>
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
  return (
    <section className="mn-section" data-layout={section.layout}>
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

  return (
    <div className="mn-slot" data-slot={slot}>
      {sections.map((section) => (
        <SectionView key={section.id} section={section} registry={registry} context={context} />
      ))}
    </div>
  );
}
