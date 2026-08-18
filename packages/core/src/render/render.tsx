import type { ReactNode } from "react";

import type { BlockRegistry } from "../blocks/registry";
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

function BlockView({ block, registry }: { block: BlockInstance; registry: BlockRegistry }) {
  const blockType = registry.get(block.type);

  // Unreachable through a validated layout, but a Site whose registry changed under an old
  // Page should show a gap rather than crash the request.
  if (!blockType) return null;

  return <div className="mn-block" data-block={block.type}>{blockType.render(block.props)}</div>;
}

function ColumnView({ column, registry }: { column: ColumnNode; registry: BlockRegistry }) {
  return (
    <div className="mn-column">
      {column.blocks.map((block) => (
        <BlockView key={block.id} block={block} registry={registry} />
      ))}
    </div>
  );
}

function SectionView({ section, registry }: { section: SectionNode; registry: BlockRegistry }) {
  return (
    <section className="mn-section" data-layout={section.layout}>
      <div
        className="mn-columns"
        // The template is a custom property so the stylesheet's media query can collapse
        // Columns to a single stack on narrow screens without fighting an inline style.
        style={{ ["--mn-columns" as string]: columnTemplate(section.layout) }}
      >
        {section.columns.map((column) => (
          <ColumnView key={column.id} column={column} registry={registry} />
        ))}
      </div>
    </section>
  );
}

export function SlotView({
  layout,
  slot,
  registry,
}: {
  layout: PageLayout;
  slot: SlotName;
  registry: BlockRegistry;
}): ReactNode {
  const sections = layout.slots[slot];
  if (sections.length === 0) return null;

  return (
    <div className="mn-slot" data-slot={slot}>
      {sections.map((section) => (
        <SectionView key={section.id} section={section} registry={registry} />
      ))}
    </div>
  );
}
