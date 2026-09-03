# What the Editor posts back is not authoritative for a Slot the Page does not own

A save reads the Page's stored layout, puts back every Slot the Page does not own, and only
then applies the role's locked-Slot rule. A Header or Footer that comes from a Shared Slot
keeps what is already stored — whoever is saving, and whatever they sent.

## Why the Editor cannot be trusted here

The Editor is handed the *resolved* document. `resolveLayout` substitutes a Shared Slot's
sections in place of the Page's own, because the Editor has to draw the Page as a visitor
will see it — a preview that omitted the Header would be a preview of nothing anybody visits
([ADR-0015](./0015-headers-and-footers-are-shared.md)).

The consequence is that the document the Editor posts back carries a copy of a Header the
Page does not own, sitting in the field where the Page's own Header belongs. Writing it was
wrong twice over:

- **For an Owner, it destroyed the Page's own Header.** Those are the sections
  `resolveLayout` promises to leave untouched. A Page that kept its own Header, opened in the
  Editor and saved with no Header edit at all, silently had it replaced by the shared one.
- **For an Author, it locked them out.** The locked-Slot check compared incoming Header
  against stored Header, found a difference the Editor had introduced, and refused a save the
  Author had made no Header change in. Editing a Page with a shared Header was impossible for
  the role that does most of the editing.

## The rule, and why the order matters

`restoreOwnSlots` is the inverse of `resolveLayout`. It is applied **before**
`assertLockedSlotsUnchanged`, not after.

Asking the lock first refuses an Author for a difference the *Editor* introduced rather than
one they made — which is the second bug above, merely reported more politely. The restore has
to happen first so the lock is comparing what the Author actually changed.

## What was rejected

- **Sending the Editor an unresolved document.** The preview would then be missing its Header
  and Footer, which defeats a split-view editor. A Page's Header is most of what makes the
  preview recognisable as that Page.
- **Marking the resolved sections read-only in the Editor and trusting the client to omit
  them.** The server would still have to check, because everything a client sends is
  attacker-controlled — so the check is the mechanism and the client-side marking is at best
  a courtesy. The same reasoning that makes the Editor hiding a button a courtesy rather than
  a permission ([ADR-0010](./0010-web-installer-two-modes.md), M4).
- **Diffing and rejecting the save with an error.** Correct but useless: the Author did
  nothing wrong, and there is no action they could take in response. Silently keeping what is
  stored is the behaviour they already expect, because they did not edit the Header.

## Consequences

- **A Shared Slot changes in one place only** — Headers & Footers in the Dashboard. There is
  no second route into it, deliberately, and no message telling an Author that their Header
  edit was discarded, because the Editor does not offer them one to make.
- **The stored layout is read on every save**, not only when a lock is in force. The restore
  needs it regardless of role, so the query that used to be conditional no longer is.
- **A Page that owns its own Header is unaffected.** `restoreOwnSlots` returns the incoming
  document untouched when there is no shared reference to honour, so the common case pays
  nothing.
