import { describe, expect, it } from "vitest";
import { completeTheme, themeSchema } from "@mimnets/core";

/**
 * A Preset's Theme is browser input, and is checked like it.
 *
 * `parsePayload` re-validates a generated Preset on the way in, because the payload makes a
 * round trip through the browser before an Owner presses Apply. It validated the layouts and
 * let the Theme past — and a Theme is compiled into CSS custom properties inside a `<style>`
 * tag on every page of the Site, which makes an unchecked one a stored injection with
 * Site-wide reach rather than a cosmetic problem.
 *
 * These test the schema that now guards it. The action itself is exercised through the same
 * `themeSchema.parse` + `completeTheme` pair, so what holds here holds there.
 */

const GOOD = {
  colors: {
    background: "#ffffff",
    surface: "#fafafa",
    text: "#111111",
    muted: "#f4f4f6",
    primary: "#2f6b8f",
    accent: "#e05a26",
    border: "#e2e2e6",
  },
};

describe("a Theme arriving from the browser", () => {
  it("is accepted when its palette is real", () => {
    const parsed = themeSchema.parse(GOOD);
    expect(parsed.colors.primary).toBe("#2f6b8f");
  });

  it("gains its derived values rather than trusting supplied ones", () => {
    const complete = completeTheme(themeSchema.parse(GOOD));

    // The two contrast colours are computed from luminance, never asked for — a model or a
    // form guessing at contrast produces unreadable text.
    expect(complete.colors.onPrimary).toBeTruthy();
    expect(complete.colors.onAccent).toBeTruthy();
  });

  it("refuses a colour that is not a colour", () => {
    expect(() =>
      themeSchema.parse({ ...GOOD, colors: { ...GOOD.colors, primary: "red; }" } }),
    ).toThrow();
  });

  it("refuses the shape of a breakout attempt in a colour", () => {
    for (const attempt of [
      "#fff; } body { display: none } .x {",
      "</style><script>alert(1)</script>",
      "url(javascript:alert(1))",
      "expression(alert(1))",
    ]) {
      expect(() =>
        themeSchema.parse({ ...GOOD, colors: { ...GOOD.colors, background: attempt } }),
      ).toThrow();
    }
  });

  it("refuses a payload with no palette at all", () => {
    expect(() => themeSchema.parse({})).toThrow();
    expect(() => themeSchema.parse({ colors: {} })).toThrow();
  });

  it("refuses a font stack carrying punctuation that could close a declaration", () => {
    for (const attempt of ["Inter; } body {", "Inter, sans-serif }", "url(x)", "Inter @import"]) {
      expect(() => themeSchema.parse({ ...GOOD, fonts: { body: attempt } })).toThrow();
    }
  });

  it("refuses something that is not an object", () => {
    for (const value of [null, undefined, 42, "a string", []]) {
      expect(() => themeSchema.parse(value)).toThrow();
    }
  });
});
