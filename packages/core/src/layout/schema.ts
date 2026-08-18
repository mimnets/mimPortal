import { z } from "zod";

/**
 * The shape of a Page's layout document (ADR-0004).
 *
 * A Page is a tree: Slots hold Sections, Sections hold Columns, Columns hold an ordered
 * list of Blocks. There is no absolute positioning and Blocks never nest (ADR-0003).
 */
export const SLOT_NAMES = ["header", "main", "sidebar", "footer"] as const;
export type SlotName = (typeof SLOT_NAMES)[number];

/** Column layouts, as ratios. Anything not in this map cannot be expressed. */
export const COLUMN_LAYOUTS = {
  "1": [1],
  "1-1": [1, 1],
  "1-1-1": [1, 1, 1],
  "1-1-1-1": [1, 1, 1, 1],
  "2-1": [2, 1],
  "1-2": [1, 2],
} as const;

export type ColumnLayout = keyof typeof COLUMN_LAYOUTS;

const COLUMN_LAYOUT_NAMES = Object.keys(COLUMN_LAYOUTS) as [ColumnLayout, ...ColumnLayout[]];

/** CSS `grid-template-columns` for a layout, e.g. "2-1" becomes "2fr 1fr". */
export function columnTemplate(layout: ColumnLayout): string {
  return COLUMN_LAYOUTS[layout].map((ratio) => `${ratio}fr`).join(" ");
}

export function columnCount(layout: ColumnLayout): number {
  return COLUMN_LAYOUTS[layout].length;
}

export interface BlockInstance {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

export interface ColumnNode {
  id: string;
  blocks: BlockInstance[];
}

export interface SectionNode {
  id: string;
  layout: ColumnLayout;
  columns: ColumnNode[];
}

export interface PageLayout {
  /** Bumped when the document shape changes, so old Pages can be migrated rather than guessed at. */
  version: 1;
  slots: Record<SlotName, SectionNode[]>;
}

/**
 * Builds the layout schema around a registry's Block schema, so a layout referring to a
 * Block Type this Site does not register fails validation instead of rendering nothing.
 */
export function buildLayoutSchema(blockSchema: z.ZodType<BlockInstance>) {
  const column = z.object({
    id: z.string().min(1),
    blocks: z.array(blockSchema).default([]),
  });

  const section = z
    .object({
      id: z.string().min(1),
      layout: z.enum(COLUMN_LAYOUT_NAMES),
      columns: z.array(column),
    })
    .refine((value) => value.columns.length === columnCount(value.layout), {
      message: "Section has a different number of Columns than its layout allows",
      path: ["columns"],
    });

  const sections = z.array(section).default([]);

  return z.object({
    version: z.literal(1).default(1),
    slots: z.object({
      header: sections,
      main: sections,
      sidebar: sections,
      footer: sections,
    }),
  });
}

/** An empty Page, used when creating one and as the fallback for an unparseable draft. */
export function emptyLayout(): PageLayout {
  return {
    version: 1,
    slots: { header: [], main: [], sidebar: [], footer: [] },
  };
}
