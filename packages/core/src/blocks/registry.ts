import { z } from "zod";

import {
  BLOCK_ANIMATIONS,
  BLOCK_FONTS,
  BLOCK_TONES,
  buildLayoutSchema,
  emptyLayout,
  type BlockInstance,
  type PageLayout,
} from "../layout/schema";
import type { AnyBlockType } from "./define";

export interface BlockRegistry {
  blocks: AnyBlockType[];
  get(name: string): AnyBlockType | undefined;
  layoutSchema: z.ZodType<PageLayout>;
  /** Throws on invalid input — for writes, where bad data must not reach the database. */
  parseLayout(value: unknown): PageLayout;
  /**
   * Never throws — for reads, where one broken Page must not take down the Site.
   *
   * `error` is set only when the document itself is unusable, and `layout` is empty then.
   * A document whose *structure* is sound but which holds a Block that will not parse is
   * salvaged instead: the Block is dropped, `dropped` says which, and everything else
   * renders. Callers that treat any problem as fatal will render an empty Page for one bad
   * Block, which is the failure this shape exists to prevent.
   */
  safeParseLayout(value: unknown): SafeParsedLayout;
}

export interface DroppedBlock {
  slot: string;
  /** The Block's own id where it had a usable one, so it can be found in the document. */
  id: string | null;
  /** The `type` it claimed, which is usually the reason — a Block Type this Site dropped. */
  type: string | null;
  reason: string;
}

export interface SafeParsedLayout {
  layout: PageLayout;
  error: string | null;
  dropped: DroppedBlock[];
}

/**
 * Collects the Block Types a Site registers and derives the schema that validates its
 * Pages. A Site registers its Blocks explicitly in `blocks.config.ts` rather than by
 * auto-discovery: a registry you can read in one file is worth more than the ceremony it
 * saves.
 */
export function createRegistry(blocks: AnyBlockType[]): BlockRegistry {
  if (blocks.length === 0) {
    throw new Error("A Site must register at least one Block Type.");
  }

  const seen = new Set<string>();
  for (const block of blocks) {
    if (seen.has(block.name)) {
      throw new Error(`Two Block Types are registered as "${block.name}".`);
    }
    seen.add(block.name);
  }

  const byName = new Map(blocks.map((block) => [block.name, block]));

  /**
   * Every value here is defaulted, so a Block written before any of this existed still
   * parses — which is not a nicety, it is every Block on every Page of every Site.
   *
   * Built per Block Type rather than shared, because `variant` is the one style value whose
   * legal set is not global: a testimonial's "quote" and a button's "outline" have nothing to
   * do with each other, and only the Block Type knows its own list.
   */
  function styleSchema(block: AnyBlockType) {
    const base = {
      tone: z.enum(BLOCK_TONES).default("default"),
      font: z.enum(BLOCK_FONTS).default("default"),
      animate: z.enum(BLOCK_ANIMATIONS).default("none"),
    };

    if (!block.variants?.length) {
      return z.object(base).default({ tone: "default", font: "default", animate: "none" });
    }

    // The first declared variant is what the Block looks like today, so defaulting to it is
    // what lets this ship without migrating anything.
    const fallback = block.variants[0];
    return z
      .object({ ...base, variant: z.enum(block.variants).default(fallback) })
      .default({ tone: "default", font: "default", animate: "none", variant: fallback });
  }

  /**
   * Lifts a variant out of the field it used to be, for the two Block Types that had one
   * before there was a mechanism.
   *
   * A button's look was `props.style` and prose's was `props.width`. Both are stored that way
   * on every Page written so far, and `props` is about to stop carrying them — an unknown key
   * is stripped, silently, and every accent button on every Site would come back primary.
   *
   * Done here, at the parse boundary, rather than as a database migration: this is where the
   * shape of a stored document is already reconciled with the shape the code expects, it
   * needs no downtime and no script, and a Page rewrites itself into the new shape the next
   * time an Author saves it. An explicitly stated `style.variant` always wins, so a Page that
   * has been saved once never consults the old field again.
   */
  function liftLegacyVariant(block: AnyBlockType, value: unknown): unknown {
    if (!block.variantWasField || typeof value !== "object" || value === null) return value;

    const node = value as { props?: unknown; style?: unknown };
    const style = (node.style ?? {}) as Record<string, unknown>;
    if (typeof style.variant === "string") return value;

    const props = (node.props ?? {}) as Record<string, unknown>;
    const legacy = props[block.variantWasField];
    if (typeof legacy !== "string" || !block.variants?.includes(legacy)) return value;

    return { ...node, style: { ...style, variant: legacy } };
  }

  const variants = blocks.map((block) =>
    z.object({
      id: z.string().min(1),
      type: z.literal(block.name),
      props: block.propsSchema,
      style: styleSchema(block),
    }),
  ) as unknown as [z.ZodObject<z.ZodRawShape>, ...z.ZodObject<z.ZodRawShape>[]];

  // A Block whose `type` this Site does not register fails validation here, rather than
  // rendering as a silent gap in the page.
  const union = z.discriminatedUnion("type", variants);

  /**
   * The stored shape is reconciled with the expected one, and then validated.
   *
   * The lift sits outside the union rather than on each member: a discriminated union reads
   * its discriminator off the option schemas themselves and refuses any option it cannot see
   * a literal `type` through, `z.preprocess` included — "Invalid discriminated union option
   * at index 0", thrown when the registry is built rather than when a Page is parsed.
   */
  const blockSchema = z.preprocess((value) => {
    const type = (value as { type?: unknown } | null)?.type;
    const block = typeof type === "string" ? byName.get(type) : undefined;
    return block ? liftLegacyVariant(block, value) : value;
  }, union) as unknown as z.ZodType<BlockInstance>;
  const layoutSchema = buildLayoutSchema(blockSchema) as unknown as z.ZodType<PageLayout>;

  /**
   * The same document shape with the Blocks left unread, so a Page can be salvaged when a
   * single Block will not parse. Every structural rule still applies — a Section must still
   * have the number of Columns its layout allows — because a document that fails *those* is
   * not a Page with a bad Block in it, and there is nothing to rescue.
   */
  const lenientLayoutSchema = buildLayoutSchema(z.unknown() as z.ZodType<BlockInstance>);

  return {
    blocks,
    get: (name) => byName.get(name),
    layoutSchema,
    parseLayout: (value) => layoutSchema.parse(value),
    safeParseLayout: (value) => {
      const strict = layoutSchema.safeParse(value);
      if (strict.success) return { layout: strict.data, error: null, dropped: [] };

      // The strict parse failed, but a Page is not all-or-nothing. Re-parse the skeleton
      // with the Blocks left unvalidated: if the document's *shape* is sound — Slots,
      // Sections, Columns, the right number of Columns for each layout — then the failure
      // is one or more Blocks, and those can be dropped while the rest of the Page renders.
      //
      // The alternative, and what this used to do, was to return an empty layout. That
      // turns "somebody removed a Block Type from blocks.config.ts" into "every Page using
      // it is blank", which a visitor sees before an Author does.
      const lenient = lenientLayoutSchema.safeParse(value);
      if (!lenient.success) {
        // The shape itself is wrong. There is nothing here to salvage.
        return { layout: emptyLayout(), error: z.prettifyError(strict.error), dropped: [] };
      }

      const dropped: DroppedBlock[] = [];
      const slots = {} as PageLayout["slots"];

      for (const [slot, sections] of Object.entries(lenient.data.slots)) {
        slots[slot as keyof PageLayout["slots"]] = sections.map((section) => ({
          ...section,
          columns: section.columns.map((column) => ({
            ...column,
            blocks: column.blocks.flatMap((candidate) => {
              const parsed = blockSchema.safeParse(candidate);
              if (parsed.success) return [parsed.data];

              const shape = candidate as { id?: unknown; type?: unknown } | null;
              dropped.push({
                slot,
                id: typeof shape?.id === "string" ? shape.id : null,
                type: typeof shape?.type === "string" ? shape.type : null,
                reason: z.prettifyError(parsed.error),
              });
              return [];
            }),
          })),
        }));
      }

      // Not an error: the Page is renderable and the caller is told what is missing from it.
      return { layout: { ...lenient.data, slots }, error: null, dropped };
    },
  };
}
