import { z } from "zod";

import type { BlockRegistry } from "../blocks/registry";
import type { PageLayout } from "../layout/schema";
import { completeTheme, themeSchema, type Theme } from "../theme/index";
import { collect } from "./chain";
import { describeComposition, describeLayoutRules, describeRegistry } from "./registry-prompt";
import type { AiProvider } from "./provider";

/**
 * A Preset: a Theme and a set of starting Pages, generated together.
 *
 * Together rather than separately, because generated apart they are incoherent — a
 * considered palette on a generic layout (ADR-0007). Most of what makes a Site look like its
 * own thing is the Theme; most of what makes it useful is the arrangement; a Preset that
 * produced only one of them would be half a Site.
 *
 * Everything here treats model output as untrusted input. The Zod schemas were already the
 * boundary for the Editor's writes; this is the first thing that points them at something
 * nobody wrote by hand.
 */

const pathPattern = /^\/[a-z0-9-/]*$/;

export const presetPageSchema = z.object({
  title: z.string().min(1).max(80),
  path: z.string().regex(pathPattern, "A path like /about, lowercase, no spaces"),
  /** Left unknown here; the registry validates it, because only a Site knows its Blocks. */
  sections: z.array(z.unknown()).min(1).max(12),
});

export const presetSchema = z.object({
  name: z.string().min(1).max(60),
  /** One line an Owner reads when choosing between four of these. */
  description: z.string().min(1).max(240),
  theme: themeSchema,
  pages: z.array(presetPageSchema).min(1).max(6),
});

export type PresetInput = z.infer<typeof presetSchema>;

export interface GeneratedPreset {
  name: string;
  description: string;
  /** Complete: the contrast colours are filled in here, not left to the model. */
  theme: Theme;
  pages: { title: string; path: string; layout: PageLayout }[];
}

const SYSTEM = [
  "You design websites and return them as JSON. You reply with one JSON object and nothing",
  "else — no prose before it, no explanation after it, no markdown fences.",
  "",
  "You are given the exact set of blocks a site supports and the exact shape of a page.",
  "Anything outside that is rejected by a schema and the whole result is thrown away, so",
  "invention is not a shortcut. Write real copy for the business described: specific,",
  "plausible sentences, never lorem ipsum and never square-bracket placeholders.",
].join("\n");

function buildPrompt(options: {
  brief: string;
  registry: BlockRegistry;
  /** Nudges each option away from the last, so four choices are four designs. */
  direction?: string;
  /** Present when there is a design to work from. */
  image?: string;
}): string {
  return [
    // Working from a picture is a different job from inventing a design, so it is a
    // different instruction rather than the same one with a note appended.
    options.image
      ? [
          "You are looking at a design. Rebuild it as a website using the blocks below.",
          "",
          "Match its ARRANGEMENT and its TONE: how many bands it has, what each one is doing,",
          "whether it is dense or airy, formal or loud. Where it uses something this library",
          "has no block for, use the closest one — do not invent a block.",
          "",
          "Do not attempt to name its colours. They are read from the image's pixels",
          "separately and will replace whatever you return, so spend no effort on them.",
          "",
          `What the site is for: ${options.brief || "infer it from the design"}`,
        ].join("\n")
      : `Design a website for: ${options.brief}`,
    options.direction && !options.image ? `\nTake this direction: ${options.direction}` : "",
    "",
    describeRegistry(options.registry),
    "",
    describeLayoutRules(),
    "",
    describeComposition(),
    "",
    // One word that restyles every card on the site at once, so it is worth spending four
    // lines of the prompt on. The alternative — leaving it out — is four sites that differ
    // only in palette, which is the thing this whole milestone exists to stop.
    "SURFACE",
    "The theme's `surface` decides how every card, quote, plan and slide is drawn:",
    '"flat" is a wash of the surface colour, "bordered" is a hairline outline on the page',
    'colour, "raised" is a shadow tinted with your own primary, and "glass" is translucent',
    "and blurred. Pick the one the business would pick. It is the single strongest signal of",
    "era and character in the whole theme.",
    "",
    // A literal skeleton rather than a description of one. Small models follow an example
    // they can copy; they drop keys from prose every time, and the ones they dropped were
    // fonts and spacing on every attempt during testing.
    "RETURN EXACTLY THIS SHAPE",
    "Replace the values. Do not add keys. Do not copy the comments.",
    "",
    "{",
    '  "name": "Quiet Authority",',
    '  "description": "Traditional and calm, for a practice that has been here a while.",',
    '  "theme": {',
    '    "colors": {',
    '      "background": "#ffffff",',
    '      "surface": "#f3f1ec",',
    '      "text": "#1a1a18",',
    '      "muted": "#6b6a63",',
    '      "primary": "#1f3a5f",',
    '      "accent": "#a8763e",',
    '      "border": "#e2ded6"',
    "    },",
    '    "fonts": { "body": "Georgia, serif", "heading": "Georgia, serif" },',
    '    "radius": { "base": "4px" },',
    '    "surface": "bordered",',
    '    "spacing": { "section": "5rem", "gutter": "2.5rem" },',
    '    "measure": "68rem"',
    "  },",
    '  "pages": [',
    '    { "title": "Home", "path": "/", "sections": [ ... ] }',
    "  ]",
    "}",
    "",
    "Every colour is a six-digit hex value. Pick a palette that suits this business",
    "specifically — a law firm and a skate shop should not be the same colours with the hue",
    "rotated. Fonts are CSS stacks of widely available faces.",
    "",
    "Include a home page at \"/\" plus one or two others that suit the business.",
  ].join("\n");
}

/**
 * Pulls the JSON object out of a reply.
 *
 * Models wrap JSON in fences and preambles no matter how firmly they are asked not to, and
 * throwing away an otherwise valid design over a stray "Here you go:" would be a bad trade.
 */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The reply contained no JSON object.");

  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Ids are assigned here, not by the model.
 *
 * A model asked for unique ids produces duplicates, and the Editor addresses Blocks by id —
 * two Blocks sharing one would make selecting either select both.
 */
function withIds(sections: unknown[], newId: (prefix: string) => string): unknown[] {
  return sections.map((section) => {
    const node = section as { columns?: unknown[] };
    return {
      ...(section as object),
      id: newId("sec"),
      columns: (node.columns ?? []).map((column) => {
        const col = column as { blocks?: unknown[] };
        return {
          ...(column as object),
          id: newId("col"),
          blocks: (col.blocks ?? []).map((block) => ({ ...(block as object), id: newId("blk") })),
        };
      }),
    };
  });
}

export interface GenerateOptions {
  brief: string;
  registry: BlockRegistry;
  direction?: string;
  /** Injected so generation is deterministic in tests. */
  newId?: (prefix: string) => string;
  signal?: AbortSignal;
  /**
   * A design to work from, as a data URL. The provider must report `vision`.
   *
   * What the model is asked for changes when this is present: it describes the arrangement
   * it can see rather than inventing one.
   */
  image?: string;
  /**
   * Colours read from that image's pixels, which override whatever the model says.
   *
   * A vision model *describes* colour — it will call something "a deep forest green" and
   * then produce a hex value that is approximately that. The pixels are exact, so they win.
   */
  palette?: Partial<z.infer<typeof themeSchema>["colors"]>;
}

/**
 * Generates one Preset and validates it completely before returning it.
 *
 * Invalid output is retried once, with the validation error handed back to the model — most
 * failures are a single wrong enum or a column count that does not match the layout, and
 * saying so fixes it. A second failure is reported rather than patched: silently repairing
 * model output would mean nobody ever learns the prompt is wrong.
 */
export async function generatePreset(
  provider: AiProvider,
  options: GenerateOptions,
): Promise<GeneratedPreset> {
  const newId =
    options.newId ?? ((prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`);

  let lastError: string | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = lastError
      ? `${buildPrompt(options)}\n\nYour previous reply was rejected:\n${lastError}\nReturn corrected JSON.`
      : buildPrompt(options);

    const reply = await collect(provider, {
      system: SYSTEM,
      prompt,
      json: true,
      maxTokens: 16000,
      signal: options.signal,
      image: options.image,
    });

    try {
      const parsed = presetSchema.parse(extractJson(reply));

      const pages = parsed.pages.map((page) => {
        // The registry is the authority on Blocks, so each page goes through the same
        // schema an Author's own save does. A Block Type this Site does not register fails
        // here, which is the guarantee the whole feature rests on.
        const layout = options.registry.parseLayout({
          version: 1,
          slots: { header: [], main: withIds(page.sections, newId), sidebar: [], footer: [] },
        });
        return { title: page.title, path: page.path, layout };
      });

      return {
        name: parsed.name,
        description: parsed.description,
        // Pixels beat description: anything read from the image itself wins.
        theme: completeTheme({
          ...parsed.theme,
          colors: { ...parsed.theme.colors, ...options.palette },
        }),
        pages,
      };
    } catch (cause) {
      lastError = summarise(cause);
      if (attempt === 1) {
        throw new Error(`The generated design was not valid after two attempts. ${lastError}`);
      }
    }
  }

  throw new Error("Generation failed.");
}

function summarise(cause: unknown): string {
  if (cause instanceof z.ZodError) {
    // The first few issues are the useful ones; a model handed forty lines fixes none of them.
    return z
      .prettifyError(cause)
      .split("\n")
      .slice(0, 12)
      .join("\n");
  }
  return cause instanceof Error ? cause.message : String(cause);
}

/** Four directions, so four options are four designs rather than four palettes. */
export const PRESET_DIRECTIONS = [
  "Confident and editorial. Generous whitespace, a serif for headings, restrained colour.",
  "Bright and contemporary. A saturated primary, a warm accent, rounded corners, lots of bands.",
  "Dark and technical. A near-black base, one sharp accent, tight spacing, sans-serif throughout.",
  "Warm and approachable. Soft neutral background, friendly colour, large radius, plain language.",
] as const;
