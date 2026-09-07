---
"@mimnets/core": minor
"@mimnets/blocks": minor
---

A button can open a panel, so a popover is no longer only a Block.

Fill in "Panel heading" or "Panel text" on a **button**, or on any button in a **button row**,
and it opens a panel instead of following its link. The popovers Block stays as it was — a
list of triggers is still a list — and the two now share one panel implementation rather than
two copies of it.

**`render` gains a third argument, `BlockMeta`, carrying the Block's own instance id.** This
is the thing that made "a popover on anything" hard rather than obvious: a Block never knew
its own id, so the Blocks needing a unique DOM id hashed their own content instead. That is
unique in practice and not in principle — two identical buttons opening the same panel, which
is what a repeated call to action looks like, minted the same id and shared one checkbox. The
popovers Block now uses the id too, closing the same hole where two Blocks held the same
people.

The argument is additive: a `render` that ignores it is unchanged, and every Block Type in
the library did ignore it on the day it landed. If you have written your own Block Types they
keep working; if you have written your own *renderer*, it must now pass `{ id }`.

A button either goes somewhere or opens something, never both — an anchor that did both would
show the panel and follow the link a moment later, which reads as a flash. When a panel is
written the link is simply unused.

**Upgrading an existing Site:** nothing is required. The new fields default to empty, so every
button already stored is still a link.
