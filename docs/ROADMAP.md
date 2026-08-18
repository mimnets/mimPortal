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

## M4 — Auth and roles

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

## M5 — Pages, Menus and Theme

Page CRUD with path-based routing. The Menu entity, edited in one place, rendered by the
Menu Block in both Header and Footer. Responsive navigation with a mobile drawer.
`theme.ts` compiled to CSS variables, Tailwind wired to those variables, every standard
Block restyled to use tokens.

**Done when:** a three-page Site navigates correctly on desktop and mobile, and changing
six values in `theme.ts` visibly rebrands every page without touching a Block.

---

## M6 — Media and SEO

The `StorageAdapter` interface with an S3/R2 implementation and a local-disk implementation.
Real image uploads with a media library in the Dashboard. Per-Page title, description and
social share image. Generated `sitemap.xml` (published Pages only) and `robots.txt`.

**Done when:** you upload an image in the Dashboard, it appears on the published page, and
`/sitemap.xml` lists exactly the published Pages.

---

## M6.5 — Forms and email

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

---
## M7 — AI writing assistant

Write, rewrite, shorten, generate alt text, draft an SEO description — acting on the
currently selected Block's fields. Streaming, cancellable, with the API key held server-side
and rate limited per Site. This is where the provider abstraction and the Owner-only model
setting from [ADR-0007](./adr/0007-ai-generated-presets.md) are built, since Presets reuse
both.

**Done when:** an Author selects a heading, presses Rewrite, and the field updates with
something they can accept or reject.

---

## M8 — Packaging and Site number two

Publish the packages with Changesets. Clone `starter` into a second Site with a different
`theme.ts` and one custom Block Type registered in `blocks.config.ts`. Fix a bug in
`packages/core`, publish, and upgrade both Sites.

This is the milestone that proves [ADR-0001](./adr/0001-packaged-template-cloned-per-site.md)
was worth its setup cost. If upgrading is painful here, the architecture is wrong and it is
still cheap to change.

**Done when:** one bug is fixed once and both Sites have the fix, each still looking like
itself.

---

**v1 ends here.** Use it on a real Site, for a real client, before starting M8.5. Everything
below is informed by what that reveals.

---

## M8.5 — Grow the Block library

Roughly fifteen to twenty Block Types: hero variants, feature grids, testimonial, logo
strip, CTA band, pricing table, accordion, embed, and the three that were asked for by name —
an **image gallery** (a repeater of images with a lightbox), a **carousel**, and a **location
map**. The map Block defaults to an OpenStreetMap embed, which needs no API key and sets no
third-party cookies; a Site that wants Google Maps supplies its own key and accepts the
consent-banner consequences.

 lands here too, with a sanitising renderer
([ADR-0011](./adr/0011-markdown-for-prose-json-for-layout.md)) — prose Blocks and, later,
blog posts store Markdown rather than plain strings or HTML. Each one is a
`defineBlock` call and a component — if this stage is slow, the M1 interface was wrong and
that is the real finding.

This is the largest milestone by hours and the least interesting by architecture. It is
also the prerequisite for Presets being worth anything: generated layouts drawn from six
Block Types all look like the same Site.

**Done when:** you can build a plausible landing page for three different industries
without writing a custom Block.

---

## M9 — Presets

Generate a Theme plus starting Page layouts as one coherent Preset, offer three or four
options, apply the chosen one. Output is validated against the Block Zod schemas and
rejected if invalid. Owners apply a Preset when scaffolding a Site; Authors may apply one to
a single Page, writing to that Page's Draft with a version snapshot taken first
([ADR-0007](./adr/0007-ai-generated-presets.md)).

**Done when:** scaffolding a new Site with the prompt "law firm" and the prompt "skate shop"
produces two Sites nobody would guess share a codebase — and an Author who regenerates a
Page they liked better before can restore it in one click.

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
