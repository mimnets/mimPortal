---
"@mimnets/blocks": minor
"@mimnets/core": minor
---

The last two pieces of M11: a Section can shape its bottom edge, and a Block can offer a
choice between the Theme's own colours.

**Section dividers.** `divider` on a Section is `"none"`, `"angle"` or `"curve"`, and the
renderer emits `data-divider` for the last two. It is a Section property rather than a Block
one because the edge belongs to the band (ADR-0013), and two shapes rather than an angle in
degrees so a Site cannot draw one steep enough to eat its own content.

The shape is on a pseudo-element and never on the Section itself. That matters to anyone
styling their own Sections: `clip-path` on a Section would establish a containing block for
fixed and absolutely positioned descendants, which traps things like a lightbox or a menu
inside the band they sit in. The edge inherits the band's colour, so a Section on the page
background draws nothing.

**`field.token`.** A new field kind whose value is the name of a Theme colour, not a colour.
`field.token({ tokens: ["accent", "primary"], default: "accent" })` — the Block Type narrows
the list to what reads where it will be used, and `COLOR_TOKENS` is the full set. There is
still no `field.color` and there should not be. The Editor generates a picker with a swatch
from the declaration, like every other control.

`eyebrowBlock` is the first to use it. Its colour was hard-coded to `--mn-color-accent` and
`accent` is the default, so **no eyebrow on any Site changes colour**.

**Upgrading an existing Site:** nothing is required. Both enums default and catch, so Pages
written before either existed parse unchanged. A Site with its own stylesheet that styles
`.mn-eyebrow` should know it now carries a `data-colour` attribute; a Site that has forked
`blocks.css` will want the four `[data-colour]` rules and the `[data-divider]` block.
