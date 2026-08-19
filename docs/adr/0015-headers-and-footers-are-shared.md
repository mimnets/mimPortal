# A Header belongs to the Site, not to a Page

A Header or Footer is a row in `shared_slots`. A Page points at one, and rendering resolves
the reference on the way out. A Page may still keep its own — that is what a null reference
means — but the default, and what the Starter seeds, is shared.

This fixes something that was not a missing feature but a false claim. Every Page stored its
own copy of the Header in its own layout document, so editing one changed exactly one Page,
while the demo Site's own text read *"The Header above is the same on every Page."* Only the
Menu inside it was shared, which made the sentence half true and the behaviour surprising in
precisely the way [the Menu entity](../../CONTEXT.md) exists to prevent.

## Why a reference rather than a copy

The alternative was a "copy this Header to every Page" action, which is worse in the way that
matters: it is correct once. The next edit is out of date everywhere again, and nothing tells
anybody. A reference cannot drift.

A Site can hold several — a full Header and a minimal one for landing Pages — because
"alternative or custom" is the real requirement. One shared Header with no alternatives would
just move the problem: the first Page that needed something different would have to abandon
sharing entirely.

## Decisions

- **Shared Slots save immediately, with no draft and no history**, the same as Menus. Giving
  them their own draft state would allow a Page to be published while the Header it renders
  is not, and there is no sensible answer to what a visitor should then see.
- **Only Header and Footer can be shared.** Main and Sidebar are what makes a Page that Page.
- **Owner-only.** A Header appears on every Page that uses it, which makes editing one the
  furthest-reaching change in the product — further than deleting a Page, which affects one.
- **The Page Editor shows a shared Slot read-only**, with the reason and where to change it.
  Editing it in place would change every other Page while nothing on that screen said so.
- **Switching to "This Page only" copies the shared Slot in first**, when the Page has
  nothing of its own. Nobody choosing "custom" means "delete my navigation"; they mean "start
  from this and change it". Without the copy the Page silently lost its Header — which it did,
  in testing, before this was added.

## Consequences

- **A Page keeps its own sections while using a shared Slot.** They sit in its layout
  document, untouched, and come back if the reference is cleared or the shared Slot deleted.
  Slightly redundant, and it is what makes detaching lossless.
- **Deleting a shared Slot releases its Pages rather than breaking them.** They fall back to
  their own sections, which for a Page that has always been shared may be empty — the
  Dashboard says how many Pages a deletion will affect before it happens.
- **A shared Slot is validated on save and again on read.** One holding a Block Type a Site
  no longer registers renders as empty rather than taking down every Page at once, which for
  a Header is all of them.
- **Resolution is one extra query per request**, and only when a Page actually references
  something. Cheap, and it disappears the day caching arrives.
