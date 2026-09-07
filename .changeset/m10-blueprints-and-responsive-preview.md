---
"@mimnets/core": minor
"@mimnets/blocks": minor
"@mimnets/admin": minor
---

M10 is finished: Blueprints, and a preview that actually narrows.
**Blueprints add a database table, so an upgrading Site must run its migrations.**

**A responsive preview.** Columns stack on narrow screens without anybody authoring it, which
meant an Author never saw the stacked result until they published — the one thing a live
preview promises not to do.

The obstacle the roadmap named is real: CSS breakpoints answer to the viewport, so narrowing
a pane does not trigger them. `blocks.css` now carries a `@container` twin of each `@media`
layout rule, and the Editor's preview frame is the only element in the product that declares
`container-type` — so the pane genuinely narrows rather than scaling a picture.

**Keeping the container out of published CSS is the load-bearing part, and it is why this was
not the mechanical migration it looked like.** `container-type` implies `contain: layout`,
which makes an element a containing block for `position: fixed` descendants. Declared on a
Section or a Slot it would trap the gallery lightbox and the popover panels inside whatever
band they live in — the lightbox covering one Section instead of the window, on every
published Page. A test asserts `blocks.css` contains no `container-type` at all.

**Blueprints.** A Section saved by name and dropped into a Page as a copy. Distinct from a
Shared Slot (ADR-0015), which is one Section used in many places and edited once: a Blueprint
stops being related to its source the moment it is inserted, so editing a Blueprint changes
nothing already placed, and editing a placed Section changes no Blueprint.

Insertion runs through the same `copySection` a duplicate uses, giving fresh ids to the
Section, every Column and every Block. That is what makes it a copy rather than a link — and
it is required, because one Blueprint may be inserted into the same Page twice and shared ids
would give dnd-kit two draggables with one identity.

A Blueprint is validated through the registry's own `safeParseLayout` on the way in *and* on
the way out. The way out matters because a Blueprint outlives the registry it was saved
against: a Site can remove a Block Type, and a Blueprint saved last month may name it.

Available to an Author as well as an Owner, unlike Shared Slots — inserting one changes
exactly one Page.

**Upgrading an existing Site:**

1. Run `pnpm db:migrate`. It creates one new table, `blueprints`. Nothing existing is altered,
   so there is nothing to back out and no downtime.
2. Wire the three actions if you want the controls: the Editor takes an optional `blueprints`
   bridge (`list`, `save`, `remove`), the same shape as `media`. Without it the controls are
   absent rather than broken.
