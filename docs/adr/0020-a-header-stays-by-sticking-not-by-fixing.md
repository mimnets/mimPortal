# A Header stays by sticking, not by fixing

A Shared Slot's `sticky` column takes two values: `scrolls` and `sticky`. M10.5 asked for
three. `fixed` is deliberately not the third, and this records why — because the reason is
about what a public Site is allowed to ship, not about CSS.

## What the two do

`position: sticky` leaves the Header in normal flow. It occupies its own height, the first
band of the Page starts below it, and when the Page scrolls far enough the Header stops at
the top of the viewport. Nothing else on the Page has to know.

`position: fixed` takes the Header out of flow. It occupies no height, so the first band of
every Page starts at the top of the window and the Header sits on top of it. Everything below
has to be pushed down by exactly the height the Header gave up.

## The height is the problem, and it has only bad answers

That height cannot be known in CSS. A Header is an Author's Sections holding an Author's
Blocks; it is one line on a desktop and two when a long Site name wraps on a phone, and it
changes when somebody adds a menu item. The roadmap already ruled out the first answer —
a magic number — and it was right to: a hard-coded `4.5rem` is correct until the day a client
adds a fifth menu item, and then it is a Header overlapping its own first heading on exactly
the screen widths nobody tested.

The second answer is to measure it. That is three lines of JavaScript and an event listener,
and it is the reason this decision is worth recording rather than obvious:

**A published Mimnets Site ships no JavaScript at all.** Not "very little" — none. The
gallery lightbox is `:target`. The mobile navigation drawer is a checkbox and a sibling
selector. Reveal-on-scroll is `animation-timeline: view()` behind an `@supports` guard, so a
browser without scroll timelines shows the Page normally rather than showing nothing. Every
one of those was built the harder way on purpose, and the property they add up to is that a
Site works before hydration, works with a blocked script, and cannot break in the ways
JavaScript breaks.

A fixed Header would be the first script on a public Page, and it would arrive with the
failure mode scripts have: until it runs, the offset is zero and the first band is underneath
the Header, so every Page would load with its heading covered and then jump. Spending that
property, on every Site, to buy one layout option is not a trade this product should make.

## What `fixed` actually buys, once the offset is solved

One thing: a Header overlaying content from scroll position zero. That is the
transparent-header-over-a-hero-image look, and it is not really this setting. It needs the
Header to have no background, the hero to reserve room for it, and the logo and menu to stay
legible against whatever photograph is behind them — contrast handling that the `readableOn`
work already showed is not a detail. It is its own feature with its own decisions, and
naming it `fixed` here would have shipped a third of it.

## What this costs

An Owner who wants a Header that floats over a hero cannot have one, and the Dashboard offers
two options rather than three. That is the whole cost, and it is visible rather than silent —
which is the kind of limitation to prefer.

## What is enforced, and where

- `SLOT_STICKY` is `["scrolls", "sticky"]`. The Dashboard's control offers exactly those.
- `toSlotSticky` narrows whatever is in the `text` column to one of them, defaulting to
  `scrolls`. A row holding `fixed` — written by a Site on newer packages, or left behind if
  this decision is ever reversed and then rolled back — scrolls, rather than reaching the DOM
  as a `data-` attribute nothing styles.
- `SlotView` refuses to make a Footer stay, whatever the row says. A Footer is already at the
  bottom of the document: sticking it pins it over the end of every Page. The Dashboard does
  not offer the control on a Footer, and the renderer is the guard behind that.

## Revisiting

Reopen this when a transparent Header over a hero is actually being built, and decide it
there — with the contrast question, which is the hard half. If it lands, `SLOT_STICKY` grows
a value and `toSlotSticky` keeps every older Site safe on the day it does, which is the
property the narrowing function was written to have.
