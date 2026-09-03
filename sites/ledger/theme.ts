import { defineTheme } from "@mimnets/core";

/**
 * Ledger's visual identity — the second Site, and the reason it exists.
 *
 * This file and `blocks.config.ts` are the whole of what makes Ledger not the Starter. No
 * Block is edited and no CSS is written: the Blocks are styled against these tokens, so
 * changing them here changes every Page. If that claim were false, this Site would look like
 * the Starter with different words in it, and ADR-0001 would be wrong.
 *
 * Where the Starter is "Ink & Ember" — deep jade holding the structure, ember orange carrying
 * the attention — Ledger is a chartered accountant in a market town. Navy and a dry gold: the
 * palette of a letterhead rather than a landing page, because the thing it is selling is that
 * nothing surprising will happen to your money.
 *
 * Deliberately colder and quieter than the Starter. Wider measure and tighter section rhythm,
 * because a page of figures reads as competent when it is dense and as evasive when it is
 * airy — the opposite of the Starter's argument, which is the point of having two.
 */
export const theme = defineTheme({
  colors: {
    background: "#ffffff",
    // A blue-grey wash rather than the Starter's green one, so a surface band still belongs
    // to this palette rather than looking borrowed from the other Site.
    surface: "#eef1f5",
    // Near-black carrying the navy, for the same reason the Starter's text carries its jade.
    text: "#111a2b",
    muted: "#5a6779",
    primary: "#16304f",
    onPrimary: "#ffffff",
    // Dry gold, not yellow. It has to survive being read as text, which readableText will
    // check and correct rather than trust.
    accent: "#9a7328",
    onAccent: "#ffffff",
    border: "#dde3ea",
  },
  fonts: {
    heading: 'var(--mn-font-display), "Segoe UI", system-ui, sans-serif',
    body: 'var(--mn-font-text), "Segoe UI", system-ui, sans-serif',
  },
  radius: {
    // Square. A practice that files your accounts does not have rounded corners.
    base: "0",
  },
  spacing: {
    section: "4rem",
    gutter: "1.75rem",
  },
  measure: "74rem",
});
