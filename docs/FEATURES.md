# Features — what exists, and what does not

The inventory. Last checked against the repository on **5 September 2026**, at `main`.

**Visual overview:** [the build-state page](https://claude.ai/code/artifact/acf61387-ca91-42ff-bac8-4e3d25d9b30f)
— the same content as a single page, with the figures and the milestone rail laid out. It is
private to the account that owns it, and it is a snapshot: where it and this file disagree,
**this file is right**.

## What owns what

Four documents, and the reason to keep them apart is that two of them have already drifted
into each other once. On 5 September `docs/ROADMAP.md` and `HANDOFF.md` named different Block
Types as M8.5's remaining work, and nobody could tell which was true without reading the code.
So:

| File | Owns | Does not |
| --- | --- | --- |
| **`docs/FEATURES.md`** (this) | The inventory: what is built, what is not | Say why, or what to do next |
| **`docs/ROADMAP.md`** | Intent: milestones, what each is for, its exit criterion | Track day-to-day state |
| **`HANDOFF.md`** | Where to pick up, and what needs a person | Restate the inventory |
| **`CONTEXT.md`** | What the words mean | Anything else — it is a glossary |

If you find yourself editing the same fact in two of these, one of them is wrong about its job.

---

## Built

Milestones **M0 through M9** are complete, including **M8.5**. They are numbered because they
shipped in that order and each depended on the one before it — a layout engine had to exist
before an Editor could arrange it, and a Block library had to exist before generated Presets
were worth anything.

| | Milestone | What it means |
| --- | --- | --- |
| ✅ | **M0** Foundations | pnpm/Turborepo monorepo, Postgres + Drizzle, `pnpm setup` wizard, Dockerfile and compose |
| ✅ | **M1** Layout engine | Slot → Section → Column → Block as one validated JSON document; `defineBlock`; renderer |
| ✅ | **M2** The Editor | Split view, drag between Columns and Slots, forms generated from field declarations |
| ✅ | **M3** Draft, publish, history | Edits invisible until published; every publish snapshots; restore into the draft |
| ✅ | **M4** Auth, roles, installer | Better Auth, Owner/Author, Slot locking enforced server-side, web installer |
| ✅ | **M5** Pages, Menus, Theme | Path routing, the Menu entity, `theme.ts` → CSS variables, responsive navigation |
| ✅ | **M6** Media and SEO | StorageAdapter, uploads, media library, per-Page SEO, sitemap, robots |
| ✅ | **M6.5** Forms and email | Contact Block, Enquiries in the Dashboard, pluggable spam checks, EmailAdapter |
| ✅ | **M7** AI writing assistant | Rewrite, shorten, alt text, search descriptions, over a chain of providers (ADR-0014) |
| ✅ | **M8** Packaging, Site two | Packages build and publish; `sites/ledger` installs them rather than linking to source |
| ✅ | **M8.5** Block library | 22 Block Types, Section tones, a Theme built around them |
| ✅ | **M9** Presets | Generate a Theme and Pages together, validated against the registry before they land |
| ✅ | **Stock images** | Photographs fetched into the Site's own store when a Preset is applied |
| ⚠️ | **M10** The Editor an Author lives in | Undo/redo and duplicate built; Blueprints and the responsive preview are not |

### The Block library — 22 types

Content: `heading`, `text`, `prose`, `image`, `logo`, `menu`, `contact`.
Composition: `eyebrow`, `button`, `features`, `stats`, `testimonial`, `logos`, `cta`, `pricing`.
Added 5 September: `accordion`, `gallery`, `carousel`, `map`, `embed`, `compare`, `social`, and `prose` above.

Five of the eight added are built on the browser rather than on JavaScript — `<details>`,
`:target`, scroll-snap, sandboxed iframes and a real `<table>` — so `@mimnets/blocks` still has
exactly one dependency, contains no client component, and renders before a Site has hydrated.

Three are security boundaries and are tested as such:

- **`embed`** allowlists its iframe hosts. An iframe's `src` decides which origin runs code on
  the Site, and the string comes from an Author, who is a client.
- **`social`** parses every address; anything that is not http, https, a real email or a real
  phone number is dropped rather than rendered as a live `href`.
- **`prose`** parses with markdown-it at `html: false`, so raw HTML is never admitted rather
  than admitted and scrubbed. There is no `dangerouslySetInnerHTML` anywhere in the repository.

### Stock photographs

`StockAdapter` with Unsplash and Pexels, media provenance columns, and the apply-time fill: a
Preset describes each photograph in the image's `alt`, and applying it searches, downloads into
the Site's own media store and records the photographer. Never hotlinked (ADR-0012), never
fetched for a Preset nobody chose, and a provider having a bad day leaves grey rectangles
rather than a failed Preset. Optional, and off until a key is set — see
[docs/STOCK.md](./STOCK.md).

### Infrastructure

- **Component tests.** The suite had no DOM at all until 5 September; a component test now opts
  in per file with a `// @vitest-environment jsdom` docblock, so the 249 node tests stay fast.
- **`@mimnets/blocks/blocks.css`** ships the Block styling, so a Site that upgrades receives
  something to draw the new Blocks with. The Starter's own stylesheet is 33 lines.
- **A publish guard** that checks the artefact as well as the package manager.
- **18 architecture decision records** in `docs/adr/`.
- **508 tests passing**, 7 skipped (the live-provider suites, opt-in with `AI_LIVE_TESTS=1`).

---

## Not built

### Waiting on a person

- **Publishing to npm.** `npm login` is interactive. The first publish claims the `@mimnets`
  scope permanently. It also unblocks `sites/ledger`, whose lockfile pins hashes from a
  disposable local registry.
- **Using it on a real Site**, which `docs/ROADMAP.md` asks for before M8.5 and which has never
  been done. Eight Block Types have tests and a browser check; nobody has built a client's page
  with a carousel and found out what is annoying about it.

### Partly built

- **Animation.** A Block can be set to appear with `fade` or `rise` as it scrolls into view,
  chosen from the Theme rather than as a utility class. That is the whole of it: three options
  on one control. There is no Section stagger, no slide, scale, blur or wipe, no parallax, no
  speed control, and no gallery showing an Author what any of them look like — choosing "Rise"
  today shows them nothing.
- **The blog.** Its prerequisite is built: the `prose` Block stores Markdown and renders it
  through a shared sanitising renderer (ADR-0011). What does not exist is posts as a thing of
  their own — their own routing, a listing Block, dates, ordering, or anything a CMS would call
  a collection.

### On the roadmap, not started

A preview panel in the Design tab · AI provider and model settings · a Vercel deploy button
with Neon · Blueprints and the responsive preview (the rest of M10).

### Asked for, not yet planned

Raised on 5 September and not in any milestone. None of these exists in any form:

- **A sticky, fixed or scrolling Header.** A Site's Header scrolls away and there is no option.
  `position: fixed` appears once in the whole stylesheet and it is the gallery's lightbox.
- **Per-Section width.** A Section has a tone, a padding and a background, and no width. Every
  Section is the Theme's one global `measure`, so a full-bleed band — which is what a gallery,
  a carousel or a map usually wants — cannot be expressed.
- **Popovers.** Clicking a word or a button to open a panel carrying more detail and a picture.
  The gallery's `:target` lightbox is a proven no-JavaScript pattern to build it on.

### Known gaps, deliberate

Each of these is a decision with reasoning behind it, not an oversight:

- **The nav is one level deep** (`render/context.ts`). A dropdown reopens that decision, and
  hover intent, keyboard traps and mobile behaviour make it harder than it looks.
- **Nothing is cached.** Every request reads the database.
- **Deleting a file leaves Pages pointing at nothing** (ADR-0012), and there is no
  "where is this used?" view.
- **A form's fields are fixed**: name, email, message.
- **There is no lint.** ESLint cannot run: TypeScript 7.0 is the native Go port and ships a CLI
  with no compiler API. Revisit at 7.1 rather than adding a linter that cannot see types.
- **Two colour decisions are open on purpose**, with their numbers pinned in
  `packages/core/src/theme/derive.test.ts`. See A-26 and A-27 in the September audit.
- **AVIF and SVG upload without dimensions.** They render, without width and height.
- **Nobody has sent through Resend**, and the installer's provisioning mode is untested.

### Open findings

**63**, each already carrying a file and a line number:

- **7 from the September audit** ([`specs/project-audit-2/research.md`](../specs/project-audit-2/research.md)) — two of which resolve at the first publish rather than by editing anything.
- **56 from the August audit** ([`specs/project-audit/research.md`](../specs/project-audit/research.md)) — the Medium and Low bands.

---

## Keeping this honest

This file goes stale the moment something ships. Two habits keep it useful:

1. **Update it in the same commit as the change**, not afterwards. A separate tidy-up commit is
   one that does not get written.
2. **Check the figures rather than carrying them forward.** `pnpm test` prints the count;
   `grep -c "= defineBlock" packages/blocks/src/*.tsx` counts the Block Types. Every number in
   this file came from a command, and the next person should be able to re-run it.
