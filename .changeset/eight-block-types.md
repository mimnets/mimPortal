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
