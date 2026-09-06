---
"@mimnets/blocks": minor
"@mimnets/core": minor
---

Eleven token families where a Theme could express six, and Block variants built on top of
them. A Theme could say colour, two typefaces, one corner radius and two spacing values;
one radius token did the work of twenty-six rules and there was no shadow token at all.

`elevation`, `radius` as a five-step scale, `border` as three weights, `surface` as one of
four keywords, and `texture` as grain or nothing. Two looks are composed from them: a `mesh`
Section tone, four soft radials of the Site's own brand colours, and a `gradient` Block tone
that clips a run between them to a heading's glyphs. Both are CSS only.

The highest-value line in it is one `color-mix()`: every card, quote and plan now carries a
shadow mixed from that Site's own primary rather than grey. `surface` is one word that
redraws four Block Types at once.

**Variants.** `defineBlock` takes `variants`, the registry builds the enum per Block Type,
the renderer emits `data-variant`, and the Editor generates the control the same way it
generates every settings form. The testimonial has three looks with byte-identical markup
and no change to its `render`.

The first declared variant is what the Block already looked like, and is the default. That
is what let this ship without migrating a stored Page, and it is the rule to keep when the
rest of the library gets variants. Note that the `variants` array is therefore an ordered,
storage-affecting contract: reordering it restyles every Block that has not been re-saved.

**Two fields are gone, and one of them was on every Page ever written.** A button's look was
`props.style` and prose's was `props.width`. Neither Block Type declares those fields any
more, and an undeclared key is stripped in silence — so without a migration every accent
button on every Site would have come back primary with no error and nothing in a log.

`variantWasField` names the old field and the registry lifts the value across as a Page is
read. An explicitly chosen variant always wins, so a Page saved once never consults the old
field again, and a Page rewrites itself into the new shape the next time an Author saves it.
There is no database migration and no script. **Nothing is required of an upgrading Site**,
but the hook is deletable once every Site has re-saved its Pages, and worth deleting then.

**Two enums grew**, which is the change that can break every stored layout. `SECTION_TONES`
gained `mesh` and the Block tones gained `gradient`. Both are defaulted *and* caught, so a
Section carrying a tone this Site does not know is repainted rather than blanking the Page —
which matters when a Shared Slot is published from a Site running a newer version of these
packages than the one reading it.

**A Theme derives what it can check** (ADR-0019). `elevation`, the mesh and the text gradient
are absent from `themeSchema` entirely and always derived: a `box-shadow` has no shape a
regex can check, and every one of these is compiled into a `<style>` tag on every Page.
`surface` and `texture` are accepted, because a closed set of words is a design choice rather
than a string.

**Upgrading an existing Site:** nothing is required. A Theme that states only what it stated
before gets the derived scales for free, and stored Pages keep the looks they had. To take
the new families, add any of `radius`, `border`, `surface` or `texture` to `theme.ts` — each
scale derives from the one `base` value you state, rather than merging onto the default's, so
a Site asking for square corners gets them all the way down.
