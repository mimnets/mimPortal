# A Section carries the paint, not a Block

A Section has three properties beyond its Columns: a `tone`, a `padding`, and an optional
background image with an overlay. A Block has none of these and never will.

The question this settles is where a full-width coloured band comes from. Every page that
looks designed rather than typed is, structurally, a stack of bands — a dark hero, a plain
run of content, a coloured statistics strip, a tinted testimonial block, a dark call to
action. Something has to own that.

A Block cannot. A Block lives inside a Column inside a Section, and the Section's content is
capped at the Theme's `measure`. A Block that wanted to reach the edges of the viewport would
need a breakout — `width: 100vw` with negative margins, or `calc(50% - 50vw)` — which is a
hack that also brings a horizontal scrollbar wherever a scrollbar exists. Worse, it would let
two Blocks in the same Column both claim to be the band, and the second one would win by
accident.

A Section already is the band. [CONTEXT.md](../../CONTEXT.md) has defined it as "a full-width
horizontal band inside a Slot" since M1, before anything could be painted. Giving it a tone
is not an extension of the model; it is the model finally being used.

## What this buys

- **Alternating tones are a property of the Page, not of its content.** An Author changes how
  a band looks without touching a Block, and moving a Block between Sections does not carry a
  background with it.
- **Composition Blocks stay simple.** The call-to-action Block is a heading, a sentence and a
  button. It has no background, no padding and no alignment beyond its own text, because the
  Section around it is doing that work.
- **A Theme still rebrands everything.** `tone: "primary"` resolves to the Theme's primary
  colour, and `tone: "dark"` is an inversion of the palette rather than a fourth colour to
  keep in sync. Six values in `theme.ts` still change every band on every Page.

## Consequences

- **`SectionNode` gained three required properties**, which every hand-built Section in the
  codebase had to grow. They are defaulted in the Zod schema, so every Page written before
  this still parses and renders exactly as it did — but TypeScript found four places building
  Sections by hand, and `sectionDefaults()` now exists so the next addition is one edit.
- **The overlay is a number, not a boolean.** Text over a photograph is unreadable somewhere
  in every photograph, and how much moderation a given picture needs is a property of that
  picture rather than a setting the Theme can hold.
- **A Section with an image is always light-on-dark.** The renderer forces white text over a
  background image rather than trying to read the image's brightness. A Site that wants dark
  text over a pale photograph will need a `contrast` option; nothing has asked for it yet.
- **Four tones, not arbitrary colours.** An Author picks from Page background, tinted,
  primary and dark. A colour picker here would let a client put anything behind anything and
  is the same mistake as a free-positioning canvas
  ([ADR-0003](./0003-sections-and-columns-not-free-canvas.md)) in a different costume.
