---
"@mimnets/blocks": patch
---

The button and the logo now check their link's protocol, like every other Block that takes one.

Both have a "Links to" field — free text a client edits — and both interpolated it straight
into an `href`. Every sibling that does this already ran it through `safeHref`: the call to
action, a pricing plan, the carousel, the comparison table, the menu and the social row.

**Nothing looked wrong because React refuses `javascript:` on its own.** It does not refuse
`vbscript:`, and it does not refuse a `data:` URL, so the protection was one browser quirk
deep and covered one scheme of three. Both now reach the DOM as `/`.

The logo is the more exposed of the two: it lives in the Header, a Header is shared, so one
bad address is on every Page of a Site at once rather than on the one Page somebody put a
button on.

Both Blocks had no test file at all, which is why the gap survived the audit that found the
other six. They have one now, and each was written against the bug and watched to fail first.
