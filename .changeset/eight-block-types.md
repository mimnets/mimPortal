---
"@mimnets/blocks": minor
"@mimnets/core": minor
---

Eight Block Types, taking the standard library from fourteen to twenty-two: accordion, image
gallery, carousel, location map, video, Markdown prose, comparison table and social links.

Five are built on the browser rather than on JavaScript — `<details>`, `:target`,
scroll-snap, sandboxed iframes and a real `<table>` — so `@mimnets/blocks` still has one
dependency and still contains no client component, and all of it renders on the server.

Three are security boundaries. The video Block allowlists its iframe hosts rather than
framing whatever address an Author pasted. The social links row parses every address and
drops anything that is not http, https, a real email or a real phone number. Prose parses
with markdown-it at `html: false`, so raw HTML is never admitted rather than admitted and
scrubbed.

`@mimnets/core` gains `renderMarkdown` and `markdownToText`, the shared renderer that
ADR-0011 requires both the public Site and the Editor preview to use, and takes `markdown-it`
as a new runtime dependency for it.

It also gains `safeHref`, which reduces an address an Author typed to one a browser may
follow — http, https, mailto, tel, or a relative path, and nothing else. Every Block that
turns a field into an `href` now goes through it, including the call to action and the
pricing plan, which took a free-text address and passed it straight to an anchor.

`@mimnets/blocks` now ships its own stylesheet at `@mimnets/blocks/blocks.css`, the way
`@mimnets/admin` already ships `editor.css`. Every Block's structural CSS moves out of each
Site's `globals.css` and into the package, so a Site that upgrades to new Block Types receives
something to draw them with rather than the components alone. It is written entirely against
Theme tokens and is imported above a Site's own stylesheet, so anything the Site says still
wins.

**Upgrading an existing Site:** add `import "@mimnets/blocks/blocks.css";` above
`import "./globals.css";` in `app/layout.tsx`, then delete the Block sections from that Site's
`globals.css`, keeping only what the Site itself renders.

