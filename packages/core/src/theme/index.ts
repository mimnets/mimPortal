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
    /**
     * The brand colours as *text on the page*, moved far enough to be legible.
     *
     * A colour chosen for a button is chosen to be seen; read as a paragraph it often is not.
     * These are derived by `completeTheme` and never asked for, exactly as onPrimary and
     * onAccent are — a client should not have to know what a contrast ratio is to pick a
     * heading colour, and a Theme that offers an unreadable option has offered a mistake.
     */
    primaryText: string;
    accentText: string;
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
    primaryText: "#2f5ad6",
    accentText: "#b8285e",
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
/** Relative luminance, per WCAG. Shared by everything below that reasons about contrast. */
function luminanceOf(hex: string): number {
  const channel = (pair: string) => {
    const value = parseInt(pair, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };

  return (
    0.2126 * channel(hex.slice(1, 3)) +
    0.7152 * channel(hex.slice(3, 5)) +
    0.0722 * channel(hex.slice(5, 7))
  );
}

function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminanceOf(a), luminanceOf(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The same colour, moved until it is readable as text on `background`.
 *
 * A brand colour is chosen to be seen, not to be read: the Starter's own accent is #e05a26,
 * which is 3.7:1 on white and therefore below the 4.5:1 that body text needs. The Editor
 * offered it as a Block tone anyway, next to a note promising that nothing here can be
 * off-brand — so the one option that made text hard to read was presented as the safe kind.
 *
 * Darkening or lightening in a straight line keeps the hue, which is the part a client
 * recognises; the saturation and the character survive, only the value moves, and only as far
 * as it has to. A colour that already passes is returned untouched.
 */
export function readableText(colour: string, background: string): string {
  if (contrastRatio(colour, background) >= 4.5) return colour;

  const towardsBlack = luminanceOf(background) > 0.5;
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16)) as [
    number,
    number,
    number,
  ];

  // Twenty steps is finer than the eye can follow and cheap enough to run at build time.
  for (let step = 1; step <= 20; step += 1) {
    const factor = towardsBlack ? 1 - step / 20 : step / 20;
    const mix = (channel: number) =>
      Math.round(towardsBlack ? channel * factor : channel + (255 - channel) * factor);

    const candidate = `#${[mix(r), mix(g), mix(b)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")}`;

    if (contrastRatio(candidate, background) >= 4.5) return candidate;
  }

  // Nothing on this hue works against this background; legibility wins over brand.
  return towardsBlack ? "#111111" : "#ffffff";
}

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
      // The brand colours again, moved as far as they must be to be *read* on the page
      // rather than seen on a button. Derived rather than asked for, like the two above:
      // nobody should have to work out a contrast ratio to pick a heading colour.
      primaryText: readableText(input.colors.primary, input.colors.background),
      accentText: readableText(input.colors.accent, input.colors.background),
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
