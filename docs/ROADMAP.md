# Roadmap

Milestones are ordered by risk, not by convenience. The Editor is unproven and comes
first; authentication is well understood and comes fourth.

Each milestone has an exit criterion written as something you can *do*, not something that
*exists*. A milestone is not finished until you have done it by hand, in a browser.

---

## M0 — Foundations ✅

Monorepo skeleton: pnpm workspaces, Turborepo, Changesets, a shared TypeScript config, and
strict mode everywhere. `packages/core`, `packages/admin`, `packages/blocks` and `starter`
exist as workspace packages from the start, wired together by workspace references.
Postgres on Neon, Drizzle configured, first migration applied.

Packages are workspace-linked now and only *published* at M8 — the structure has to exist
from day one ([ADR-0001](./adr/0001-packaged-template-cloned-per-site.md)), the registry
does not.

The Starter builds to a standalone server bundle and ships a Dockerfile from the start, so
the host stays a per-Site choice ([ADR-0008](./adr/0008-one-deployable-host-agnostic.md)).

**Done when:** `pnpm dev` serves a blank page from `starter`, and `pnpm db:migrate` creates
the `pages` table in a real database.

**Done.** `pnpm setup` finds a database (Docker locally, or a pasted Neon/Supabase connection
string), applies the migration and verifies the connection before writing `.env`.

---

## M1 — The vertical slice ✅

The risky part, on its own, with everything else faked. The layout Zod schema
(Slot → Section → Column → Block). The `defineBlock` API and the field helpers. Three Block
Types: heading, text, image (image is a URL string for now — no uploads). The renderer that
walks a layout document and draws it. A `pages` row with a hand-written JSON layout and a
`locale` column ([ADR-0005](./adr/0005-locale-on-page-from-the-start.md)).

The field helpers include `field.repeater()` — a repeating group of fields — because Blocks
like carousels and testimonial strips own a list of items rather than nested Blocks. Blocks
never contain other Blocks: nested drag-and-drop inside drag-and-drop is where page builders
go to die.

No Dashboard, no login, no styling beyond defaults.

**Done when:** you paste a layout JSON into the database by hand and see it render as a
real page at `/`, with two columns side by side on desktop and stacked on mobile.

---

## M2 — The Editor ✅

Split view: live preview left, settings panel right. Click a Block, its form appears —
generated from the Block Type's field declarations, never hand-written. Drag Blocks between
Columns, drag Sections to reorder, choose a Section's column layout, add and delete Blocks.
Save writes the draft layout. Auth is a hardcoded Owner.

This milestone is the product. Expect it to take longer than M0, M1 and M3 combined.

**Done when:** you drag a heading and an image onto the home page, set their fields, save,
refresh, and everything is where you left it.

---

## M3 — Draft, publish, history ✅

`draftLayout` and `publishedLayout` on Page. Publishing copies one to the other and appends
a snapshot to a version table. A restore action. Public routes read published only; the
Editor reads draft.

**Done when:** an edit is invisible on the public page until you press Publish, and you can
restore a version from three publishes ago.

---

## M4 — Auth and roles ✅

Better Auth. Owner and Author roles. A `locked` flag per Slot, defaulting to locked for
Header and Footer. Every mutation checks the role server-side — the Editor hiding a button
is a courtesy, not a permission.

Auth also brings the **web installer** ([ADR-0010](./adr/0010-web-installer-two-modes.md)):
provisioning mode for an Owner on self-hosted infrastructure, onboarding mode for a client
who only creates their account and names the Site. It locks itself permanently on
completion.

**Done when:** an Author account can edit the main Slot, and cannot edit the Header, delete
a Page, or change the Theme — verified by calling the endpoints directly, not just by
looking at the UI.

---

## M5 — Pages, Menus and Theme ✅

Page CRUD with path-based routing. The Menu entity, edited in one place, rendered by the
Menu Block in both Header and Footer. Responsive navigation with a mobile drawer.
`theme.ts` compiled to CSS variables, Tailwind wired to those variables, every standard
Block restyled to use tokens.

**Done when:** a three-page Site navigates correctly on desktop and mobile, and changing
six values in `theme.ts` visibly rebrands every page without touching a Block.

---

## M6 — Media and SEO ✅

The `StorageAdapter` interface with an S3/R2 implementation and a local-disk implementation.
Real image uploads with a media library in the Dashboard. Per-Page title, description and
social share image. Generated `sitemap.xml` (published Pages only) and `robots.txt`.

**Done when:** you upload an image in the Dashboard, it appears on the published page, and
`/sitemap.xml` lists exactly the published Pages.

**Built, and all but one clause verified.** The disk is the default and a bucket is the
upgrade ([ADR-0012](./adr/0012-local-disk-is-the-default-storage.md)). `sitemap.xml` was
checked against a Site with a deliberately unpublished Page and listed exactly the three
published ones. An image stored as a key renders on the published Page through `/media`,
and three path-traversal attempts against that route were refused. The S3 adapter signs its
own requests and is tested against a real S3-compatible server.

**Done by hand, 3 September.** A 1024×768 PNG was uploaded through Media while signed in and
listed as `1024×768 · 161 KB · image/png` — the dimension reader parsing the real file rather
than a header written to match it. Given alt text, placed on the Portfolio Page with the
image Block, and published. It renders on the public Page as

```html
<img src="/media/2026/09/test-photo-m1fqqq.png"
     alt="A soft diagonal gradient in blue and green" width="1024" height="768" ...>
```

which is the whole milestone in one line: the layout holds a key rather than a URL
(ADR-0012), the width and height are there so nothing below shifts as the file arrives, and
`/media` served it at 200 through the row-backed guard that stops the route handing out
anything else in the bucket.

---

## M6.5 — Forms and email ✅

A brochure Site without a working contact form is not deliverable, which is why this sits
inside v1 rather than after it.

The contact Block, a `form_submissions` table, and spam protection that does not punish real
people: a honeypot field, a timing check, and per-IP rate limiting rather than a CAPTCHA.
Submissions are readable in the Dashboard, so a lost email is never a lost enquiry.

Email delivery goes behind an `EmailAdapter` — the same shape as the StorageAdapter — with a
transactional provider as the default and SMTP as the self-hosted fallback. M4's password
resets use it too, so building it once here serves both.

**Done when:** a visitor submits the contact form on a published Site, the Owner gets an
email, the submission is visible in the Dashboard, and a bot posting the form directly is
rejected.

**Built, and three of the four clauses verified.** A visitor submitted the seeded contact
form in a real browser and was thanked; the notification arrived at the Owner's address
through a real SMTP server, with reply-to set to the person who wrote in; and four bot
attempts were refused — no timestamp, honeypot filled, submitted instantly, and a forged
timestamp — none of which reached the database.

Spam protection is a list a Site edits in `lib/spam.ts`, not three conditions inside the
Block. Adding a CAPTCHA means appending one signal.

Also proven: an enquiry submitted while the mail server was unreachable was still saved and
still thanked, with the delivery failure recorded on the row. That is the whole argument for
storing before sending.

**Done by hand, 3 September.** A visitor filled in the contact form on `/contact` and was
thanked — the result arriving as `?sent=contact`, a query parameter rather than component
state, because the form has to work with no JavaScript. The enquiry is in the Dashboard with
the sender's name, their address as a `mailto:` link, the time, the form slug and the Page it
came from.

The screen also says, in a banner, that no email is configured on this Site and where to fix
it. That is the "store before sending" decision doing its job: the notification is the part
that can fail, and it failing is explained rather than silent. The enquiry was never at
risk.

---
## M7 — AI writing assistant ✅

Write, rewrite, shorten, generate alt text, draft an SEO description — acting on the
currently selected Block's fields. Streaming, cancellable, with the API key held server-side
and rate limited per Site. This is where the provider abstraction and the Owner-only model
setting from [ADR-0007](./adr/0007-ai-generated-presets.md) are built, since Presets reuse
both.

**Done when:** an Author selects a heading, presses Rewrite, and the field updates with
something they can accept or reject.

**Built** at `356109b`. Rewrite, shorten, expand, proofread, alt text and search
descriptions, acting on whichever field an Author is editing — streaming, cancellable, and
off entirely until a Site configures a provider, because a button that always fails is
worse than no button.

Providers turned out to be a chain rather than a choice
([ADR-0014](./adr/0014-free-models-first-paid-as-fallback.md), amending
[ADR-0007](./adr/0007-ai-generated-presets.md)): free OpenRouter models first, then
Anthropic, OpenAI and DeepSeek. Free models fail in a recoverable way, so the alternative
was making an Owner choose once between "free but flaky" and "reliable but billed" — and
almost every Site wants free for the ordinary case and paid for the moment free stops
working. One OpenRouter key gets a working assistant with no card on file, which is the
same argument the local disk makes for storage.

**Faults found and fixed since.** The project audit rated four against this milestone and
three are closed: a total provider failure was written into the Author's field as publishable
content (I-19); nothing in the AI stack had a timeout, so a hung upstream held the request —
including a visitor's form POST (I-20); and Assist kept streaming into the previously
selected Block when the Author moved on (I-18).

The timeout took four attempts and the failures are worth knowing. A deadline on the whole
request cannot tell a model reasoning for two minutes from an upstream that died, so it
either abandons real work or catches nothing. Silence separates them — with a longer window
before the first token than between later ones — and a provider that goes quiet has to report
that as a `ProviderError`, or `chain.ts` rethrows it and the fallback never runs.

Still open: the rate limit is per-process per-person rather than per Site as this milestone's
own text claims (I-50).

---

## M8 — Packaging and Site number two ✅

Publish the packages with Changesets. Clone `starter` into a second Site with a different
`theme.ts` and one custom Block Type registered in `blocks.config.ts`. Fix a bug in
`packages/core`, publish, and upgrade both Sites.

This is the milestone that proves [ADR-0001](./adr/0001-packaged-template-cloned-per-site.md)
was worth its setup cost. If upgrading is painful here, the architecture is wrong and it is
still cheap to change.

**Done when:** one bug is fixed once and both Sites have the fix, each still looking like
itself.

**Done, 3 September.** The bug was I-33 from the audit: the local storage adapter was handed
a `contentType` and discarded it, so `get` guessed from the extension and returned
`application/octet-stream` for a type it had been told. The S3 adapter always kept it, so the
two disagreed and moving a Site from the disk to a bucket changed behaviour invisibly. Fixed
once in `packages/core`, released as 0.1.1, and both Sites have it — the Starter through the
workspace, Ledger by installing the tarball.

`sites/ledger` is Site number two: a chartered accountant, its own Theme, and one Block Type
of its own — a filing-deadline table, the kind of thing a real client asks for and the
standard library should never grow. It is deliberately **not** in the pnpm workspace, because
a workspace link would have tested the monorepo rather than the packaging.

**Four things this milestone found, which is what it was for.**

The packages had no build step — `next.config.ts` said so, "consumed as TypeScript source
until M8 adds a build step" — and would have published `exports` pointing at `.ts` files.
Each now emits JavaScript and declarations to `dist` and ships only that.

Pointing `exports` at `dist` broke the monorepo instead: every test began running against
built output, so a stale `dist` would have produced a green suite for code that was not the
source. `exports` stays on `src` and `publishConfig.exports` swaps to `dist` at publish time.

That swap is a **pnpm** feature. Publishing with npm silently ignored it and produced a
package whose `exports` pointed at `./src` while `files` shipped only `./dist` — it installs,
then fails on the first import. There is now a `prepublishOnly` guard in each package that
refuses npm and says why.

And pnpm's `minimumReleaseAge` refuses any version published in the last day, which makes a
publish-then-upgrade loop impossible against a local registry. Ledger turns it off in its own
`pnpm-workspace.yaml`, with a note to restore the default when it points at npm proper.

**What is not proven.** These packages have never been published to npm itself. The registry
is Verdaccio, in `docker-compose.yml` behind the `registry` profile, so nothing has been
released publicly and the `@mimnets` scope is still unclaimed. Everything above — the build,
the exports, the guard, the install, the upgrade — is real; only the hostname is local.

---

**v1 ends here, and it is finished.** Use it on a real Site, for a real client, before
starting M8.5. Everything below is informed by what that reveals.

---

## M8.5 — Grow the Block library ✅

Roughly fifteen to twenty Block Types: hero variants, feature grids, testimonial, logo
strip, CTA band, pricing table, accordion, embed, and the three that were asked for by name —
an **image gallery** (a repeater of images with a lightbox), a **carousel**, and a **location
map**. The map Block defaults to an OpenStreetMap embed, which needs no API key and sets no
third-party cookies; a Site that wants Google Maps supplies its own key and accepts the
consent-banner consequences.

**Markdown prose** lands here too, with a sanitising renderer
([ADR-0011](./adr/0011-markdown-for-prose-json-for-layout.md)) — prose Blocks and, later,
blog posts store Markdown rather than plain strings or HTML. Each one is a
`defineBlock` call and a component — if this stage is slow, the M1 interface was wrong and
that is the real finding.

This is the largest milestone by hours and the least interesting by architecture. It is
also the prerequisite for Presets being worth anything: generated layouts drawn from six
Block Types all look like the same Site.

**Done when:** you can build a plausible landing page for three different industries
without writing a custom Block.

**Started early, and out of order.** Eight composition Blocks exist — eyebrow, button,
feature grid, statistics, testimonials, logo strip, call to action and pricing plan — taking
the library to fourteen. Sections gained a tone, a height and a background image
([ADR-0013](./adr/0013-the-band-is-the-sections-job.md)), which is what turns a stack of
content into a page that looks composed, and the Starter's Theme was rewritten around it.

The reason for jumping the queue: the honest answer to "how do we make this look good?" is
not AI. A generated Preset can only arrange the Blocks that exist, so six Block Types
produce six variations of the same plain page — which this milestone's own text has said
since it was written. Presets get built on top of this, not instead of it.

**The six landed on 5 September**, taking the library from fourteen Block Types to twenty:
accordion, image gallery, carousel, location map, video, and Markdown prose with its
renderer ([ADR-0011](./adr/0011-markdown-for-prose-json-for-layout.md)).

Four of them turned out to be the same decision asked four times — how much of the browser
can be used instead of shipping JavaScript. The accordion is `<details>`; the gallery's
lightbox is `:target`; the carousel is scroll-snap; the video and the map are sandboxed
iframes. `packages/blocks` still has exactly one dependency and still contains no client
component, so every one of these works before a Site has hydrated.

Two of them are security boundaries rather than layout, and are tested as such. The video
Block is an allowlist: an iframe's `src` decides which origin runs code on the Site, and the
string comes from an Author, so YouTube and Vimeo are recognised and everything else becomes
a plain link. Prose renders with markdown-it at `html: false`, which is stronger than the
sanitising pipeline the ADR asks for — raw HTML is never parsed, so there is no scrubbing
step to misconfigure — and the token stream is walked into React elements rather than an
HTML string, so no `dangerouslySetInnerHTML` exists to be fed something else later.

**Two more, added and built 5 September.** They came from what a Site turned out to want
rather than from the original list: a **comparison table** — what a pricing page reaches for
the moment one plan is not enough — and a **social links row**.

Neither turned out to be the ordinary `defineBlock` work they were filed as. The comparison
table is a real `<table>` with `scope` on both kinds of header, because that is the whole
difference between "Priority support, Standard, not included" and a wall of ticks read out
with nothing to attach them to; and a comparison is two-dimensional while a repeater is a
list, so values are matched to plans positionally and the render pads a short row rather than
sliding it left. The social row's address field is free text a client types, so it is a place
`javascript:` can be entered by hand — every address is parsed and anything that is not http,
https, a real email or a real phone number is dropped. It ships no brand logos: they are
trademarks with usage terms nobody would be tracking, so each link carries `data-network` and
a Theme supplies its own glyph.

**The library is twenty-two Block Types.** The exit criterion — a plausible landing page for
three industries without writing a custom Block — is met.

`field.repeater` already exists and its own comment names "a carousel's slides", so the
gallery, the carousel and the comparison table need no M1 work. That was the milestone's own
test of whether the M1 interface was right, and it passes.

---

## M9 — Presets ✅

Generate a Theme plus starting Page layouts as one coherent Preset, offer three or four
options, apply the chosen one. Output is validated against the Block Zod schemas and
rejected if invalid. Owners apply a Preset when scaffolding a Site; Authors may apply one to
a single Page, writing to that Page's Draft with a version snapshot taken first
([ADR-0007](./adr/0007-ai-generated-presets.md)).

**Done when:** scaffolding a new Site with the prompt "law firm" and the prompt "skate shop"
produces two Sites nobody would guess share a codebase — and an Author who regenerates a
Page they liked better before can restore it in one click.

**Built, and the exit criterion is a test.** "A family law firm in Leeds" and "a skate shop
in Bristol" are generated against a real free model and asserted to differ in palette and in
copy — each written about its own business rather than filled with generic sentences. An
Author regenerating a Page writes to the draft with a snapshot taken first, so History is
the one-click undo.

Generated output is validated against the registry's own Zod schemas, and the prompt is
generated *from* the registry — which is what turns validation from the thing that catches
failures into the thing that confirms successes. A model cannot invent a Block Type.

Two findings worth keeping. Free models drop keys from a described object every time, so
the Theme requires only its palette and everything else is defaulted — including the two
contrast colours, which are derived from luminance rather than asked for, because a model
guessing at contrast produces unreadable text. And a generated Theme is stored in the
database rather than written to `theme.ts`: applying a Preset has to work at runtime, and a
Site that rewrites its own source is a different product. `theme.ts` stays the default and
"Reset" returns to it.

---

## After M9

In the order they are most likely to earn their place:

1. **Collections, and the blog that comes with them** — structured content types per Site
   (Blog Post, Product, Team Member) with an auto-generated admin UI, plus the Blocks that
   query them. A modern blog is the first thing built on top: Markdown bodies, a listing
   Block with pagination, per-post routing, tags, an RSS feed, and reading time. This is the
   thing that makes the product more than a page builder, and it is a milestone in its own
   right rather than a feature.
2. **Inline text editing** in the Editor preview, for text Blocks only.
3. **Redirects and JSON-LD.**
4. **Translation UI** — the `locale` column is already waiting.

Deliberately not on this list: an analytics dashboard, a public-site chatbot, and a raw
database admin UI. See [ADR-0006](./adr/0006-v1-scope-boundary.md).

---

## M10 — The Editor an Author lives in

M9 finished the generative half: a Site can be given a look it did not have. This milestone
is about the hours after that, when an Author is arranging a real Page and the Editor is the
only thing between them and the work.

Nothing here is a new capability. Every item is something the Editor already almost does,
and whose absence is felt on the second afternoon rather than the first.

**Undo and redo.** `EditorAction` has no undo, and History is a publish-time snapshot —
disaster recovery, not editing. An Author who deletes a Section by accident currently has no
way back that does not involve publishing. The reducer is pure and its actions are
serialisable, so this is a wrapper over the existing one rather than a change to any case.

**Duplicate a Block, duplicate a Section.** Building a three-item feature row is add,
configure, add, configure, add, configure. With duplicate it is configure once. The whole
feature is a deep copy with fresh ids, and the ids are the part to get right: two nodes
sharing one would give dnd-kit the same draggable twice.

**Blueprints.** A Section saved by name and inserted as a copy. Distinct from a Shared Slot
([ADR-0015](./adr/0015-headers-and-footers-are-shared.md)), which is one Section used in
many places and edited once; a Blueprint is a starting point that stops being related to its
source the moment it is inserted. This is how twenty-two Block Types reach the variety of a
library ten times the size ([ADR-0018](./adr/0018-the-editor-is-ours-because-the-block-type-is.md)),
and a Blueprint is Block JSON validated by the same schemas the Editor writes through, so it
inherits the Preset guarantee without new machinery.

**A responsive preview.** Columns stack on narrow screens without anybody authoring it,
which means an Author never sees the stacked result until they publish. The obstacle is real
and worth naming: CSS breakpoints answer to the viewport, so narrowing a preview pane does
not trigger them. Either the preview becomes an iframe — a true viewport, at the cost of a
boundary selection and dragging must now cross — or the Blocks move to container queries.
The second is the smaller change and the one to try first, because `packages/blocks` styles
against Theme tokens throughout and the migration is mechanical.

**Done when:** an Author deletes a Section, presses Ctrl+Z and has it back; builds a
three-column feature row by configuring one Column and duplicating it twice; saves that
Section as a Blueprint and drops it into another Page; and switches the preview to a phone
width to see it stack, all without leaving the Editor.

---

---

## M10.5 — Four things a client asks for in the first week

Raised on 5 September, none of them in any milestone, and all small enough that leaving them
unplanned was the only reason they were not built. Three of the four share a shape: each is a
property the layout engine could already carry, sitting one field away from existing. The
fourth, the button row, is a Block rather than a property, and it is here because it is the
same size of job and comes from the same place — somebody trying to build an ordinary page and
finding they cannot.

**A Header that stays.** A Site's Header scrolls away and there is no option not to. `position:
fixed` appears exactly once in the whole stylesheet and it is the gallery's lightbox. The
setting belongs on the Shared Slot rather than on a Page — a Header is shared
([ADR-0015](./adr/0015-headers-and-footers-are-shared.md)) and one that stuck on some Pages and
not others would read as a bug. Three values: scrolls, sticky, fixed. The work that is not
obvious is the rest of the page: a fixed Header needs the content below it offset by its own
height, which is a `scroll-padding-top` and a measurement, not a magic number.

**Per-Section width.** A Section has a tone, a padding and a background, and no width, so every
band is the Theme's one global `measure`. That is the wrong default for exactly the Blocks
added in M8.5: a gallery, a carousel and a map all want the full width of the window, and today
they cannot have it. The field is `width: "measure" | "wide" | "full"`, resolving to Theme
tokens like every other Section property ([ADR-0013](./adr/0013-the-band-is-the-sections-job.md)) —
and *not* a free number, for the same reason there is no colour picker.

**Two buttons side by side.** Asked for on 6 September, and the answer today is "set the
Section to two Columns", which is the wrong answer: it puts each button at half the width of
the band with a gutter between them, when what a hero wants is "Book a table" and "See the
menu" sitting next to each other. Blocks inside a Column stack, always — `.mn-column` is a
flex column, and Blocks never contain other Blocks, which is
[ADR-0003](./adr/0003-sections-and-columns-not-free-canvas.md)'s rule and is not the thing to
reopen for this.

So: **a button row Block** — a repeater of buttons laid out horizontally, wrapping on a phone,
each with the same variants a single button has. It is the same shape as `logos` and `social`,
which are already repeaters that lay their items out in a line, so it needs nothing from the
layout engine and no new concept for an Author to learn.

The alternative was a Column property — "lay these Blocks out in a row" — which is more
general and was rejected for now. It is a change to the layout engine rather than an addition
to the library; it needs answers about wrapping, alignment and what happens to a Block that
does not want to be in a row; and the case that actually comes up is two buttons. A general
mechanism for one common case is how a page builder acquires a second layout system nobody
can explain. Worth revisiting if a third case appears.

**Popovers.** Clicking a word or a button to open a panel with more detail and a picture: a
team member's biography, what a service includes, the story behind a photograph. There is a
proven pattern already in the repository — the gallery's lightbox is `:target` and no
JavaScript — and it should be reused rather than reinvented, because it works before hydration
and is keyboard operable without anybody implementing that. The open question is whether this
is a Block or a *field*: a repeater of popovers is a Block, but "this button opens a panel" is
a property of the button, and the second is more useful and harder.

**Done when:** a Header can be made to stay, a gallery can run edge to edge, and a team page's
photographs open a biography — none of it needing a line of custom code in a Site.

## M11 — Variants, and the end of counting Blocks

### First, the Theme has to be able to say anything

**This is M11's prerequisite, and without it M11 cannot meet its own exit criterion.** A
variant is styled in the Theme layer, so variants can only differ by as much as a Theme can
express — and today that is: colour, two typefaces, one corner radius, and two spacing values.
Six token families in total. There is exactly one radius token, used twenty-six times, so every
rounded corner on every Site is the same value; there is no shadow token at all, and the two
`box-shadow` rules in fifteen hundred lines of Block CSS are hard-coded; there are no
gradients.

Which is why every Site reads as the same flat rectangles in a different palette, and why
`starter/theme.ts` claiming "your Site will not look like everyone else's" is currently a
claim the tokens cannot back.

So the vocabulary grows first:

```ts
elevation: { none, low, high }           // tinted with the primary, never grey
radius:    { none, sm, base, lg, full }  // a scale, not one value
border:    { hairline, base, bold }      // 1px against 2px is most of editorial against brutalist
surface:   "flat" | "bordered" | "raised" | "glass"
```

**Built, 5 September, on `feat/m11-theme-tokens`.** All four, wired through the Block library
rather than only declared: the two hard-coded `box-shadow` rules are `--mn-elevation-high`, the
twenty-six radius uses are spread across the scale by what they are (a button is `sm`, a
lightbox image is `lg`, an avatar is `full`), and the four card Blocks — quote, plan, accordion
item, carousel slide — are drawn from four `--mn-surface-*` properties instead of from literal
values. `--mn-radius` is still emitted as the base of the scale, because Ledger's stylesheet is
written against it.

Three decisions came out of building it, and they are the ones worth arguing with rather than
the code:

- **A scale is derived from `base`, not merged onto the default's.** Merging leaves a Site that
  states `base: "0"` holding the default's 3px `sm` — Ledger asking for square corners and
  getting two rounded ones it could not see in its own file. The same shape as the readable
  colours: derive from what this Theme says, and let an explicit value win.
- **`elevation` is not in `themeSchema` at all.** A `box-shadow` has no shape a regex can check
  and it is compiled into a `<style>` tag on every Page, so accepting one from a model reopens
  the injection the schema exists to close — in exchange for a shadow that by definition does
  not match the Site's own primary. `surface` *is* accepted, because an enum of four words is
  a design choice rather than a string. [ADR-0019](./adr/0019-a-theme-derives-what-it-can-check.md).
- **The default is `flat`, which is what three of the four cards already were.** Chosen to
  leave existing Sites looking as they did rather than to be the best of the four. A token that
  changes every Site the day it lands is a token nobody trusts.

Built below: the variants themselves, Section dividers and `field.token`.

**The tinted shadow is the single highest-value line here.** A grey `box-shadow` reads as a
2015 card; the same shadow mixed with the Site's own primary reads as considered. It is one
`color-mix()` in a token and it changes every card, quote and pricing plan at once.

### Modern is mostly CSS now, which is the good news

None of the following needs an asset, a dependency or a line of JavaScript, and all of it is
expressible as Theme tokens — so [ADR-0013](./adr/0013-the-band-is-the-sections-job.md)'s rule
holds and a Site still cannot produce something off-brand:

- **Glass** — `backdrop-filter: blur()` over a translucent surface.
- **Mesh gradients** — layered `radial-gradient`s built from the Theme's own colours, which is
  what most "modern SaaS" backgrounds actually are.
- **Grain** — an inline SVG `feTurbulence` as a data URI, under a kilobyte and no request. It
  is what stops a flat colour looking cheap.
- **Gradient text** on headings, via `background-clip: text`.
- **CSS 3D** — `transform: perspective()` on hover for card tilt and layered depth. No client
  component, so the package keeps the property that makes it good.

**Built, 5 September, except the last one.** Glass shipped with the surface token above.
Mesh is a fifth Section tone: four soft radial blobs of the Site's own two brand colours over
its surface colour, composed by `themeToCss` and never stated, so a Site cannot take it
off-brand. Grain is `theme.texture` — one word, an inline `feTurbulence` under a kilobyte,
laid over every band. Gradient text is a fifth Block tone.

Three things that came out of building them:

- **The mesh caps every blob at 32%.** Above that the band stops being a tint of `surface`
  and becomes a colour of its own, at which point body text is being read against something
  nobody checked. Capped, it needs none of the foreground override rules `[data-tone="primary"]`
  carries — the text keeps the colour and the contrast it already had.
- **Gradient text runs between `primaryText` and `accentText`, not the brand colours,** and
  applies to headings only. Gradient text is still text, and the Starter's own accent is
  3.7:1 on white. The width limit is separate and was found by looking: across a box two
  characters wide every glyph lands on the gradient's midpoint, so a row of statistics came
  out as three identical muddy olives — worse than either colour and not a gradient at all.
- **Grain is a background layer, not an overlay.** The overlay version needed a stacking
  context on the Section or on `.mn-columns`, either of which traps the gallery lightbox
  (`z-index: 50`) and the mobile nav drawer (`z-index: 30`) inside the Section they live in.
  An open drawer painted under the Page below it is a navigation bug on every phone, in
  exchange for a texture nobody can consciously see.

**CSS 3D is not built**, and it is the one item here held back rather than finished. A tilt
on hover is a hover affordance, and the four things it would apply to — a quote, a plan, an
accordion item, a slide — are not things a visitor clicks. The tinted elevation above already
carries the depth this was for. It is worth doing on whatever M11's variants make genuinely
interactive, and worth doing there rather than here.

### What the review changed, and why

Reviewed on 6 September, before merging. Five defects, and the interesting thing is that they
were one defect: **a guard that already existed, with one new case not added to it.** The
milestone added five token families, and each of them needed adding to a rule somebody had
already written and already commented. Nobody re-read those rules.

Three of the fixes carry a decision worth keeping rather than merely a patch:

- **Derivation is clamped to the grammar the schema accepts, rather than the schema widened
  to fit derivation.** `scaleLength` kept four decimals against a `length` that admits two, so
  a Site stating `radius: { base: "0.75rem" }` derived `sm: 0.375rem` and could not save a
  Theme the code had derived itself. Widening the regex would have fixed that instance and
  re-opened the hole for the next family; rounding and bounding the derivation makes it
  structurally incapable of leaving the range. This is the same round trip bare `0` was
  admitted for, one step out — the third time this shape has been found.
- **A Section tone falls back rather than refusing.** `lenientLayoutSchema` relaxes only the
  *Block* schema, so a Section carrying a tone this Site does not know failed the salvage
  parse as well as the strict one and the Page came back empty — I-04's failure exactly, one
  level up from where I-04 was fixed. Growing `SECTION_TONES` to include `mesh` made it
  reachable by rolling back a deploy, or by publishing a Shared Slot from a Site on newer
  packages. `padding` now catches for the same reason. `layout` deliberately does not: it
  decides how many Columns a Section must have, so rewriting it to `"1"` would produce a
  document that fails its own structural rule, and refusing is right there.
- **`variants` is an ordered, storage-affecting contract.** The rule that the first declared
  variant is the default is what let this ship without migrating a Page — but the consequence
  was not written down: reordering the array restyles every Block that has not been re-saved
  since. It is now, here and in the changeset.

Two things about generation and seeding came out of it as well. The AI *page* prompt was never
updated when `style` stopped being a field, so every generated button came back primary and
nothing failed — the generated-from-the-registry argument at the top of `registry-prompt.ts`
holds only for what the registry is actually asked about. And the built-in designs and
`pnpm seed` were still writing `props.style`, minting fresh legacy documents for the migration
to rescue, which would have kept `variantWasField` alive forever.

### What is deliberately not here

**Rendered 3D icons and illustrations are images, not code.** Bundling them into
`@mimnets/blocks` would cost every Site the download whether it wants them or not, and that
style will date faster than the code will. They belong in the media library, which since
5 September already knows how to fetch and store pictures.

**WebGL is not a product feature.** A rotating model in a hero needs a client component and a
heavy dependency, and `@mimnets/blocks` having neither is not an accident — it is why every
Block renders before a Site has hydrated.

That refusal costs nothing, and this is the part worth remembering: **a Site can already do it
itself.** `sites/ledger/blocks/deadlines.tsx` is a Block Type defined in a Site, against the
installed package, with no change to the product. A client who genuinely needs a Three.js hero
gets one in their own `blocks/` folder. That is what M8's boundary was for.

**Icons are a separate decision** and not resolved here. There is no `field.icon` today. The
likely answer is a small bundled outline set for the affordances Blocks structurally need —
arrow, check, phone, mail — with anything decorative coming from the media library, but the
bundle cost is a trade worth making on purpose rather than in passing.

### Then, the variants themselves

The library grows by *look* rather than by count. A Block Type declares its variants the way
it declares its fields, and the Editor generates the control the way it already generates
every settings form:

```ts
defineBlock({
  name: "testimonial",
  variants: ["card", "quote", "minimal"],
  fields: { ... },
});
```

The variant is emitted as a data attribute and styled in the Theme layer, next to the tones
a Section already carries ([ADR-0013](./adr/0013-the-band-is-the-sections-job.md)). Nothing
about a Block's render changes, which is the test of whether the M1 interface was right for
a second time.

Two Blocks already do this by hand — a button has a `style` field, prose has a `width` — and
those become the first variants rather than staying local conventions. Twenty-two Block
Types with three variants each is a library that reads as far larger than it is, which is
the only version of that race worth entering.

**Built, 5 September.** `defineBlock` takes `variants`, the registry builds the enum per
Block Type from that list, the renderer emits `data-variant`, and the Editor generates the
control the way it generates every settings form. The testimonial has three looks — card,
quote, minimal — and the exit criterion below is met: the markup is byte-identical in all
three and the render was not touched.

Two decisions:

- **The first declared variant is what the Block already looked like**, and is the default.
  That is what let this ship without migrating a single stored Page: a Block written before
  variants existed parses to the appearance it already had, and nobody chooses anything.
- **The pair that did it by hand needed a real migration, and got one at the parse boundary.**
  A button's look is stored in `props.style` on every Page ever written, and `props` has
  stopped carrying it — an unknown key is stripped in silence, so every accent button on
  every Site would have come back primary with no error and nothing dropped.
  `variantWasField` names the old field and the registry lifts the value across as a Page is
  read; a Page rewrites itself into the new shape the next time an Author saves it. No
  downtime, no script, and deletable once every Site has re-saved.

Done on 6 September: **Section dividers** and **`field.token`**, both below.

**Section dividers** land here for the same reason: an angled or curved edge between two
bands is `clip-path` and a Section property, and it does more for how composed a Page looks
than three more Block Types would. *Built, 6 September.*

The one decision inside it: the shape is on a pseudo-element and never on the Section.
`clip-path` on the Section would establish a containing block for fixed and absolutely
positioned descendants, trapping the gallery lightbox and the mobile nav drawer inside
whatever band they sit in -- which is the grain overlay's bug exactly, and the reason it is
worth writing down twice. A pseudo-element has no descendants, so clipping one traps nothing.
The edge inherits the band's own colour, so a Section on the page background draws none:
there is no edge between two things that are the same colour.

**And a token picker, not a colour picker.** There is no `field.color`, and there should not
be — a free hex picker is [ADR-0003](./adr/0003-sections-and-columns-not-free-canvas.md)'s
mistake wearing a different hat, and a client who can put anything behind anything will.
What was missing is `field.token`: choose one of the Theme's own colours, so a Block that
offers a choice still cannot offer an unreadable one. *Built, 6 September.*

The Block Type narrows the list rather than the Theme doing it, because which colours read
depends on where they land -- an eyebrow is small, bold and uppercase, so it offers the four
that hold at that size and not body-text grey. The eyebrow is the first to use it and keeps
`accent`, the colour it had hard-coded, as its default: a field that repaints every Site the
day it lands is a field nobody adds, which is the same rule the first declared variant
follows.

**Done when:** the same testimonial Block looks like three different Sites without a line of
new render code, and changing six values in `theme.ts` still rebrands all three.

And the way to know, borrowed from M9's exit criterion because it worked there: generate three
Sites from the same twenty-two Block Types — a brutalist law firm, a soft wellness brand, a
dark developer tool — and assert that nobody would guess they share a codebase. M9 already
makes that assertion about palette and copy against a real model; this extends it to the thing
a visitor actually notices first.

---

## M12 — What the AI does, and what it must not

This product already uses a model three times: to write copy (M7), to generate a Preset (M9),
and to read a palette out of an image. This milestone is about the next three, and about
writing down the boundary — because the interesting question stopped being *can it* some time
ago and is now *where is it worth trusting*.

The evidence for that boundary is in this repository. On 5 September a model wrote eight Block
Types, three thousand lines and two hundred and fifty tests in a day; on the same day it
shipped an accessibility defect that made every Markdown image announce itself as decorative,
wrote an audit finding that was flatly wrong, and needed an independent reviewer to catch both.
What made the difference was never a better prompt. It was three habits: revert the fix and
watch the test fail, have something that did not write the code review it, and open a browser.

So the rule this milestone is built on: **a model writes; something else checks.** Every item
below produces a draft a person accepts, and none of them writes to a published Page.

**Import an existing site.** Give it the URL of the client's current website and get Pages,
copy and a Theme — as a draft, never published. This is the highest-value AI feature available
to an agency product and it is the one nobody has planned. It also has the clearest failure
mode: a bad import is visibly bad, which is the kind of wrongness to prefer.

**Regenerate one Section.** M9 generates whole Pages, which is the rarest thing an Author
wants. "Make this band a testimonial" is smaller, cheaper, used a hundred times more often, and
lands in the draft with a version snapshot taken first, exactly as a Preset does
([ADR-0007](./adr/0007-ai-generated-presets.md)).

**Say what a Page is missing.** The registry is already described to a model in about a
thousand tokens, so "this services page has no call to action and no way to contact you" is
mostly prompt work over machinery that exists. It suggests; it does not edit.

**And the catalogue pages generate themselves.** The effects gallery M10 asks for — the page
that shows an Author what "Rise" actually looks like — is exactly the tedious, mechanical work
worth handing over, because every example is derived from a registry that already exists.

**What stays hand-written**, and this is the load-bearing half: schemas, security boundaries,
and anything whose failure is silent. The September audit found five High-severity findings in
code that looked entirely fine — an `alt` that was always empty, six `href`s with no protocol
check, a sentinel that was never emitted. A model would have reviewed all of it and said it was
good, because it looked good. None of those had a visible symptom.

**Done when:** an Owner can point Mimnets at a client's old site and get a draft worth editing,
an Author can regenerate one band without touching the rest of the Page, and the effects
gallery is generated rather than maintained.
