import { z } from "zod";

/**
 * The four ways a card can be drawn.
 *
 * A closed set rather than a free style string, because this value reaches CSS. `surface`
 * arrives from a model in a generated Preset, and an enum is the whole of the difference
 * between offering a design choice and offering a way to write arbitrary CSS into every
 * Page of a Site.
 */
export const SURFACE_STYLES = ["flat", "bordered", "raised", "glass"] as const;

export type SurfaceStyle = (typeof SURFACE_STYLES)[number];

/**
 * A finish laid over every band, or none.
 *
 * Site-wide rather than per-Section because it is a finish, like a paper stock: a Page with
 * grain on two bands out of five looks like a mistake, not a choice.
 */
export const TEXTURES = ["none", "grain"] as const;

export type Texture = (typeof TEXTURES)[number];

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
  /**
   * The corner scale.
   *
   * A Site still states one value — `base` — and the rest is derived from it, so rebranding
   * is unchanged. What is new is that a Block no longer has to use the same corner as every
   * other Block: small chrome can be tighter than a card and a lightbox image softer, which
   * is most of what stops a Site reading as one radius applied twenty-six times.
   *
   * `none` and `full` are the two ends and do not scale. A square corner is square at any
   * base and a pill is a pill; both stay overridable, which is how a Site that wants square
   * avatars gets them.
   */
  radius: {
    none: string;
    /** Small chrome: buttons, inputs, badges, inline code. */
    sm: string;
    /** The default. Cards, images, panels. "0" reads as formal, "1rem" as friendly. */
    base: string;
    /** Large media: a lightbox image, a map, an embed. */
    lg: string;
    /** A pill, or a circle on a square element. */
    full: string;
  };
  /**
   * Line weights.
   *
   * One pixel against two is most of the difference between editorial and brutalist, and
   * until now a Theme had no way to say which it was — every rule in the Block library was
   * a hard-coded `1px`.
   */
  border: {
    /** The thinnest rule a display can draw. Deliberately does not scale with `base`. */
    hairline: string;
    /** Card edges and rules. */
    base: string;
    /** Deliberate weight: a featured plan, a quoted panel, a brutalist Site's everything. */
    bold: string;
  };
  /**
   * Shadows, tinted with the Site's own primary rather than grey.
   *
   * A grey `box-shadow` reads as a 2015 card; the same shadow carrying the brand colour
   * reads as considered. That is the whole of the difference and it is one `color-mix()`.
   *
   * Derived from the palette and, unlike every other family here, not accepted from a
   * generated Preset at all — see `themeSchema`. A shadow that does not belong to the
   * palette is the exact mistake this token exists to prevent, so there is nothing to gain
   * by letting a model name one.
   */
  elevation: {
    none: string;
    /** A card that is lifted off the page. */
    low: string;
    /** A thing that is *over* the page: a drawer, a featured plan. */
    high: string;
  };
  /**
   * How a card is drawn — the quote, the plan, the accordion item, the carousel slide.
   *
   * One word, and it changes the character of all of them at once. It is a Theme decision
   * rather than a Block field for the same reason a Section has four tones and not a colour
   * picker (ADR-0013): a Site that can put anything behind anything will.
   */
  surface: SurfaceStyle;
  /**
   * Grain, or nothing.
   *
   * A flat colour at full width is the thing that reads as cheap, and a kilobyte of
   * `feTurbulence` inlined as a data URI is what fixes it — no request, no asset, no
   * dependency. Off by default: it is a decision, and a Site that has not made it should not
   * be wearing it.
   */
  texture: Texture;
  spacing: {
    /** Vertical rhythm between Sections. */
    section: string;
    /** Gap between Columns. */
    gutter: string;
  };
  /** Maximum width of a Section's content. Narrow reads editorial, wide reads corporate. */
  measure: string;
}

/** Named once, because `defaultTheme.elevation` is mixed from it and must not drift. */
const DEFAULT_PRIMARY = "#3b6cf6";

export const defaultTheme: Theme = {
  colors: {
    background: "#ffffff",
    surface: "#f6f6f8",
    text: "#16161a",
    muted: "#6b6b78",
    primary: DEFAULT_PRIMARY,
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
  radius: radiusScale("6px"),
  border: borderScale("1px"),
  elevation: elevationScale(DEFAULT_PRIMARY),
  /**
   * Flat, because that is what three of the library's four cards already were.
   *
   * The default is chosen to leave existing Sites looking as they did rather than to be the
   * best of the four — a token that changes every Site the day it lands is a token nobody
   * trusts. A Site says `surface: "raised"` and means it.
   */
  surface: "flat",
  texture: "none",
  spacing: { section: "4rem", gutter: "2rem" },
  measure: "72rem",
};

/**
 * A length multiplied, keeping its unit.
 *
 * Arithmetic here rather than `calc()` in the emitted CSS, because a Site is allowed to
 * write `radius: { base: "0" }` — Ledger does, and squareness is its whole character — and
 * `calc(0 / 2)` resolves to a <number> rather than a <length>, which `border-radius` refuses.
 * A value this cannot parse falls back to `calc()`, which is right for everything that is
 * not zero.
 */
function scaleLength(value: string, factor: number): string {
  const parsed = /^(\d*\.?\d+)([a-z%]*)$/i.exec(value.trim());
  if (!parsed) return `calc(${value} * ${factor})`;

  const scaled = Number(parsed[1]) * factor;
  if (scaled === 0) return "0";

  // Rounded and bounded to what `length` accepts, because this scale is not private: the
  // Dashboard posts the whole derived scale back and `activeTheme` re-validates it on read.
  // Four decimals meant halving a two-decimal rem produced a third (0.25rem -> 0.125rem) and
  // doubling a large base a fourth digit (500px -> 1000px), so a Site could not save a Theme
  // this had itself derived. That is the same round trip bare "0" was admitted for, one step
  // out; deriving inside the grammar is what stops there being a third instance.
  const bounded = Math.min(scaled, 999);
  return `${Number(bounded.toFixed(2))}${parsed[2]}`;
}

/** The corner scale a Site gets from stating one value. */
function radiusScale(base: string): Theme["radius"] {
  return {
    none: "0",
    sm: scaleLength(base, 0.5),
    base,
    lg: scaleLength(base, 2),
    // Not derived: a pill is a pill whatever the base is. Overridable, which is how a Site
    // whose corners are all square gets square avatars too.
    full: "999px",
  };
}

/** The line-weight scale. `hairline` is a device pixel by definition, so it does not scale. */
function borderScale(base: string): Theme["border"] {
  return { hairline: "1px", base, bold: scaleLength(base, 2) };
}

/**
 * Shadows built from the Site's own primary.
 *
 * `color-mix(… , transparent)` is how a hex colour becomes a translucent one without the
 * Theme having to hold an rgba string — which matters, because the palette is validated as
 * six-digit hex and nothing else, and that constraint is a security boundary rather than a
 * style preference.
 *
 * Two layers each: a tight one that reads as contact with the page and a wide one that reads
 * as distance from it. One layer alone looks like a drop shadow from a menu bar.
 */
function elevationScale(primary: string): Theme["elevation"] {
  const tint = (percent: number) => `color-mix(in oklab, ${primary} ${percent}%, transparent)`;

  return {
    none: "none",
    low: `0 1px 2px ${tint(10)}, 0 4px 12px ${tint(12)}`,
    high: `0 2px 6px ${tint(10)}, 0 16px 40px ${tint(18)}`,
  };
}

/**
 * Grain, as an inline SVG.
 *
 * `feTurbulence` is a noise generator the browser already has, so this is under a kilobyte,
 * costs no request and needs no asset in the media library. Desaturated, because coloured
 * noise is not grain, and laid on at 5.5% — high enough to break a flat colour, low enough
 * that nobody looking at the Page can say what changed.
 *
 * It is a constant rather than a token: there is one grain, and a Site either wears it or
 * does not. A Site wanting a different one writes a rule in its own stylesheet, which is what
 * `blocks.css` says it is for.
 */
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)' opacity='0.055'/%3E%3C/svg%3E")`;

/**
 * A mesh gradient, which is what most "modern SaaS background" actually is: four soft
 * radial blobs of the Site's own two brand colours, over its own surface colour.
 *
 * Derived and never stated, per [ADR-0019]: it is a composition of the palette rather than a
 * value a Site has an opinion about, and a Site that states its own would be stating four
 * colours nobody validated.
 *
 * The strongest blob is capped at 32%. Above that the band stops being a tint of the surface
 * and becomes a colour of its own, at which point body text set in `--mn-color-text` is
 * being read against something nobody checked the contrast of.
 */
function meshGradient(colors: Theme["colors"]): string {
  const blob = (colour: string, percent: number, x: string, y: string, reach: string) =>
    `radial-gradient(circle at ${x} ${y}, ` +
    `color-mix(in oklab, ${colour} ${percent}%, transparent), transparent ${reach})`;

  return [
    blob(colors.primary, 32, "18%", "20%", "55%"),
    blob(colors.accent, 26, "82%", "16%", "50%"),
    blob(colors.primary, 20, "70%", "86%", "55%"),
    blob(colors.accent, 16, "10%", "80%", "48%"),
  ].join(", ");
}

/**
 * The gradient a heading is painted with, between the two *readable* brand colours.
 *
 * `primaryText` and `accentText` rather than `primary` and `accent`, and that is the whole
 * point of the token existing: gradient text is still text. A gradient run between the two
 * raw brand colours is a heading that fails contrast for however much of its width the
 * lighter end occupies — and the Starter's own accent is 3.7:1 on white, so that is not a
 * hypothetical. These two are already moved as far as they must be to be read.
 */
function textGradient(colors: Theme["colors"]): string {
  return `linear-gradient(100deg, ${colors.primaryText}, ${colors.accentText})`;
}

/**
 * The four properties every card in the library is drawn from, for one `surface` keyword.
 *
 * Emitted as custom properties rather than selected by an attribute so that the choice
 * cascades the same way every other token does — including into the Editor's preview, which
 * renders Blocks outside the Site's own document tree.
 */
function surfaceVariables(theme: Theme): Record<string, string> {
  const { colors, border, elevation } = theme;

  switch (theme.surface) {
    case "bordered":
      return {
        background: colors.background,
        "border-width": border.base,
        "border-color": colors.border,
        shadow: elevation.none,
        backdrop: "none",
      };
    case "raised":
      return {
        background: colors.background,
        "border-width": "0",
        "border-color": "transparent",
        shadow: elevation.low,
        backdrop: "none",
      };
    case "glass":
      return {
        // Translucent rather than pale: the point of glass is that what is behind it shows
        // through, so this has to be an alpha value and not a lighter colour.
        background: `color-mix(in oklab, ${colors.background} 62%, transparent)`,
        "border-width": border.hairline,
        "border-color": `color-mix(in oklab, ${colors.text} 14%, transparent)`,
        shadow: elevation.low,
        backdrop: "blur(14px) saturate(140%)",
      };
    case "flat":
    default:
      return {
        background: colors.surface,
        "border-width": "0",
        "border-color": "transparent",
        shadow: elevation.none,
        backdrop: "none",
      };
  }
}

/** Merges a Site's overrides onto the defaults, so a theme.ts only states what differs. */
export function defineTheme(overrides: DeepPartial<Theme> = {}): Theme {
  const colors = { ...defaultTheme.colors, ...overrides.colors };
  const supplied = overrides.colors ?? {};

  return {
    /**
     * The readable colours are derived from the merged palette rather than inherited.
     *
     * Each is a function of the brand colours beside it, so carrying one over from the
     * defaults paints one Site's text in another Site's palette. That was not hypothetical:
     * `themeSchema` does not carry `primaryText` or `accentText` at all — they are derived,
     * never asked for — so a stored Theme re-parsed on its way out of the database arrived
     * here without them every time, and every Site rendered `[data-tone="primary"]` in the
     * default blue while its own primary sat beside it in the settings panel.
     *
     * A Site that states one keeps it, which is how `defaultTheme` holds its own
     * hand-picked values.
     */
    colors: {
      ...colors,
      onPrimary: supplied.onPrimary ?? readableOn(colors.primary),
      onAccent: supplied.onAccent ?? readableOn(colors.accent),
      primaryText: supplied.primaryText ?? readableText(colors.primary, colors.background),
      accentText: supplied.accentText ?? readableText(colors.accent, colors.background),
    },
    fonts: { ...defaultTheme.fonts, ...overrides.fonts },
    /**
     * The three scales are rebuilt from whatever `base` ends up being, and only then are a
     * Site's own values laid over the top.
     *
     * Merging onto `defaultTheme` instead would hand a Site that states `base: "0"` the
     * default's 3px `sm` and 12px `lg`, so a Theme asking for square corners would get two
     * rounded ones it never mentioned. Same rule as the readable colours above: derive from
     * what this Theme says, and let an explicit value win.
     */
    radius: {
      ...radiusScale(overrides.radius?.base ?? defaultTheme.radius.base),
      ...overrides.radius,
    },
    border: {
      ...borderScale(overrides.border?.base ?? defaultTheme.border.base),
      ...overrides.border,
    },
    /**
     * Elevation is a function of the merged primary and is never inherited, for exactly the
     * reason `primaryText` is not: a shadow carried over from the defaults tints one Site's
     * cards with another Site's brand colour, which is the one thing a tinted shadow must
     * not do.
     */
    elevation: { ...elevationScale(colors.primary), ...overrides.elevation },
    surface: overrides.surface ?? defaultTheme.surface,
    texture: overrides.texture ?? defaultTheme.texture,
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
    /**
     * The base of the scale, kept under its old name.
     *
     * Twenty-six rules across the Block library were written against `--mn-radius`, and a
     * Site's own stylesheet may be too — Ledger's is. It is an alias for `--mn-radius-base`
     * rather than a deprecated spelling: "the Site's corner radius" is a thing worth being
     * able to say without choosing a step on a scale.
     */
    `--mn-radius: ${theme.radius.base};`,
    ...Object.entries(theme.radius).map(([key, value]) => `--mn-radius-${kebab(key)}: ${value};`),
    ...Object.entries(theme.border).map(([key, value]) => `--mn-border-${kebab(key)}: ${value};`),
    ...Object.entries(theme.elevation).map(
      ([key, value]) => `--mn-elevation-${kebab(key)}: ${value};`,
    ),
    // The keyword itself, so a Site's own CSS can branch on it; then the four properties the
    // Block library actually draws with.
    `--mn-surface: ${theme.surface};`,
    ...Object.entries(surfaceVariables(theme)).map(
      ([key, value]) => `--mn-surface-${key}: ${value};`,
    ),
    // Compositions of the palette rather than values a Site states — derived here for the
    // same reason elevation is, and absent from `themeSchema` for the same reason too.
    `--mn-mesh: ${meshGradient(theme.colors)};`,
    `--mn-gradient-text: ${textGradient(theme.colors)};`,
    `--mn-texture: ${theme.texture === "grain" ? GRAIN : "none"};`,
    `--mn-section-spacing: ${theme.spacing.section};`,
    `--mn-gutter: ${theme.spacing.gutter};`,
    `--mn-measure: ${theme.measure};`,
  ];

  // Nothing this function emits may contain `</`, whatever reached it and however it got
  // here. `\/` is a valid CSS escape for `/` and is inert in every value below, so a
  // legitimate stylesheet is unchanged -- the grain SVG percent-encodes its own brackets and
  // no font stack, colour, length or gradient contains the sequence.
  //
  // This is the half that survives the next token family. The schema above decides what a
  // Site may *state*; this decides what the page may *contain*, and a new family added to
  // `declarations` without a matching schema rule is covered by it on the day it lands.
  const styles = `:root {\n  ${declarations.join("\n  ")}\n}`;
  return styles.replace(/<\//g, "<\\/");
}

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** A CSS colour a model is allowed to produce: a hex value, and nothing else. */
const colour = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Colours must be six-digit hex, for example #0b6b62");

/**
 * A CSS length a model is allowed to produce: a number and a unit from a closed set.
 *
 * These reach `border-radius` and `border-width` in a `<style>` tag on every Page, so the
 * same reasoning applies as to `colour` — this is a validation boundary, not a nicety.
 */
const length = z
  .string()
  // Bare "0" is admitted because it is a valid CSS length and the scales produce it: `none`
  // is always "0", and every step of a Site that states `base: "0"` is too — Ledger's whole
  // character. Requiring a unit meant the Dashboard could not save a Theme it had itself
  // derived, which is a round trip nobody would have run until a client did.
  .regex(/^(0|\d{1,3}(\.\d{1,2})?(px|rem))$/, "A length like 8px, 0.5rem or 0");

/**
 * A font stack: the characters font names are made of, and nothing else.
 *
 * This was a denylist of `;{}()@` with the comment "punctuation that could close a CSS
 * declaration". That was true and it was the wrong alphabet. `themeToCss` output is injected
 * with `dangerouslySetInnerHTML`, and the HTML parser ends a `<style>` at the first `</style`
 * whatever the CSS around it says -- so escaping the *declaration* was never the boundary that
 * mattered, and `<`, `>` and `/` were all admitted.
 *
 * An allowlist rather than a longer denylist, because the failure mode of a denylist is a
 * character nobody thought of and the failure mode of an allowlist is a font that needs one.
 * The full stop is admitted deliberately: font names contain them, and the old denylist
 * admitted them, so a Theme already stored could carry one. Tightening past what is stored is
 * how a Site silently loses its Theme -- `activeTheme` re-validates on read and falls back to
 * `theme.ts` behind a single log line, which is the failure the derived radius scale had.
 * A full stop can close neither a declaration nor an element, so it costs nothing here.
 *
 * It covers every stack in the Dashboard's list and in `defaultTheme`. It deliberately does
 * not cover the `var(--mn-font-display)` forms in `starter/theme.ts`: those enter through
 * `defineTheme` from code, never through this schema, which is the distinction ADR-0019 draws
 * between what is asked for and what is derived.
 *
 * `themeToCss` guards the same ground from the other side, for values that never came through
 * here at all. Neither guard is sufficient alone.
 */
const stack = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9 ,'"._-]+$/, "A font stack: names, commas, quotes and hyphens");

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
  /**
   * A Site normally states `base` and takes the derived scale. Every step is accepted
   * individually because `defineTheme` lets an explicit value win, and a design that wants
   * square corners everywhere *except* its avatars has to be able to say so.
   */
  radius: z
    .object({
      none: length.optional(),
      sm: length.optional(),
      base: length.optional(),
      lg: length.optional(),
      full: length.optional(),
    })
    .optional(),
  border: z
    .object({
      hairline: length.optional(),
      base: length.optional(),
      bold: length.optional(),
    })
    .optional(),
  /**
   * One of four words, and nothing else.
   *
   * `elevation` is deliberately absent from this schema entirely — it is derived from the
   * palette and never asked for, like `primaryText` and `accentText`. A `box-shadow` is a
   * free-form CSS value with no shape a regex can usefully check, so accepting one from a
   * model would reopen the injection this schema exists to close, in exchange for a shadow
   * that by definition does not match the Site's own primary.
   */
  surface: z.enum(SURFACE_STYLES).optional(),
  /** One of two words. The grain itself is a constant, so there is no value to check. */
  texture: z.enum(TEXTURES).optional(),
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
    // Each family is stated rather than spread, so a key this schema does not carry cannot
    // arrive here from a cast. `elevation` is the one that matters: it has no place in
    // ThemeInput at all and is rebuilt from the palette by `defineTheme`.
    radius: { ...input.radius, base: input.radius?.base ?? base.radius.base },
    border: { ...input.border, base: input.border?.base ?? base.border.base },
    surface: input.surface ?? base.surface,
    texture: input.texture ?? base.texture,
    spacing: {
      section: input.spacing?.section ?? base.spacing.section,
      gutter: input.spacing?.gutter ?? base.spacing.gutter,
    },
    measure: input.measure ?? base.measure,
  });
}
