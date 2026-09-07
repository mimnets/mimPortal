---
"@mimnets/core": minor
"@mimnets/blocks": minor
"@mimnets/admin": minor
---

Two of M10.5's four: a Section can be wider than the measure, and a Header can stay on screen.
**The second adds a database column, so an upgrading Site must run its migrations.**

**Per-Section width.** A Section gains `width: "measure" | "wide" | "full"`. Every band was
the Theme's one global `measure`, which is the right default for prose and the wrong one for
exactly the Blocks M8.5 added — a gallery, a carousel and a map all want the width of the
window and could not have it.

Three keywords rather than a free number, for ADR-0013's reason and the reason there is no
colour picker. `wide` resolves to `--mn-measure-wide`, which is derived as
`calc(measure * 1.25)` rather than stated as a second literal: a fixed value next to a Site
that sets a wide `measure` would hand it a "wide" narrower than its normal. `full` is the
only one that also drops the band's horizontal padding, because a gallery running edge to
edge with a gutter still showing has not run edge to edge. It applies to Main and Sidebar,
never to a Header.

`data-width` is emitted even at `measure`, unlike `data-divider` at `none` — a width is
something a Section always has, and absence would be ambiguous between "the measure" and
"written before this existed".

**A Header that stays.** A Shared Slot gains a `sticky` column, `"scrolls"` or `"sticky"`,
set in Headers & Footers. It belongs to the Slot rather than to a Page because a Header is
shared (ADR-0015), and one that stuck on some Pages and not others would read as a bug.

**There is no `fixed`, and ADR-0020 records why.** It would need the
first band of every Page offset by the Header's own height, which cannot be known in CSS and
would take either a magic number — wrong the day a menu item wraps — or the first JavaScript
a published Mimnets Site has ever shipped. `position: sticky` needs neither. A Footer is
refused the behaviour in the renderer as well as in the Dashboard: sticking one pins it over
the end of every Page.

**Upgrading an existing Site:**

1. Run `pnpm db:migrate`. The migration adds one `text` column to `shared_slots`, generated
   as `DEFAULT 'scrolls' NOT NULL`. Additive, and no downtime — Postgres 11 and later do not
   rewrite a table to add a column with a default. Every existing Shared Slot reads back as
   `scrolls`, which is what every Header did before the column existed.
2. Nothing else. Every Section written before widths existed parses as `measure`, which is
   what it was already rendered at.

If you have cloned the Starter, note that `resolveLayout` now returns
`{ layout, headerSticky }` rather than a bare `PageLayout`, because staying on screen is a
property of the Slot and not of any band inside it. Your `page.tsx` destructures it.
