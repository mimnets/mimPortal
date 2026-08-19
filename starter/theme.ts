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
  // Enough to read as contemporary, not enough to read as a toy. Buttons and cards share it.
  radius: { base: "10px" },
  // 6rem left adjacent bands looking disconnected rather than generous; two stacked
  // Sections are 9rem apart at this value, which is enough air without a gap.
  spacing: { section: "4.5rem", gutter: "3rem" },
  measure: "72rem",
});
