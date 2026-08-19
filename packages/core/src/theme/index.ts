import { z } from "zod";

/**
 * A Site's visual identity, as tokens.
 *
 * This is what makes one Block library look like five different brands. Blocks are styled
 * against these variables and never against a literal colour, so rebranding a Site is a
 * change to this object rather than a change to any Block.
 */
export interface Theme {
  colors: {
    background: string;
    surface: string;
    text: string;
    muted: string;
    primary: string;
    onPrimary: string;
    /**
     * A second colour, for the things that should not all be primary: an eyebrow above a
     * heading, a statistic, a secondary button. A palette of one colour is what makes a
     * Site look like a template with the hue changed.
     */
    accent: string;
    onAccent: string;
    border: string;
  };
  fonts: {
    body: string;
    heading: string;
  };
  radius: {
    /** Applied to cards, images and inputs. "0" reads as formal, "1rem" as friendly. */
    base: string;
  };
  spacing: {
    /** Vertical rhythm between Sections. */
    section: string;
    /** Gap between Columns. */
    gutter: string;
  };
  /** Maximum width of a Section's content. Narrow reads editorial, wide reads corporate. */
  measure: string;
}

export const defaultTheme: Theme = {
  colors: {
    background: "#ffffff",
    surface: "#f6f6f8",
    text: "#16161a",
    muted: "#6b6b78",
    primary: "#3b6cf6",
    onPrimary: "#ffffff",
    accent: "#f0568c",
    onAccent: "#ffffff",
    border: "#e4e4e9",
  },
  fonts: {
    body: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    heading: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  radius: { base: "6px" },
  spacing: { section: "4rem", gutter: "2rem" },
  measure: "72rem",
};

/** Merges a Site's overrides onto the defaults, so a theme.ts only states what differs. */
export function defineTheme(overrides: DeepPartial<Theme> = {}): Theme {
  return {
    colors: { ...defaultTheme.colors, ...overrides.colors },
    fonts: { ...defaultTheme.fonts, ...overrides.fonts },
    radius: { ...defaultTheme.radius, ...overrides.radius },
    spacing: { ...defaultTheme.spacing, ...overrides.spacing },
    measure: overrides.measure ?? defaultTheme.measure,
  };
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

/**
 * Compiles a Theme into the custom properties every Block is styled against.
 *
 * Emitted as a `<style>` element rather than inline styles so the values cascade into
 * everything on the page, including Blocks rendered inside the Editor.
 */
export function themeToCss(theme: Theme): string {
  const declarations: string[] = [
    ...Object.entries(theme.colors).map(([key, value]) => `--mn-color-${kebab(key)}: ${value};`),
    ...Object.entries(theme.fonts).map(([key, value]) => `--mn-font-${kebab(key)}: ${value};`),
    `--mn-radius: ${theme.radius.base};`,
    `--mn-section-spacing: ${theme.spacing.section};`,
    `--mn-gutter: ${theme.spacing.gutter};`,
    `--mn-measure: ${theme.measure};`,
  ];

  return `:root {\n  ${declarations.join("\n  ")}\n}`;
}

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** A CSS colour a model is allowed to produce: a hex value, and nothing else. */
const colour = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Colours must be six-digit hex, for example #0b6b62");

/** A font stack. Punctuation that could close a CSS declaration is refused. */
const stack = z.string().min(1).max(200).regex(/^[^;{}()@]+$/, "A font stack, not a declaration");

/**
 * The schema a generated Theme is checked against.
 *
 * Presets are model output, which makes this a validation boundary rather than a
 * convenience (ADR-0007). It is deliberately strict about colour: a Theme is compiled
 * straight into CSS custom properties, so an unconstrained string here would be a way to
 * write arbitrary CSS into every Page of a Site.
 */
export const themeSchema = z.object({
  colors: z.object({
    background: colour,
    surface: colour,
    text: colour,
    muted: colour,
    primary: colour,
    accent: colour,
    border: colour,
    /**
     * Optional, and derived when absent.
     *
     * These are the two colours text is set in over a coloured band, so getting them wrong
     * means unreadable text. Asking a model to work out contrast is asking for that bug —
     * in testing, free models simply omitted them. Luminance decides it correctly every
     * time, so the model is not asked.
     */
    onPrimary: colour.optional(),
    onAccent: colour.optional(),
  }),
  /**
   * Everything below is optional, and defaulted when absent.
   *
   * Only colour is required. A Theme’s identity is overwhelmingly its palette, and small
   * free models reliably drop the rest — in testing they omitted `fonts.body` and both
   * spacing values on every attempt, throwing away otherwise good designs. Requiring what
   * a model will not produce is a way of not shipping the feature.
   */
  fonts: z
    .object({
      // A font stack, not a URL — a Theme cannot make a Site fetch anything.
      body: stack.optional(),
      heading: stack.optional(),
    })
    .optional(),
  radius: z.object({ base: z.string().regex(/^\d{1,3}(px|rem)$/) }).optional(),
  spacing: z
    .object({
      section: z.string().regex(/^\d{1,2}(\.\d)?rem$/).optional(),
      gutter: z.string().regex(/^\d{1,2}(\.\d)?rem$/).optional(),
    })
    .optional(),
  measure: z.string().regex(/^\d{2,3}rem$/).optional(),
});

export type ThemeInput = z.infer<typeof themeSchema>;

/**
 * Black or white, whichever is readable on the given colour.
 *
 * The sRGB relative-luminance formula from WCAG. The 0.55 threshold is a shade above the
 * mathematical midpoint because white text on a mid-tone reads worse than black does.
 */
export function readableOn(hex: string): string {
  const channel = (pair: string) => {
    const value = parseInt(pair, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };

  const r = channel(hex.slice(1, 3));
  const g = channel(hex.slice(3, 5));
  const b = channel(hex.slice(5, 7));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return luminance > 0.55 ? "#111111" : "#ffffff";
}

/** Fills in the colours a generated Theme is allowed to leave out. */
export function completeTheme(input: ThemeInput, base: Theme = defaultTheme): Theme {
  return defineTheme({
    colors: {
      ...input.colors,
      onPrimary: input.colors.onPrimary ?? readableOn(input.colors.primary),
      onAccent: input.colors.onAccent ?? readableOn(input.colors.accent),
    },
    fonts: {
      body: input.fonts?.body ?? base.fonts.body,
      heading: input.fonts?.heading ?? input.fonts?.body ?? base.fonts.heading,
    },
    radius: { base: input.radius?.base ?? base.radius.base },
    spacing: {
      section: input.spacing?.section ?? base.spacing.section,
      gutter: input.spacing?.gutter ?? base.spacing.gutter,
    },
    measure: input.measure ?? base.measure,
  });
}
