# A Theme asks a model only for values it can check, and derives the rest

`themeSchema` carries `surface` — one of four words — and does not carry `elevation` at all.
A generated Preset can choose how a card is drawn; it cannot choose the shadow.

## Why this is a boundary and not a preference

A Theme is compiled by `themeToCss` into CSS custom properties inside a `<style>` element on
every Page of a Site. Anything that reaches a token value is written, unescaped, into a
stylesheet with Site-wide reach — which is why `themeSchema` already refuses a colour that is
not six-digit hex and a font stack containing `;`, `{`, `}`, `(`, `)` or `@`.

M11 needed four new families, and they divide cleanly on one question: *can a regex tell a
real value from a breakout attempt?*

- **`radius` and `border` are lengths.** `^\d{1,3}(\.\d{1,2})?(px|rem)$` is exact. Accepted.
- **`surface` is a keyword.** `z.enum(["flat", "bordered", "raised", "glass"])` is exact.
  Accepted, and it is the single most characterful value in the whole Theme — one word that
  redraws every card, quote, plan and slide at once. Refusing it would have cost the milestone
  most of what it is for.
- **`elevation` is a `box-shadow`.** Four to six space-separated lengths, a colour, an
  optional `inset`, repeated behind commas — and a colour that may itself be `rgb()`,
  `color-mix()` or a keyword. There is no regex here that is both permissive enough to accept
  real shadows and tight enough to be a boundary. **Refused.**

## What refusing it costs, which is nothing

The shadow a model would have named is the wrong shadow anyway.

A grey `box-shadow` reads as a 2015 card. The same shadow mixed with the Site's own primary
reads as considered — and that is not a judgement a model needs to make, because the primary
is already in the Theme:

```ts
low: `0 1px 2px ${tint(10)}, 0 4px 12px ${tint(12)}`
// tint(n) = color-mix(in oklab, <primary> n%, transparent)
```

So the safe answer and the better answer are the same answer. A model naming its own shadow
could only produce one that matches the palette by accident, and one that does not match is
the exact failure the token was added to fix.

This is the third family derived rather than asked for, and the reasoning is the same each
time: `onPrimary` and `onAccent` are decided by luminance because a model guessing at contrast
produces unreadable text (ADR-0007's amendment in M9), `primaryText` and `accentText` because
nobody should need to know what a contrast ratio is to pick a heading colour, and `elevation`
because a shadow that does not belong to the palette is worse than no shadow.

## The rule

**Ask for what a schema can prove. Derive what the Theme already knows.**

A family that is neither — one a regex cannot check and the palette cannot imply — is a family
that has not been thought about enough yet. The gradients and the grain M11 goes on to add are
the next test of this: both are built from the Theme's own colours, so both derive.

## What was rejected

**A permissive shadow regex.** Tempting, because "a few numbers and a colour" sounds
checkable. It is not: every version tight enough to be a boundary rejected shadows a designer
would write, and every version loose enough to accept them admitted `)` and `,` in positions
that make a second declaration reachable. A boundary that is nearly right is a boundary.

**A `field.color` on Blocks, again.** Not in scope here, but the same argument, and it is
worth recording next to this one: a Block that needs to offer a choice offers Theme tokens.
A free hex picker is [ADR-0003](./0003-sections-and-columns-not-free-canvas.md)'s mistake in a
different hat, and a client who can put anything behind anything will.
