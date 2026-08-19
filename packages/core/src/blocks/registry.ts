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
  /** Never throws — for reads, where one broken Page must not take down the Site. */
  safeParseLayout(value: unknown): { layout: PageLayout; error: string | null };
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

  // Defaulted, so every Block written before Blocks could be styled still parses.
  const style = z
    .object({
      tone: z.enum(BLOCK_TONES).default("default"),
      font: z.enum(BLOCK_FONTS).default("default"),
      animate: z.enum(BLOCK_ANIMATIONS).default("none"),
    })
    .default({ tone: "default", font: "default", animate: "none" });

  const variants = blocks.map((block) =>
    z.object({
      id: z.string().min(1),
      type: z.literal(block.name),
      props: block.propsSchema,
      style,
    }),
  ) as unknown as [z.ZodObject<z.ZodRawShape>, ...z.ZodObject<z.ZodRawShape>[]];

  // A Block whose `type` this Site does not register fails validation here, rather than
  // rendering as a silent gap in the page.
  const blockSchema = z.discriminatedUnion("type", variants) as unknown as z.ZodType<BlockInstance>;
  const layoutSchema = buildLayoutSchema(blockSchema) as unknown as z.ZodType<PageLayout>;

  return {
    blocks,
    get: (name) => byName.get(name),
    layoutSchema,
    parseLayout: (value) => layoutSchema.parse(value),
    safeParseLayout: (value) => {
      const result = layoutSchema.safeParse(value);
      return result.success
        ? { layout: result.data, error: null }
        : { layout: emptyLayout(), error: z.prettifyError(result.error) };
    },
  };
}
