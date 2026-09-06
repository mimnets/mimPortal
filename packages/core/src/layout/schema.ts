import { isSafeStorageKey, UNSAFE_KEY_MESSAGE } from "./storage-key";
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
 *
 * "mesh" is four soft radial blobs of the Site's own two brand colours over its surface
 * colour, which is what most of what reads as a modern background actually is. It is a tone
 * rather than a Theme-wide finish because it is a *band* — the same reasoning that put every
 * other one of these here (ADR-0013) — and it is built from the palette, so a Site still
 * cannot produce something off-brand with it.
 */
export const SECTION_TONES = ["default", "surface", "primary", "dark", "mesh"] as const;
export type SectionTone = (typeof SECTION_TONES)[number];

/**
 * The shape of a band's bottom edge.
 *
 * A Section property rather than a Block one, for ADR-0013's reason: the edge belongs to the
 * band, and a Block that could shape the band it sits in would be a Block that can change
 * something it does not own. Two shapes rather than a number, so a Site cannot draw an angle
 * so steep it eats its own content.
 *
 * The divider is painted in the band's own colour, so it shows only where the band has one:
 * a Section on the page background has nothing to extend downwards, and gets nothing.
 */
export const SECTION_DIVIDERS = ["none", "angle", "curve"] as const;
export type SectionDivider = (typeof SECTION_DIVIDERS)[number];

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

/**
 * How a Block is presented, separate from what it says.
 *
 * Every option here resolves to a Theme token. There is no colour picker and there will not
 * be one: a client who can set any colour will set one that does not belong to the Site,
 * and the whole argument of this product is constraints they cannot break — the same
 * reasoning that gave Sections a handful of tones instead of a palette (ADR-0013).
 *
 * "gradient" paints a heading with a run between the two *readable* brand colours. Headings
 * and nothing else: a gradient needs width to read as one, and across a box two characters
 * wide every glyph lands on the midpoint — a row of statistics came out as three identical
 * muddy olives. Body copy is excluded for a different reason, which is that a paragraph set
 * in gradient text is still a paragraph somebody has to read.
 */
export const BLOCK_TONES = ["default", "muted", "primary", "accent", "gradient"] as const;
export type BlockTone = (typeof BLOCK_TONES)[number];

/** Which of the Theme's two families. A Text Block set in the display face reads as a lead. */
export const BLOCK_FONTS = ["default", "heading", "body"] as const;
export type BlockFont = (typeof BLOCK_FONTS)[number];

/** Reveal on scroll. Deliberately three, and all of them quiet. */
export const BLOCK_ANIMATIONS = ["none", "fade", "rise"] as const;
export type BlockAnimation = (typeof BLOCK_ANIMATIONS)[number];

export interface BlockStyle {
  tone: BlockTone;
  font: BlockFont;
  animate: BlockAnimation;
  /**
   * Which of this Block Type's declared looks, if it declares any.
   *
   * Not an enum here, because the set is per Block Type rather than global — a testimonial's
   * "quote" and a button's "outline" have nothing to do with each other. The registry builds
   * the enum for each Block Type from its own `variants`, which is the only place that
   * knows them.
   */
  variant?: string;
}

export interface BlockInstance {
  id: string;
  type: string;
  props: Record<string, unknown>;
  style: BlockStyle;
}

/**
 * What a Block looks like before anybody styles it.
 *
 * `variants` is the Block Type's own list, and the first is its default — the Editor passes
 * it when adding a Block so the preview draws the same thing the schema would have defaulted
 * to on save. Without it a newly dropped Block renders unstyled until it is saved once.
 */
export function blockStyleDefaults(variants?: readonly string[]): BlockStyle {
  return {
    tone: "default",
    font: "default",
    animate: "none",
    ...(variants?.length ? { variant: variants[0] } : {}),
  };
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
  divider: SectionDivider;
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
      // Not caught, deliberately. A layout is not decoration: the refine below requires
      // the Column count to match it, so falling back to "1" would turn a three-Column
      // Section into a document that fails its own structural rule. A Section whose
      // layout this Site cannot name is the case `safeParseLayout` is right to refuse.
      layout: z.enum(COLUMN_LAYOUT_NAMES),
      columns: z.array(column),
      // Defaulted, so every Page written before Sections could be painted still parses; and
      // caught, so one written *after* this enum grew still parses too. `lenientLayoutSchema`
      // relaxes only the Block schema, so without the catch a single Section carrying a tone
      // this Site does not know fails the salvage parse as well as the strict one and the
      // whole Page comes back empty — I-04's failure exactly, one level up, and reachable by
      // rolling back a deploy or by publishing a Shared Slot from a Site on newer packages.
      // Falling back to "default" also keeps the value that reaches the DOM inside the enum.
      tone: z.enum(SECTION_TONES).default("default").catch("default"),
      // Caught for the same reason as `tone` above, and stated separately because the
      // reason it has not bitten is only that this enum has not grown yet. Leaving the
      // identical hole open beside a closed one is how the next instance happens.
      padding: z.enum(SECTION_PADDINGS).default("normal").catch("normal"),
      // Defaulted and caught like the two above, so a Page written before dividers existed
      // parses, and one written after this enum grows still parses on an older Site.
      divider: z.enum(SECTION_DIVIDERS).default("none").catch("none"),
      background: z
        .object({
          // Constrained because this key is interpolated into a CSS url() in an inline
          // style. See storage-key.ts.
          key: z
            .string()
            .default("")
            .refine((key) => key === "" || isSafeStorageKey(key), UNSAFE_KEY_MESSAGE),
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
export function sectionDefaults(): Pick<
  SectionNode,
  "tone" | "padding" | "divider" | "background"
> {
  return {
    tone: "default",
    padding: "normal",
    divider: "none",
    background: { key: "", overlay: 0.45 },
  };
}

/** An empty Page, used when creating one and as the fallback for an unparseable draft. */
export function emptyLayout(): PageLayout {
  return {
    version: 1,
    slots: { header: [], main: [], sidebar: [], footer: [] },
  };
}
