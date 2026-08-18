import { defineTheme } from "@mimnets/core";

/**
 * This Site's visual identity. Change these values and every Page changes with them —
 * no Block is edited, because Blocks are styled against these tokens rather than against
 * literal colours.
 *
 * This file is the main thing that differs between one Site and the next.
 */
export const theme = defineTheme({
  colors: {
    background: "#fbfaf7",
    surface: "#f1eee7",
    text: "#1b1a17",
    muted: "#6f6a60",
    primary: "#8a5a2b",
    border: "#e0dad0",
  },
  fonts: {
    heading: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
    body: '"Segoe UI", system-ui, -apple-system, sans-serif',
  },
  radius: { base: "2px" },
  spacing: { section: "5.5rem", gutter: "3rem" },
  measure: "64rem",
});
