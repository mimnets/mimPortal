import { describe, expect, it } from "vitest";

import { completeTheme, defaultTheme, readableText } from "./index";

/**
 * Colours a Theme offers as text have to be readable as text.
 *
 * A brand colour is chosen to be seen on a button, not to be read as a paragraph. The
 * Starter's own accent is #e05a26, which is 3.7:1 on white — below the 4.5:1 body text
 * needs — and the Editor offered it as a Block tone anyway, beside a note promising that
 * nothing there could be off-brand. The one option that made text hard to read was
 * presented as the safe kind.
 *
 * `readableText` moves the same hue only as far as legibility requires, so what a client
 * recognises survives and only the value changes.
 */

/** WCAG's own formula, written out here so the tests do not trust the code they check. */
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

describe("making a brand colour readable", () => {
  it("fixes the exact colour the audit measured", () => {
    // #e05a26 on #ffffff is 3.7:1 — the Starter's accent, and the finding.
    expect(ratio("#e05a26", "#ffffff")).toBeLessThan(4.5);
    expect(ratio(readableText("#e05a26", "#ffffff"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("leaves a colour that already passes exactly as it was", () => {
    const alreadyFine = "#14532d";
    expect(ratio(alreadyFine, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(readableText(alreadyFine, "#ffffff")).toBe(alreadyFine);
  });

  it("lightens rather than darkens when the page is dark", () => {
    const onDark = readableText("#1d4ed8", "#111111");
    expect(ratio(onDark, "#111111")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the hue recognisable rather than falling back to black", () => {
    const fixed = readableText("#e05a26", "#ffffff");
    const [r, , b] = [1, 3, 5].map((at) => parseInt(fixed.slice(at, at + 2), 16)) as [
      number,
      number,
      number,
    ];

    // Still a warm colour, not a grey: red dominates, as it did before.
    expect(r).toBeGreaterThan(b);
    expect(fixed).not.toBe("#111111");
  });

  it("handles a colour with no readable version by choosing legibility", () => {
    // Pure yellow on white cannot reach 4.5:1 while staying yellow.
    const fixed = readableText("#ffff00", "#ffffff");
    expect(ratio(fixed, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("what completeTheme derives", () => {
  it("gives every Theme readable text colours without being asked", () => {
    const theme = completeTheme({
      colors: {
        background: "#ffffff",
        surface: "#fafafa",
        text: "#111111",
        muted: "#f4f4f6",
        primary: "#3b6cf6",
        accent: "#e05a26",
        border: "#e2e2e6",
      },
    });

    expect(ratio(theme.colors.accentText, theme.colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(theme.colors.primaryText, theme.colors.background)).toBeGreaterThanOrEqual(4.5);
  });

  it("ships a default Theme whose own tones pass", () => {
    for (const tone of ["primaryText", "accentText", "text", "muted"] as const) {
      expect(ratio(defaultTheme.colors[tone], defaultTheme.colors.background)).toBeGreaterThanOrEqual(
        tone === "muted" ? 4.5 : 4.5,
      );
    }
  });
});
