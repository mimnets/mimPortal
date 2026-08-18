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
