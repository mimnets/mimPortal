/**
 * The four readable colours a Theme derives rather than asks for.
 *
 * `onPrimary` and `onAccent` are what text is set in *on* a coloured button or band;
 * `primaryText` and `accentText` are the brand colours moved far enough to be *read* against
 * the page background. Nobody should have to work out a contrast ratio to choose a heading
 * colour, so none of the four is a question an Author is asked.
 *
 * They were being inherited from the defaults instead of derived, which meant every Site
 * painted them in the default theme's blue and pink. The path is worth stating because it is
 * invisible: `themeSchema` does not carry `primaryText` or `accentText` at all — correctly,
 * since they are derived — so Zod strips them from a stored Theme on the way out of the
 * database, and the merge then filled the gap from `defaultTheme`. A Site rendered
 * `[data-tone="primary"]` in #2f5ad6 while its own primary sat beside it in the settings
 * panel under the words "nothing here can be off-brand".
 *
 * The existing guard could not see it: `starter-theme.test.ts` asserts through
 * `completeTheme`, which derives correctly and is not on the render path.
 */

import { describe, expect, it } from "vitest";

import { defaultTheme, defineTheme, readableOn, themeSchema } from "./index";

/** Ink & Ember, as the Starter ships it — jade and ember, nothing like the defaults. */
const siteColours = {
  background: "#ffffff",
  surface: "#eef3f2",
  text: "#12201e",
  muted: "#5b6b68",
  primary: "#0b6b62",
  accent: "#be4d20",
  border: "#d8e3e0",
};

describe("what survives a round trip through the database", () => {
  it("confirms the schema really does drop the derived colours", () => {
    const parsed = themeSchema.safeParse({ colors: siteColours });

    // Not a bug in itself — it is why deriving on the way out has to be reliable.
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(Object.keys(parsed.data.colors)).not.toContain("primaryText");
    expect(Object.keys(parsed.data.colors)).not.toContain("accentText");
  });

  it("paints a Site's tones in that Site's colours, not the default theme's", () => {
    const parsed = themeSchema.safeParse({ colors: siteColours });
    if (!parsed.success) throw new Error("fixture should parse");

    const theme = defineTheme(parsed.data);

    expect(theme.colors.primaryText).not.toBe(defaultTheme.colors.primaryText);
    expect(theme.colors.accentText).not.toBe(defaultTheme.colors.accentText);
  });

  it("derives them from the Site's own primary and accent", () => {
    const theme = defineTheme({ colors: siteColours });

    // On white these need no darkening, so they are the brand colours themselves.
    expect(theme.colors.primaryText).toBe("#0b6b62");
    expect(theme.colors.accentText).toBe("#be4d20");
  });
});

describe("text set on a coloured band", () => {
  it("puts dark text on a pale accent rather than white", () => {
    const theme = defineTheme({ colors: { ...siteColours, accent: "#ffe9a8" } });

    // White on a pale yellow is the unreadable case, and inheriting onAccent from the
    // defaults produced exactly it.
    expect(theme.colors.onAccent).not.toBe("#ffffff");
  });

  it("puts light text on a dark primary", () => {
    const theme = defineTheme({ colors: { ...siteColours, primary: "#101820" } });

    expect(theme.colors.onPrimary).toBe("#ffffff");
  });
});

describe("a Site that states a colour itself", () => {
  it("keeps an explicit primaryText rather than deriving over it", () => {
    const theme = defineTheme({ colors: { ...siteColours, primaryText: "#123456" } });

    expect(theme.colors.primaryText).toBe("#123456");
  });

  it("keeps an explicit onPrimary", () => {
    const theme = defineTheme({ colors: { ...siteColours, onPrimary: "#fff8e7" } });

    expect(theme.colors.onPrimary).toBe("#fff8e7");
  });
});

/** WCAG's own formula, written out so the test does not trust the code it is checking. */
function ratio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const channel = (pair: string) => {
      const value = parseInt(pair, 16) / 255;
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    };
    return (
      0.2126 * channel(hex.slice(1, 3)) +
      0.7152 * channel(hex.slice(3, 5)) +
      0.0722 * channel(hex.slice(5, 7))
    );
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

describe("whatever is derived is readable", () => {
  it.each([
    ["the defaults", defaultTheme.colors],
    ["Ink & Ember", siteColours],
    ["a pale accent", { ...siteColours, accent: "#ffe9a8" }],
    ["a dark background", { ...siteColours, background: "#111111", text: "#f4f4f4" }],
  ])("clears 4.5:1 for the read-as-text colours of %s", (_name, colors) => {
    const theme = defineTheme({ colors });

    // The point of deriving rather than asking. `readableText` promises 4.5:1 and this is
    // the assertion that would have to fail before any of the values above may change.
    expect(ratio(theme.colors.primaryText, theme.colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(theme.colors.accentText, theme.colors.background)).toBeGreaterThanOrEqual(4.5);
  });

  it("derives text on a band for a Site rather than inheriting it", () => {
    // The fix, at the level that matters: a Site with a pale accent no longer inherits the
    // default's white. `readableOn` measures both options and takes the more readable, so
    // what it promises is "the better of black and white" rather than any particular ratio —
    // which is why this asserts the choice rather than a contrast figure.
    const pale = defineTheme({ colors: { ...siteColours, accent: "#ffe9a8" } });
    expect(pale.colors.onAccent).toBe("#111111");

    const dark = defineTheme({ colors: { ...siteColours, primary: "#101820" } });
    expect(dark.colors.onPrimary).toBe("#ffffff");
  });

  it("sets the shipped accent in black, which is the readable one", () => {
    // This test used to record the opposite as a known and deliberate wrong answer: white on
    // #f0568c is 3.27:1 where black is 5.77:1, and the old threshold picked white. It was left
    // alone twice because flipping it changes the button text on every Site whose accent sits
    // in that range, which is a design decision rather than an audit fix.
    //
    // Taken on 6 September, after counting: five of the ten button colours the product ships
    // were below 4.5:1, all five were accents, and every one of them passes in black.
    expect(defaultTheme.colors.onAccent).toBe("#111111");
    expect(ratio(defaultTheme.colors.onAccent, defaultTheme.colors.accent)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("keeps the shipped primary in white, which a brightness threshold would have got wrong", () => {
    // The reason this is not a threshold change. #3b6cf6 has a relative luminance of 0.1831,
    // a hair above the 0.1791 crossover the textbooks give — so lowering the old 0.55 to that
    // value would have flipped this button to black and taken it from 4.50 down to 4.19.
    //
    // Measuring both and taking the larger has no such edge. Any threshold has one somewhere.
    expect(defaultTheme.colors.onPrimary).toBe("#ffffff");
    expect(ratio("#ffffff", defaultTheme.colors.primary)).toBeGreaterThan(
      ratio("#111111", defaultTheme.colors.primary),
    );
  });

  it("picks whichever of the two actually reads, across every colour the product ships", () => {
    // The rule, stated as the property rather than as a list of answers. Every one of these
    // is a real primary or accent from `defaultTheme`, `starter/theme.ts` or a built-in
    // design, and each is a button somebody will click.
    const shipped = [
      "#3b6cf6", "#f0568c", // built-in default
      "#0b6b62", "#e05a26", // the Starter
      "#16243f", "#b0813b", // Chambers
      "#2e3a22", "#d08a1e", // Larder
      "#4338ca", "#f43f5e", // Signal
    ];

    for (const colour of shipped) {
      const chosen = readableOn(colour);
      const other = chosen === "#111111" ? "#ffffff" : "#111111";

      expect(
        ratio(chosen, colour),
        `${colour} was given ${chosen} at ${ratio(chosen, colour).toFixed(2)}:1 when ` +
          `${other} reaches ${ratio(other, colour).toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(ratio(other, colour));

      // Not a promise the rule can always keep -- a mid-grey has no readable answer -- but it
      // is one every colour the product actually ships happens to keep.
      expect(ratio(chosen, colour), `${colour} fails AA at best`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("derives the default theme's own text colours rather than carrying hand-picked ones", () => {
    const theme = defineTheme();

    // A deliberate, visible consequence of deriving uniformly: `defaultTheme` stored
    // #2f5ad6 (5.91:1 on white), while `readableText` leaves #3b6cf6 alone at 4.51:1
    // because it already clears the bar. Both pass AA; the hand-picked one was more
    // comfortable. Uniform derivation was preferred over a special case for one Theme, and
    // the ratio assertions above are what keeps that honest.
    expect(theme.colors.primaryText).toBe(defaultTheme.colors.primary);
    expect(ratio(theme.colors.primaryText, theme.colors.background)).toBeGreaterThanOrEqual(4.5);
  });
});
