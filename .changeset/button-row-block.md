---
"@mimnets/blocks": minor
"@mimnets/admin": minor
---

A button row Block, so two buttons can sit side by side.

The answer before this was "set the Section to two Columns", which is the wrong answer: it
puts each button at half the width of the band with a gutter between them, when what a hero
wants is "Book a table" and "See the menu" next to each other.

Blocks inside a Column stack, always — `.mn-column` is a flex column and Blocks never contain
other Blocks, which is ADR-0003's rule and was not reopened for this. So the row is a Block,
the same shape as the logo strip and the social row, and it needs nothing from the layout
engine and no new concept for an Author to learn.

**Each button carries its own style rather than the Block carrying a variant**, and that is
the whole point. A hero wants one solid button and one outline beside it; a Block-level
variant would make every button in the row identical and leave the pair looking like a
mistake. `data-style` on the button is the mechanism the call to action, a pricing plan and
the comparison table already use, so this needed no new CSS mechanism either.

The row wraps rather than overflowing — `flex-wrap` is the whole of its responsive behaviour,
so there is no media query — and it takes an alignment and one size for the row. A button
with no label is dropped, which is what an Author leaves behind after adding an item and
changing their mind.

Its address field is free text a client edits, so it goes through `safeHref` like every other
Block with an Author-supplied link: React refuses `javascript:` on its own and does not refuse
`vbscript:`.

**Upgrading an existing Site:** nothing is required. It is a new Block Type, so no stored Page
changes; register it and it appears in Add Block. The Dashboard's picker has an icon for it.
