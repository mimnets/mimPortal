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

/**
 * How a Section is painted.
 *
 * A Section is already "a full-width horizontal band", so the band is where a background
 * belongs — not on a Block, which is constrained to its Column and would need a CSS breakout
 * hack to reach the edges. Alternating tones down a Page is most of what separates a
 * designed layout from a wall of text.
 */
export const SECTION_TONES = ["default", "surface", "primary", "dark"] as const;
export type SectionTone = (typeof SECTION_TONES)[number];

/** Vertical breathing room. A hero wants "large"; a band between two wants "flush". */
export const SECTION_PADDINGS = ["normal", "large", "flush"] as const;
export type SectionPadding = (typeof SECTION_PADDINGS)[number];

export interface SectionBackground {
  /** A storage key, like every other image in a layout. Empty means no image. */
  key: string;
  /**
   * How much dark is laid over the image, 0 to 1. Text over an unmoderated photograph is
   * unreadable at some point in every photograph, so this is not optional in practice.
   */
  overlay: number;
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
  tone: SectionTone;
  padding: SectionPadding;
  background: SectionBackground;
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
      // Defaulted, so every Page written before Sections could be painted still parses.
      tone: z.enum(SECTION_TONES).default("default"),
      padding: z.enum(SECTION_PADDINGS).default("normal"),
      background: z
        .object({
          key: z.string().default(""),
          overlay: z.number().min(0).max(1).default(0.45),
        })
        .default({ key: "", overlay: 0.45 }),
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

/**
 * How a Section starts out: unpainted, normal spacing, no photograph.
 *
 * A factory rather than three literals repeated wherever a Section is built, so adding a
 * fourth property later is one edit instead of a hunt through the Editor and three tests.
 */
export function sectionDefaults(): Pick<SectionNode, "tone" | "padding" | "background"> {
  return { tone: "default", padding: "normal", background: { key: "", overlay: 0.45 } };
}

/** An empty Page, used when creating one and as the fallback for an unparseable draft. */
export function emptyLayout(): PageLayout {
  return {
    version: 1,
    slots: { header: [], main: [], sidebar: [], footer: [] },
  };
}
