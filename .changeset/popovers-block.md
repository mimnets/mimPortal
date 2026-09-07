---
"@mimnets/blocks": minor
"@mimnets/admin": minor
---

A popovers Block: a list of things that open a panel, with no JavaScript.

A team member's biography, what a service includes, the story behind a photograph. Each item
is a trigger, a heading, Markdown and an optional picture.

**Built on `:target`, like the gallery's lightbox.** No script is involved, so a panel opens
before hydration, opens with JavaScript blocked, and is keyboard operable without anybody
implementing it — the trigger is a link and every browser already knows what to do with one.
A popover built the usual way is a button with `aria-expanded`, a click handler, an Escape
listener and a focus trap, and it is none of those until its script arrives.

The trade is worth stating: the open panel is in the address bar, so opening one adds a
history entry and Back closes it, and a shared link opens the panel it names — which for a
biography is a feature. It is the behaviour the gallery already has.

Panels are hidden with `display: none` rather than made invisible, which is the accessibility
half: an invisible panel is still in the tab order, so a keyboard user would tab through every
closed biography on a team page before reaching the footer. The text stays in the document, so
in-page search and crawlers still find it.

**A Block rather than a field on the button**, which was M10.5's open question. A field would
let any button anywhere open a panel and is genuinely more useful, but it needs ids unique
across a whole Page rather than within one Block, panel markup in every adopting Block Type,
and a nested Editor form for a field that is really a small document. The case that actually
comes up — a team page, a service list — is a list, and a list is what this is. The same
argument that kept the button row a Block instead of a Column property.

Fragment ids are derived from the Block's own content, as the gallery and carousel derive
theirs, so two popover Blocks on one Page cannot open each other's panels.

The panel body goes through the same Markdown renderer as the prose Block, so raw HTML is
never parsed (ADR-0011).

**Upgrading an existing Site:** nothing is required. It is a new Block Type, so no stored Page
changes; register it and it appears in Add Block, with an icon in the picker.
