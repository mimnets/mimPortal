# Sections and Columns, not a free canvas

Blocks are positioned by ordering them inside Columns, which sit inside full-width
Sections — not by absolute x/y coordinates on a canvas. Absolute positioning cannot
survive a change in screen width, so a free canvas would force every Page to be laid out
again by hand for each breakpoint and would mean building a layout engine before building
a CMS. Columns collapse to a vertical stack on narrow screens, which makes responsive
behaviour automatic rather than authored.

## Consequences

- Authors cannot overlap Blocks or place one at an arbitrary point on the Page.
- Pixel-perfect one-off designs must ship as a custom Block Type in that Site's own code.
