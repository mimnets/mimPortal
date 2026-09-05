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

## M8.5 — Grow the Block library ⚠️ *(six of the eight done)*

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

**Two more, added 5 September.** They come from what a Site turned out to want rather than
from the original list: a **comparison table** — what a pricing page reaches for the moment
one plan is not enough — and a **social links row**. Both are ordinary `defineBlock` work
with no decision behind them, which is why they are recorded here rather than argued in an
ADR. They come after the six above, not instead of any of them.

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
