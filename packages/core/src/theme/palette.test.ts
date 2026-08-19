import { describe, expect, it } from "vitest";

import { paletteFromPixels } from "./palette";

/**
 * Reading a palette out of an image.
 *
 * Tested on constructed pixel data rather than real images on purpose: what needs proving is
 * the rules — which colour becomes the background, which becomes the brand — and a
 * photograph makes those judgements impossible to assert. The browser supplies real pixels;
 * this supplies known ones.
 */

/** Builds an RGBA array from `[hex, share]` pairs, where share is a pixel count. */
function image(...parts: [string, number][]): number[] {
  const pixels: number[] = [];
  for (const [colour, count] of parts) {
    const r = parseInt(colour.slice(1, 3), 16);
    const g = parseInt(colour.slice(3, 5), 16);
    const b = parseInt(colour.slice(5, 7), 16);
    for (let i = 0; i < count; i++) pixels.push(r, g, b, 255);
  }
  return pixels;
}

describe("reading a palette from pixels", () => {
  it("takes the most common colour as the background", () => {
    const palette = paletteFromPixels(
      image(["#ffffff", 800], ["#111111", 150], ["#c0392b", 50]),
    );
    expect(palette.background).toBe("#ffffff");
  });

  it("takes the furthest colour in lightness as the text", () => {
    const palette = paletteFromPixels(
      image(["#ffffff", 800], ["#111111", 150], ["#c0392b", 50]),
    );
    expect(palette.text).toBe("#111111");
  });

  it("works on a dark design, where text is the light colour", () => {
    // The rule is "furthest in lightness", not "darkest" — otherwise a dark site gets
    // black text on a black page.
    const palette = paletteFromPixels(
      image(["#12141a", 800], ["#f4f6ff", 150], ["#66e0a3", 60]),
    );
    expect(palette.background).toBe("#12141a");
    expect(palette.text).toBe("#f4f6ff");
  });

  it("takes the most saturated present colour as the brand", () => {
    const palette = paletteFromPixels(
      image(["#ffffff", 800], ["#111111", 150], ["#c0392b", 60], ["#8a8a8a", 120]),
    );
    // Grey is more common than the red but is not a brand colour.
    expect(palette.primary).toBe("#c0392b");
  });

  it("ignores a stray saturated pixel", () => {
    // One pixel of pure magenta is a JPEG artefact, not a decision.
    const palette = paletteFromPixels(
      image(["#ffffff", 2000], ["#111111", 400], ["#1f6f4a", 100], ["#ff00ff", 2]),
    );
    expect(palette.primary).toBe("#1f6f4a");
  });

  it("picks an accent that is a different colour, not a shade of the primary", () => {
    const palette = paletteFromPixels(
      image(
        ["#ffffff", 900],
        ["#111111", 200],
        ["#1f6f4a", 120], // green
        ["#2f8f6a", 100], // a lighter green — same hue family
        ["#d2603a", 90], // orange
      ),
    );
    expect(palette.primary).toBe("#1f6f4a");
    // Within 40° of the primary's hue is a shade of it, so the orange wins.
    expect(palette.accent).toBe("#d2603a");
  });

  it("falls back to the primary when the image has only one colour family", () => {
    const palette = paletteFromPixels(image(["#ffffff", 900], ["#111111", 200], ["#1f6f4a", 120]));
    expect(palette.accent).toBe(palette.primary);
  });

  it("derives surface and border rather than sampling them", () => {
    const palette = paletteFromPixels(image(["#ffffff", 900], ["#000000", 200], ["#c0392b", 90]));
    // A step off the page, and a line — images rarely contain either as a distinct colour.
    expect(palette.surface).not.toBe(palette.background);
    expect(palette.border).not.toBe(palette.background);
    expect(palette.surface).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("always produces readable text over the brand colours", () => {
    // The whole reason contrast is computed rather than sampled.
    for (const brand of ["#f4d03f", "#111111", "#c0392b", "#ffffff"]) {
      const palette = paletteFromPixels(image(["#ffffff", 900], ["#222222", 200], [brand, 150]));
      expect(["#111111", "#ffffff"]).toContain(palette.onPrimary);
      expect(["#111111", "#ffffff"]).toContain(palette.onAccent);
    }
  });

  it("ignores transparent pixels", () => {
    // A logo on transparency would otherwise report black as the background.
    const pixels = [...image(["#c0392b", 100])];
    for (let i = 0; i < 900; i++) pixels.push(0, 0, 0, 0);
    expect(paletteFromPixels(pixels).background).toBe("#c0392b");
  });

  it("returns a usable palette for an empty image rather than throwing", () => {
    const palette = paletteFromPixels([]);
    expect(palette.background).toBe("#ffffff");
    expect(palette.primary).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("groups near-identical shades so a gradient does not swamp the count", () => {
    // A photographed wall is thousands of slightly different beiges; without bucketing none
    // of them is ever dominant.
    const pixels: number[] = [];
    for (let i = 0; i < 600; i++) pixels.push(240 + (i % 8), 236 + (i % 6), 228 + (i % 5), 255);
    pixels.push(...image(["#111111", 100], ["#8e44ad", 80]));

    const palette = paletteFromPixels(pixels);
    expect(palette.background).toMatch(/^#f[0-9a-f]/);
    expect(palette.primary).toBe("#8e44ad");
  });
});
