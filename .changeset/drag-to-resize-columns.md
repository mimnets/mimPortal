---
"@mimnets/core": minor
"@mimnets/admin": minor
---

Drag the boundary between Columns to change their widths.

Asked for as "can we just drag and resize". The answer is yes to the gesture and no to the
free ratio: **the drag snaps to a named layout, and nothing new is stored.**

A client who can drag to any proportion will produce 63/37, with a gutter lining up with
nothing else on the Page — the same objection behind Section tones, Section widths and the
absent colour picker. So an Author drags the boundary and it lands on one of
`COLUMN_LAYOUTS`. No Page gained a number, no migration is needed, and
ADR-0003 is untouched: nothing is absolutely positioned, Columns
still stack on a phone, and no Block gained a coordinate.

**Five more named ratios**, because dragging between three stops is a control that jumps
rather than follows. Two Columns had `1-1`, `2-1` and `1-2`; they now also have `3-1` and
`1-3`. Three Columns had exactly one layout, so the boundary could not move at all; they now
have `2-1-1`, `1-2-1` and `1-1-2`.

**Adding to that list is forward-only.** `layout` is deliberately the one Section field that
is not `.catch()`ed — a Section whose layout cannot be read is refused rather than repainted,
because the Column count has to match it — so a Page saved with one of these new names will
not parse on a Site running older packages. Upgrade the packages before saving a Page that
uses them.

`layoutsWithColumns(count)` and `columnShares(layout)` are new on `@mimnets/core`: the
candidates a drag may land on, ordered by how wide the first Column is, and each layout as
fractions of the Section.

The handle is Editor chrome and sits *between* Columns rather than inside one, so a pointer
on it never lands on a Block that dnd-kit is watching. A Column count with only one possible
layout — four Columns — gets no handle at all, because three handles that cannot change
anything read as broken rather than as constrained.

**Upgrading an existing Site:** nothing is required. Every existing Section keeps the layout
it has.
