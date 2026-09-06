/**
 * The `<style>` element a Theme is compiled into, and what cannot be allowed to end it.
 *
 * `themeToCss` output is injected with `dangerouslySetInnerHTML` in every Site's root layout,
 * and that layout wraps `/admin` as well as the public pages. So a value that closes the
 * element does not merely deface a Site — it runs script in the Dashboard of every Author on
 * it, which makes this an Owner-to-Author privilege boundary rather than self-harm.
 *
 * Two independent guards, because they fail differently:
 *
 * 1. `themeSchema` decides what a *stored or generated* Theme may contain. It is the boundary
 *    for everything untrusted: an Author's saved Theme, and a Preset a model wrote.
 * 2. `themeToCss` decides what the emitted stylesheet may contain, whatever reached it. It is
 *    the boundary that survives the next token family being added, and the one that covers
 *    values entering through `defineTheme` from a Site's own `theme.ts` — code, and so not
 *    schema-checked at all.
 *
 * The first alone is what existed, and it was a denylist of CSS punctuation: `;{}()@`. Every
 * character in it closes a *declaration*, and none of them closes an *element*. The HTML
 * parser ends a `<style>` at the first `</style` regardless of whether the CSS is well formed.
 */

import { describe, expect, it } from "vitest";

import { defineTheme, themeSchema, themeToCss } from "./index";

const PALETTE = {
  background: "#ffffff",
  surface: "#fafafa",
  text: "#111111",
  muted: "#666677",
  primary: "#0b6b62",
  accent: "#c2582c",
  border: "#e2e2e6",
};

/** Every stack the Dashboard offers, plus the defaults. None may be refused. */
const REAL_STACKS = [
  '"Segoe UI", system-ui, -apple-system, sans-serif',
  'Georgia, "Iowan Old Style", "Times New Roman", serif',
  '"Palatino Linotype", Palatino, Georgia, serif',
  '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif',
  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
];

/** The shapes that end a `<style>` element rather than a CSS declaration. */
const BREAKOUTS = [
  "</style><script src=//evil.tld/x.js></script>",
  "</STYLE><script>alert(1)</script>",
  "</style ><script>alert(1)</script>",
  "</style\n><script>alert(1)</script>",
  "Georgia</style><script>alert(1)</script>",
];

describe("what a stored or generated Theme may say", () => {
  it("accepts every font stack the product actually ships", () => {
    for (const stack of REAL_STACKS) {
      const parsed = themeSchema.safeParse({ colors: PALETTE, fonts: { body: stack } });

      expect(parsed.success, `refused a real stack: ${stack}`).toBe(true);
    }
  });

  it("refuses a font stack that could end the style element", () => {
    // The old denylist admitted every one of these: none contains `;{}()@`.
    for (const attempt of BREAKOUTS) {
      const parsed = themeSchema.safeParse({ colors: PALETTE, fonts: { body: attempt } });

      expect(parsed.success, `admitted a breakout: ${attempt}`).toBe(false);
    }
  });

  it("keeps admitting what the old denylist admitted and was harmless", () => {
    // Tightening past what is already stored is its own bug: `activeTheme` re-validates on
    // read, so a Theme carrying a font name the new rule refuses is not corrected, it is
    // dropped for `theme.ts` behind one log line. A full stop closes nothing.
    for (const stack of ['"Helvetica Neue LT Std 55 Roman", Helvetica, sans-serif', "Foo 2.0, serif"]) {
      expect(
        themeSchema.safeParse({ colors: PALETTE, fonts: { body: stack } }).success,
        `refused a harmless stack: ${stack}`,
      ).toBe(true);
    }
  });

  it("refuses the markup characters generally, not only the exact sequence", () => {
    for (const attempt of ["Georgia<", "Georgia>", "Georgia/", "Geo\\rgia", "Georgia;"]) {
      expect(
        themeSchema.safeParse({ colors: PALETTE, fonts: { body: attempt } }).success,
        `admitted: ${attempt}`,
      ).toBe(false);
    }
  });
});

describe("what the emitted stylesheet may contain, whatever reached it", () => {
  /**
   * `defineTheme` is the code path: a Site's own `theme.ts` is not schema-checked, because it
   * is code rather than input. That is correct, and it is also why the schema cannot be the
   * only guard -- this asserts the one that holds regardless of how the value arrived.
   */
  it("cannot end the style element even for a value the schema never saw", () => {
    for (const attempt of BREAKOUTS) {
      const css = themeToCss(defineTheme({ colors: PALETTE, fonts: { body: attempt } }));

      expect(/<\/style/i.test(css), `the emitted CSS ends its own element: ${attempt}`).toBe(
        false,
      );
      expect(css.includes("</"), "the emitted CSS carries a literal `</`").toBe(false);
    }
  });

  it("leaves a real Theme's CSS alone", () => {
    // The escape must be inert for every legitimate value, including the `var()` forms a
    // Site's `theme.ts` uses and the percent-encoded SVG the grain texture is.
    const css = themeToCss(
      defineTheme({
        colors: PALETTE,
        fonts: { body: 'var(--mn-font-text), "Segoe UI", system-ui, sans-serif' },
        texture: "grain",
      }),
    );

    expect(css).toContain('var(--mn-font-text), "Segoe UI", system-ui, sans-serif');
    expect(css).toContain("--mn-texture: url(");
    expect(css).toContain("data:image/svg+xml");
    // The grain SVG percent-encodes its own angle brackets, so nothing in it is touched.
    expect(css).toContain("%3C/filter%3E");
    expect(css).toContain(":root {");
  });

  it("still emits every family, so the guard has not eaten the stylesheet", () => {
    const css = themeToCss(defineTheme({ colors: PALETTE }));

    for (const token of [
      "--mn-color-primary",
      "--mn-font-body",
      "--mn-radius-base",
      "--mn-border-base",
      "--mn-elevation-low",
      "--mn-surface-background",
      "--mn-mesh",
      "--mn-gradient-text",
      "--mn-texture",
      // The two `field.token` offers for reading. `blocks.css` selects on these exact
      // spellings, and the Editor's swatch builds the same names -- a token the Theme does
      // not emit is a colour that silently resolves to nothing.
      "--mn-color-accent-text",
      "--mn-color-primary-text",
    ]) {
      expect(css).toContain(token);
    }
  });
});
