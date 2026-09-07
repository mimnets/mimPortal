import { describe, expect, it } from "vitest";

import { completeTheme, defaultTheme, defineTheme, themeSchema, themeToCss } from "./index";

/**
 * The token families M11 added: a corner scale, line weights, tinted elevation, and the one
 * word that says how a card is drawn.
 *
 * They exist because a variant is styled in the Theme layer, so variants can only differ by
 * as much as a Theme can express — and before this it could express colour, two typefaces,
 * one corner radius and two spacing values. Every test below was checked by reverting the
 * code it covers and watching it fail.
 */

const SITE = { primary: "#0b6b62", accent: "#e05a26", background: "#ffffff" };

/** A palette that passes `themeSchema`, for the tests that are about everything else. */
const PALETTE = {
  background: "#ffffff",
  surface: "#fafafa",
  text: "#111111",
  muted: "#666677",
  primary: "#2f6b8f",
  accent: "#e05a26",
  border: "#e2e2e6",
};

describe("the corner scale", () => {
  it("is derived from the one value a Site states, not merged onto the default's", () => {
    const theme = defineTheme({ radius: { base: "12px" } });

    expect(theme.radius.sm).toBe("6px");
    expect(theme.radius.base).toBe("12px");
    expect(theme.radius.lg).toBe("24px");
  });

  /**
   * The failure this is really about: merging `{ base: "0" }` onto `defaultTheme.radius`
   * leaves `sm: 3px` and `lg: 12px` behind, so Ledger — whose whole character is that a
   * practice filing your accounts does not have rounded corners — would get two rounded
   * ones it never asked for and could not see anywhere in its own theme.ts.
   */
  it("keeps a square Site square all the way down", () => {
    const theme = defineTheme({ radius: { base: "0" } });

    expect(theme.radius.sm).toBe("0");
    expect(theme.radius.base).toBe("0");
    expect(theme.radius.lg).toBe("0");
  });

  it("does arithmetic rather than emitting calc(), because calc(0 / 2) is not a length", () => {
    // `border-radius: calc(0 / 2)` resolves to a <number>, which the property refuses, so a
    // Site written the way Ledger writes its own would silently lose its small corners.
    expect(defineTheme({ radius: { base: "0" } }).radius.sm).not.toContain("calc");
  });

  it("carries units other than px", () => {
    expect(defineTheme({ radius: { base: "1rem" } }).radius.lg).toBe("2rem");
  });

  it("lets a Site state one step without losing the rest of the scale", () => {
    const theme = defineTheme({ radius: { base: "0", full: "0" } });

    // Square avatars: the reason `full` is overridable rather than a constant in the CSS.
    expect(theme.radius.full).toBe("0");
    expect(theme.radius.sm).toBe("0");
  });

  it("does not scale the two ends", () => {
    expect(defineTheme({ radius: { base: "12px" } }).radius.none).toBe("0");
    expect(defineTheme({ radius: { base: "12px" } }).radius.full).toBe("999px");
  });
});

describe("line weights", () => {
  it("derives bold from base, so a heavier Site is heavier throughout", () => {
    expect(defineTheme({ border: { base: "2px" } }).border.bold).toBe("4px");
  });

  it("keeps a hairline at one device pixel however heavy the base is", () => {
    expect(defineTheme({ border: { base: "3px" } }).border.hairline).toBe("1px");
  });
});

describe("elevation", () => {
  it("is mixed from the Site's own primary rather than grey", () => {
    const theme = defineTheme({ colors: SITE });

    expect(theme.elevation.low).toContain("#0b6b62");
    expect(theme.elevation.high).toContain("#0b6b62");
  });

  /**
   * The same defect the readable colours had, in a different family: spreading over
   * `defaultTheme.elevation` carries the default blue's shadow into a Site whose primary is
   * jade, and a shadow tinted with somebody else's brand is worse than a grey one — it is
   * the one thing a tinted shadow must not do.
   */
  it("is never inherited from the defaults", () => {
    const theme = defineTheme({ colors: SITE });

    expect(theme.elevation.low).not.toContain(defaultTheme.colors.primary);
  });

  it("is not something a Preset can name", () => {
    // A box-shadow has no shape a regex can usefully check, and this value is compiled into
    // a <style> tag on every Page. Absent from the schema is the only safe answer.
    const parsed = themeSchema.parse({
      colors: PALETTE,
      elevation: { low: "0 0 0 red; } body { display: none } .x {" },
    });

    expect("elevation" in parsed).toBe(false);
  });

  it("resolves to nothing rather than something when a Theme asks for none", () => {
    expect(defineTheme().elevation.none).toBe("none");
  });
});

describe("the surface style", () => {
  it("defaults to what the library's cards already were", () => {
    // Chosen to leave existing Sites looking as they did rather than to be the best of the
    // four. A token that changes every Site the day it lands is a token nobody trusts.
    expect(defineTheme().surface).toBe("flat");
  });

  it("changes the four properties every card is drawn from", () => {
    const flat = themeToCss(defineTheme({ colors: SITE, surface: "flat" }));
    const raised = themeToCss(defineTheme({ colors: SITE, surface: "raised" }));

    expect(flat).toContain("--mn-surface-shadow: none;");
    expect(raised).toContain("--mn-surface-shadow: 0 1px 2px color-mix");
    expect(raised).toContain("#0b6b62");
  });

  it("blurs only for glass, so no other Site pays for a backdrop-filter", () => {
    for (const surface of ["flat", "bordered", "raised"] as const) {
      expect(themeToCss(defineTheme({ surface }))).toContain("--mn-surface-backdrop: none;");
    }

    expect(themeToCss(defineTheme({ surface: "glass" }))).toContain("blur(14px)");
  });

  it("refuses a style that is not one of the four", () => {
    expect(() => themeSchema.parse({ colors: PALETTE, surface: "raised" })).not.toThrow();
    expect(() => themeSchema.parse({ colors: PALETTE, surface: "none; } body {" })).toThrow();
  });
});

describe("what reaches the stylesheet", () => {
  it("still emits --mn-radius, because a Site's own CSS is written against it", () => {
    // Ledger's globals.css uses it. It is emitted as an alias for the base of the scale
    // rather than kept on as a deprecated spelling.
    const css = themeToCss(defineTheme({ radius: { base: "10px" } }));

    expect(css).toContain("--mn-radius: 10px;");
    expect(css).toContain("--mn-radius-base: 10px;");
  });

  it("emits every step of every scale", () => {
    const css = themeToCss(defineTheme());

    for (const name of ["none", "sm", "base", "lg", "full"]) {
      expect(css).toContain(`--mn-radius-${name}:`);
    }
    for (const name of ["hairline", "base", "bold"]) {
      expect(css).toContain(`--mn-border-${name}:`);
    }
    for (const name of ["none", "low", "high"]) {
      expect(css).toContain(`--mn-elevation-${name}:`);
    }
  });

  /**
   * The Dashboard posts the whole Theme back when somebody moves a colour, and the action
   * re-parses it. So every value `defineTheme` can *produce* has to be a value `themeSchema`
   * will accept, or saving a colour fails on a Theme the code derived itself — which is a
   * round trip nobody runs until a client does.
   */
  it("accepts everything the scales derive, because the Dashboard posts them back", () => {
    // Every one of these is a base `themeSchema` accepts. The four this started with -- "0",
    // "10px", "0.5rem", "6px" -- all happen to halve into two decimals, so the test passed
    // while the derivation could still produce values the same schema refused. The rem bases
    // below are the ones that caught it: 0.25rem halves to 0.125rem, a third decimal, and
    // 500px doubles to 1000px, a fourth digit.
    for (const base of [
      "0",
      "10px",
      "0.5rem",
      "6px",
      "0.25rem",
      "0.75rem",
      "1.25rem",
      "3px",
      "500px",
      "999px",
    ]) {
      const theme = defineTheme({ radius: { base }, border: { base: base === "0" ? "1px" : base } });

      expect(() =>
        themeSchema.parse({ colors: PALETTE, radius: theme.radius, border: theme.border }),
      ).not.toThrow();
    }
  });

  it("derives a scale inside the grammar the schema accepts, for every base it accepts", () => {
    // The sampled test above is a tripwire; this is the rule. Bases are enumerated rather
    // than chosen, so the next person to widen `length` or change `scaleLength` cannot pick
    // fixtures that happen to survive. This is the same round trip bare "0" was admitted
    // for, one step out, and it is the third instance of that shape on this branch.
    const bases: string[] = ["0"];
    for (const unit of ["px", "rem"]) {
      for (const whole of [0, 1, 3, 7, 12, 99, 250, 499, 500, 999]) {
        for (const decimal of ["", ".5", ".25", ".75", ".01", ".99"]) {
          bases.push(`${whole}${decimal}${unit}`);
        }
      }
    }

    const accepted = bases.filter(
      (base) => themeSchema.safeParse({ colors: PALETTE, radius: { base } }).success,
    );
    expect(accepted.length).toBeGreaterThan(50);

    for (const base of accepted) {
      const theme = defineTheme({ radius: { base }, border: { base } });
      const parsed = themeSchema.safeParse({
        colors: PALETTE,
        radius: theme.radius,
        border: theme.border,
      });

      expect(
        parsed.success,
        `a Site stating radius.base "${base}" derives a scale its own schema refuses: ` +
          JSON.stringify(theme.radius),
      ).toBe(true);
    }
  });

  it("refuses a length that is not a length", () => {
    for (const attempt of ["8px; } body { display: none } .x {", "8", "calc(1px)", "8vw"]) {
      expect(() => themeSchema.parse({ colors: PALETTE, radius: { base: attempt } })).toThrow();
      expect(() => themeSchema.parse({ colors: PALETTE, border: { base: attempt } })).toThrow();
    }
  });
});

describe("the CSS-only looks", () => {
  it("builds the mesh from the Site's own two brand colours and nothing else", () => {
    const css = themeToCss(defineTheme({ colors: SITE }));
    const mesh = /--mn-mesh: ([^;]*);/.exec(css)?.[1] ?? "";

    expect(mesh).toContain("#0b6b62");
    expect(mesh).toContain("#e05a26");
    // Four blobs. A mesh of two is a gradient; a mesh of eight is mud.
    expect(mesh.match(/radial-gradient/g)).toHaveLength(4);
  });

  /**
   * The cap is the whole reason the mesh needs no foreground rule of its own.
   *
   * Every blob is a tint of the band it sits on, so body text keeps `--mn-color-text` and
   * the contrast it was already checked at. Let a blob run to 60% and the band becomes a
   * colour of its own, at which point the text on it is being read against something nobody
   * has looked at — which is exactly what `[data-tone="primary"]` has a whole block of
   * override rules for.
   */
  it("keeps every blob a tint rather than a colour", () => {
    const mesh = /--mn-mesh: ([^;]*);/.exec(themeToCss(defineTheme()))?.[1] ?? "";

    for (const [, percent] of mesh.matchAll(/ (\d+)%, transparent/g)) {
      expect(Number(percent)).toBeLessThanOrEqual(32);
    }
  });

  /**
   * Gradient text is still text. A run between the two *raw* brand colours is a heading that
   * fails contrast for however much of its width the lighter end occupies — and the
   * Starter's own accent is 3.7:1 on white, so that is not hypothetical.
   */
  it("runs gradient text between the readable colours, not the brand ones", () => {
    const theme = defineTheme({ colors: SITE });
    const css = themeToCss(theme);
    const gradient = /--mn-gradient-text: ([^;]*);/.exec(css)?.[1] ?? "";

    expect(gradient).toContain(theme.colors.primaryText);
    expect(gradient).toContain(theme.colors.accentText);
    // #e05a26 is the accent as picked for a button, and it is not readable as type.
    expect(gradient).not.toContain("#e05a26");
  });

  it("emits no texture at all unless a Site asks for one", () => {
    // `background-image: none` on the overlay, so a Site without grain pays for nothing —
    // not a transparent PNG, not an opacity rule, not a second selector.
    expect(themeToCss(defineTheme())).toContain("--mn-texture: none;");
  });

  it("inlines the grain rather than fetching it", () => {
    const css = themeToCss(defineTheme({ texture: "grain" }));

    expect(css).toContain("--mn-texture: url(\"data:image/svg+xml,");
    expect(css).toContain("feTurbulence");
    // Under a kilobyte is the claim the roadmap makes for it.
    expect((/--mn-texture: ([^;]*);/.exec(css)?.[1] ?? "").length).toBeLessThan(1024);
  });

  it("refuses a texture that is not one of the two", () => {
    expect(() => themeSchema.parse({ colors: PALETTE, texture: "grain" })).not.toThrow();
    expect(() => themeSchema.parse({ colors: PALETTE, texture: "url(evil)" })).toThrow();
  });
});

describe("a generated Theme completed", () => {
  it("keeps the surface the model chose", () => {
    expect(completeTheme({ colors: PALETTE, surface: "glass" }).surface).toBe("glass");
  });

  it("falls back to the base Theme when the model drops the key, as free models do", () => {
    const complete = completeTheme({ colors: PALETTE });

    expect(complete.surface).toBe(defaultTheme.surface);
    expect(complete.radius.base).toBe(defaultTheme.radius.base);
    expect(complete.border.base).toBe(defaultTheme.border.base);
  });

  it("tints elevation with the generated palette, not the default one", () => {
    expect(completeTheme({ colors: PALETTE }).elevation.high).toContain("#2f6b8f");
  });
});

/**
 * M10.5 gave a Section a width, and "wide" needed a token to resolve to.
 *
 * Derived rather than stated, like the mesh and the text gradient: a Site says how wide its
 * prose runs, and this is a Section asking for more than that. Expressing it against
 * `measure` rather than as a second literal is what makes "wide" always wider -- a Theme set
 * narrow for an editorial Site gets a proportionally narrow "wide", and no Theme can end up
 * with a "wide" that is narrower than the default it is supposed to be widening.
 */
describe("the wide measure", () => {
  it("is derived from the Site's own measure, not a second number", () => {
    expect(themeToCss(defineTheme())).toContain("--mn-measure-wide: calc(72rem * 1.25);");
  });

  it("tracks a Theme that states its own measure", () => {
    const css = themeToCss(defineTheme({ measure: "60rem" }));

    expect(css).toContain("--mn-measure: 60rem;");
    expect(css).toContain("--mn-measure-wide: calc(60rem * 1.25);");
  });

  it("is always wider than the measure it widens, whatever the Theme states", () => {
    // The property the derivation buys, and the reason it is not two independent values.
    // A literal "90rem" beside a Site that sets `measure: "96rem"` would give that Site a
    // "wide" narrower than its normal, which is the kind of wrong nobody reports as a bug.
    for (const measure of ["48rem", "60rem", "72rem", "96rem"]) {
      const css = themeToCss(defineTheme({ measure }));
      expect(css).toContain(`--mn-measure-wide: calc(${measure} * 1.25);`);
    }
  });
});
