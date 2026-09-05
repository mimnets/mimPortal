import { defineTheme } from "@mimnets/core";

/**
 * This Site's visual identity. Change these values and every Page changes with them —
 * no Block is edited, because Blocks are styled against these tokens rather than against
 * literal colours.
 *
 * This file is the main thing that differs between one Site and the next.
 *
 * ---
 *
 * The Starter ships as "Ink & Ember", and the reasoning is worth keeping because the next
 * Site will want to argue with it.
 *
 * A deep jade holds the structure and an ember orange carries the things that ask for
 * attention. Cool for the frame, warm for the content — which is the same claim the product
 * makes, that a rigid structure is what lets the content be inviting rather than the thing
 * fighting it.
 *
 * What it deliberately is not: the cream background, high-contrast serif and terracotta
 * accent this file used to be. That combination is the default any tool reaches for when
 * nobody has decided anything, and a Starter whose whole argument is "your Site will not
 * look like everyone else's" cannot open with it.
 */
export const theme = defineTheme({
  colors: {
    background: "#ffffff",
    // A pale wash of the primary rather than a neutral grey, so a "surface" band still
    // belongs to the palette instead of looking like an absence of one.
    surface: "#eef3f2",
    // Near-black carrying the primary's hue. Pure #000 against a coloured palette reads as
    // a hole; this sits in the same family as everything else.
    text: "#0c1f21",
    muted: "#5b7276",
    primary: "#0b6b62",
    onPrimary: "#ffffff",
    accent: "#e05a26",
    onAccent: "#ffffff",
    border: "#dbe5e3",
  },
  fonts: {
    // Loaded and self-hosted by next/font in app/layout.tsx — no request ever leaves the
    // visitor's browser for a font, which keeps a Site out of the consent-banner problem.
    heading: 'var(--mn-font-display), "Segoe UI", system-ui, sans-serif',
    body: 'var(--mn-font-text), "Segoe UI", system-ui, sans-serif',
  },
  // Enough to read as contemporary, not enough to read as a toy. Stating `base` derives the
  // whole scale from it — 5px on a button, 20px on a lightbox image — so the corners vary
  // the way a designer would vary them without any of them being decided twice.
  radius: { base: "10px" },
  // One pixel. "Ink & Ember" argues that a rigid structure is what lets the content be
  // inviting, and a rigid structure drawn in three-pixel rules is a different argument.
  border: { base: "1px" },
  /**
   * Raised, which is the point of the whole family.
   *
   * A card lifted on a shadow mixed from this Site's own jade, rather than sitting in a grey
   * wash. The shadow is derived from `primary` above, so moving that one colour moves the
   * shadow with it and nothing here has to be kept in step by hand.
   *
   * The other three are "flat" (a wash of the surface colour, which is what this was),
   * "bordered" (a hairline outline) and "glass" — which is worth having but wants something
   * behind it to be translucent against, so it belongs to a Site with an image or a gradient
   * under its cards rather than to this one.
   */
  surface: "raised",
  /**
   * Grain, at five and a half percent.
   *
   * "Ink & Ember" is a warm argument made in cool colours, and a flat wash of either at full
   * width is the thing that reads as a template. It is an inline `feTurbulence` under a
   * kilobyte — no request, no asset, no dependency — and if you cannot see it, that is the
   * intended result: you can see the flat version, once you have looked at this one.
   */
  texture: "grain",
  // 6rem left adjacent bands looking disconnected rather than generous; two stacked
  // Sections are 9rem apart at this value, which is enough air without a gap.
  spacing: { section: "4.5rem", gutter: "3rem" },
  measure: "72rem",
});
