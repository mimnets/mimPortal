# Handoff — 5 September 2026

Where Mimnets stands, what is not finished, and where to pick up. Read this first; it is
written to be the only thing you need before starting.

**This is the second version written on 5 September**, and it replaces the one committed that
morning at `a9aca0b`. That one said the next session's job was to build M11's Theme tokens on
an empty branch. It is now built, along with most of the rest of the milestone, so its whole
"Where to start" is spent.

The version before that was dated 3 September. If you are reading a copy of it, discard it: it
says component tests are blocked on a pnpm store mismatch, and that diagnosis was wrong — see
the toolchain note below.

## Where to start

**Three commits on `feat/m11-theme-tokens`, pushed, not merged.** The next session either
reviews and merges the branch, or finishes M11 on top of it — two things are left and both
are small. Everything else in this file is context.

| | Commit | What it is |
| --- | --- | --- |
| 1 | `5fbea22` | The prerequisite: four token families a Theme could not say before |
| 2 | `15ba162` | The CSS-only looks: mesh, grain and gradient type, all from the palette |
| 3 | `285dcf0` | The variants: a Block Type declares its looks the way it declares its fields |

**M11's exit criterion is met.** The same testimonial Block looks like three different Sites —
card, quote, minimal — with byte-identical markup and no change to its `render`. Changing six
values in `theme.ts` still rebrands all three, because every rule in all three is written
against tokens.

### What landed

A Theme could express colour, two typefaces, one corner radius and two spacing values: six
families, one radius token used twenty-six times, no shadow token at all. It now expresses
eleven, and the Block library is wired through all of them.
[docs/ROADMAP.md § M11](./docs/ROADMAP.md) carries each decision and what it was weighed
against; [docs/FEATURES.md](./docs/FEATURES.md) carries the inventory. The short version:

- **`elevation`**, **`radius`** as a five-step scale, **`border`** as three weights,
  **`surface`** as one of four keywords, **`texture`** as grain or nothing.
- A **`mesh`** Section tone and a **`gradient`** Block tone, built on top of them.
- **Variants**: `defineBlock` takes `variants`, the registry builds the enum per Block Type,
  the renderer emits `data-variant`, and the Editor generates the control the same way it
  generates every settings form.

Three of those are the ones to have opinions about. The tinted shadow is the milestone's own
"highest-value line" and it is one `color-mix()`: every card, quote and plan on a Site now
carries a shadow mixed from that Site's own primary rather than grey. `surface` is one word
that redraws four Block Types at once. And the first declared variant is always what the
Block already looked like, which is the rule that let all of this ship without migrating
anything.

`starter/theme.ts` states `surface: "raised"` and `texture: "grain"`. Both are the
demonstration and both are one-word reverts if you disagree. The Site was reset to `theme.ts`
during the session, so <http://localhost:3000> is wearing "Ink & Ember" rather than the
generated Theme it had been.

`sites/ledger` is deliberately untouched. It installs the published `@mimnets/core`, which
has none of this until the publish described further down happens.

### The one thing that could have gone wrong quietly

A button's look lived in `props.style` and prose's in `props.width`, on every Page ever
written — and those two Block Types no longer declare those fields. An unknown key is
stripped in silence, so every accent button on every Site would have come back primary: no
error, no dropped Block, nothing in a log.

`variantWasField` names the old field and `registry.ts` lifts the value across as a Page is
read. An explicitly chosen variant always wins, so a Page saved once never consults the old
field again, and a Page rewrites itself into the new shape the next time an Author saves it.
There is no database migration and no script, and the hook is deletable once every Site has
re-saved — worth deleting then. `packages/core/src/blocks/variants.test.ts` is mostly about
this, including the shape almost every stored Block is actually in: a `style` object that
predates variants and has no `variant` key.

### What is left of M11

- **Section dividers** — an angled or curved edge between two bands, which is `clip-path` and
  a Section property. ADR-0013 is why it belongs on the Section rather than on a Block.
- **`field.token`** — choose one of the Theme's own colours, so a Block that offers a choice
  still cannot offer an unreadable one.
- **CSS 3D**, which is held back rather than missed. A tilt on hover is a hover affordance and
  a quote is not something a visitor clicks; the tinted elevation already carries the depth it
  was for. It belongs on whatever a variant makes genuinely interactive. The roadmap has the
  argument.

Nineteen Block Types have no variants yet. Adding them is now `defineBlock` work and CSS,
which was the point.

### What to know before continuing

- **Ask for what a schema can prove; derive what the Theme already knows.**
  [ADR-0019](./docs/adr/0019-a-theme-derives-what-it-can-check.md) is the rule the last two
  commits were built against, and the rule the next ones should be. `elevation`, the mesh and
  the text gradient are absent from `themeSchema` entirely and always derived — a `box-shadow`
  has no shape a regex can check, and every one of these is compiled into a `<style>` tag on
  every Page. `surface` and `texture` *are* accepted, because a closed set of words is a
  design choice rather than a string.
- **The first declared variant is what the Block already looked like**, and it is the default.
  Keep that rule when the other nineteen Block Types get variants; it is the whole reason
  nothing had to be migrated.
- **A scale is derived from `base`, never merged onto the default's.** Merging hands a Site
  that states `radius: { base: "0" }` the default's 3px `sm` — Ledger asking for square corners
  and getting two rounded ones it could not see in its own file. There is a test named for it.
- **Growing an enum is the change that can break every stored Page.** Both tone enums grew
  this session. Both are `.default(...)`, so a Section written before any of it still parses,
  and a Block whose tone this Site does not know is dropped rather than blanking the Page
  (I-04). `packages/core/src/layout/tones.test.ts` covers each.
- **There is no `field.color` and there should not be.** A free hex picker is
  [ADR-0003](./docs/adr/0003-sections-and-columns-not-free-canvas.md)'s mistake in a different
  hat. If a Block needs to offer a choice, it offers Theme tokens — which is what
  `field.token` above is for.

### Look at it in a browser, and mean it

This file asked for that before the session started, and it paid for itself twice. Two defects
were found by looking and could not have been found any other way:

- **Gradient statistics.** A gradient needs width to be a gradient. Across a box two characters
  wide every glyph lands on the run's midpoint, so 24 / 12 / 0 came out as three identical
  muddy olives — worse than either brand colour. Gradient type is headings only because of it.
- **A stacking context.** Grain was an absolutely-positioned overlay first, which needed a
  `z-index` on `.mn-columns` to keep content above it — and that traps the gallery lightbox
  (`z-index: 50`) and the mobile nav drawer (`z-index: 30`) inside whatever Section they live
  in. An open drawer painted under the Page below it, on every phone. Grain is a background
  layer now and needs no stacking context at all.

Neither was a failing test. Both were a screenshot.

### Two hazards this session hit, both already in this file's advice

**A CSS escape written through a heredoc came back as a control character.** The escape for an
opening quotation mark was read as *octal*, so U+0081 was written into `blocks.css` where the
character belonged. Same family as the NUL byte in `assist.ts`, and just as invisible — it
renders as nothing and greps as nothing. The file was swept for others and is clean. Write the
character itself, or build the string from a character code, rather than trusting an escape
through two layers of quoting.

**A `git checkout <file>` meant to undo a deliberate break threw away that file's whole
session.** It had been copied aside first, so it cost a minute. Back up before breaking a file
on purpose, or break it in a way you can reverse exactly.

### What not to do on this branch

Rendered 3D icons and WebGL are **deliberately out of M11** and the reasoning is written into
the milestone. Icons are an open decision about bundle cost, not something to settle in
passing.

---

Everything below has landed on `main` and is pushed. The repository moved to
**https://github.com/mimnets/mimPortal.git** on 5 September; if a clone still points at
`mimnets-typescript-website-builder`, run `git remote set-url origin`.

**Twenty of the second audit's findings are closed** — every High, and all but two Mediums.
[specs/project-audit-2/research.md](./specs/project-audit-2/research.md) carries the rest, each
with a file and a line number, plus a "Verified clean" section recording what was checked and
found sound so nobody pays for it twice.

**M10 is merged**, including undo and redo. It was reviewed before merging and one defect was
found and fixed in review: a duplicated Block shared its original's `props` and `style` objects,
harmless only because every writer replaces those objects rather than mutating them.

**Stock images shipped.** `StockAdapter` with Unsplash and Pexels, media provenance columns, and
the apply-time fill — a Preset describes each photograph in the image's `alt`, and applying it
searches, downloads into the Site's own store and records the photographer. Optional and off
until a key is set; see [docs/STOCK.md](./docs/STOCK.md).

Three things still need a person:

**1. Publish, if you want it public.** `npm login` is interactive. Then `pnpm release`; a
changeset exists and `pnpm changeset status` reports all three packages bumping minor. The
first publish claims the `@mimnets` scope permanently. Note **A-28**: `pnpm build:packages` had
been matching no packages at all and would have published whatever was lying in `dist`. It is
fixed; it is also the reason to read what `pnpm release` says rather than trusting it.

**2. `sites/ledger` is waiting on that publish.** Its lockfile pins integrity hashes from the
disposable Verdaccio volume (A-14) and CI never installs it (A-16); both resolve at a real
registry rather than by editing anything now. Its upgrade step is in the changeset: bump the
dependency, add `import "@mimnets/blocks/blocks.css";` above `import "./globals.css";`, then
delete the Block sections from its own `globals.css`.

**3. Two colour decisions are still deliberately left to you**, with their numbers pinned in
`packages/core/src/theme/derive.test.ts`. `readableOn` picks white on the default accent at
3.27:1 where black would be 5.77:1, and changing it flips button text on every Site whose accent
sits in that range — a design decision rather than a bug fix, which is why it was recorded and
not taken. See A-26 and A-27.

The previous version of this file said these were worth settling as part of M11. M11 has now
largely landed and they were not settled, so that is a judgement this file has already deferred
once: nothing in the token work depended on it, and `readableOn` still governs text on every
coloured band on every Site. It is a five-minute change and an hour of looking at Sites, and it
wants a person with an opinion rather than a session.

## What exists today

| | Milestone | What it means |
| --- | --- | --- |
| ✅ | **M0** Foundations | pnpm/Turborepo monorepo, Postgres + Drizzle, `pnpm setup` wizard, Dockerfile and compose |
| ✅ | **M1** Layout engine | Slot → Section → Column → Block as one validated JSON document; `defineBlock`; renderer |
| ✅ | **M2** The Editor | Split view, drag between Columns and Slots, forms generated from field declarations |
| ✅ | **M3** Draft, publish, history | Edits invisible until published; every publish snapshots; restore into the draft |
| ✅ | **M4** Auth, roles, installer | Better Auth, Owner/Author, Slot locking enforced server-side, web installer |
| ✅ | **M5** Pages, Menus, Theme | Path routing, the Menu entity, `theme.ts` → CSS variables, responsive navigation |
| ✅ | **M6** Media and SEO | StorageAdapter, uploads, media library, per-Page SEO, sitemap, robots |
| ✅ | **M6.5** Forms and email | Contact Block, enquiries in the Dashboard, pluggable spam checks, EmailAdapter |
| ✅ | **M7** AI writing assistant | Rewrite, shorten, alt text, search descriptions, over a chain of providers (ADR-0014) |
| ✅ | **M8** Packaging, Site two | Packages build and publish; `sites/ledger` installs them and upgraded from 0.1.0 to 0.1.1 |
| ✅ | **M8.5** Block library | 22 Block Types, Section tones, a Theme built around them |
| ✅ | **M9** Presets | Generate a Theme and Pages together, validated against the registry before they land |

**v1 is finished, and M8.5 closed on 5 September.** Every milestone from M0 to M9 is done.

There are two Sites now. `starter` is the one the monorepo develops against; `sites/ledger`
is a chartered accountant with its own Theme and one Block Type of its own, deliberately
outside the pnpm workspace so that it installs the published packages rather than linking to
their source. A workspace link would have tested the monorepo rather than the packaging.

## The audits

**There are two now.** The second, [specs/project-audit-2/research.md](./specs/project-audit-2/research.md),
is dated 5 September and covers everything the first could not know about: the packaging
pipeline, the second Site, the twenty fixes, and the eight Block Types written that morning.
21 findings, six already fixed, fifteen open. Its own summary is worth the minute: what it
found was not a new class of hole but a recurring shape — decisions made correctly, written
down correctly, and enforced nowhere.

It also records what was checked and found sound, so the next audit does not pay for it
again: `sites/ledger` was forked after every security fix and is byte-identical across all 98
tracked files, no secrets are committed, and 25 crafted Markdown inputs found no XSS in the
new Block library.

### The first audit

On 20 August the project was audited end to end, producing
[specs/project-audit/research.md](./specs/project-audit/research.md) — **85 findings**, each
with a file and a line number, banded High, Medium, Low and docs-versus-reality.

**Twenty were taken on**: the whole High band, plus I-30, I-32 and I-48 promoted from Medium
because they were security-shaped rather than merely untidy. **All twenty are closed**, on
`audit/high-severity`, in six seams:

| Seam | Findings |
| --- | --- |
| Entry points, first pass | I-01 open mail relay, I-02 installer failing open, I-03 Shared Slots destroyed on save |
| Test foundation | I-08 the suite failing without Docker, I-10 no coverage of any Draft/Published transition, plus CI |
| Layout integrity | I-04 one bad Block blanking a Page, I-11 a stale tab overwriting a publish |
| Entry points | I-07 reply-to header injection, I-30 `/media` serving the whole bucket, I-32 an unchecked Theme |
| Resilience and the Editor | I-05 no error boundaries, I-20 no timeouts, I-06, I-17, I-18, I-19 |
| Accessibility | I-09 no keyboard path, I-12 alt text, I-13 landmarks, I-14 contrast, I-15 announcements, I-16 focus trap |

**Two findings were rejected rather than implemented**, with the reasoning in their commits.
I-79 claimed the roadmap misreported the Block count; it did not. I-48 called
`applySlotsToAllPages` "an UPDATE with no WHERE", which is what the function is for — the
real omission was a missing `updatedAt`, and that was fixed instead.

Seven problems the audit did not list were found while fixing the ones it did, including
`deleteSection` discarding a selection in a Section it never touched, and `moveBlock` moving
the settings panel away from the Block being edited.

**Still open from the audit:** the Medium band beyond the three promoted, the whole Low band,
and the documentation findings already closed. `research.md` remains the record.

### Tests

`pnpm test` — **558 passing, 7 skipped, about thirty seconds.** It was 2 failing, 152 passing
and red without Docker.

The seven skips are the live-provider suites, off unless asked for:

```bash
AI_LIVE_TESTS=1 pnpm test     # calls a real model; slow and occasionally flaky by nature
```

They are opt-in because free models are rate limited and retired without notice, so they
fail for reasons unrelated to the code — which is the failure I-08 was about, reintroduced
once a run. Run them before shipping anything that touches the AI stack.

**Component tests start here.** The suite's default environment is still `node` — the 249
existing tests have no use for a DOM and should not pay for one. A component test opts in
per file with a `// @vitest-environment jsdom` docblock, which is why there is no new
configuration to keep in step.

Two files, eleven assertions:

- `BlockBoundary.test.tsx` renders through `Preview`, not the boundary on its own. That is
  deliberate: the defect that reached review was never in `BlockBoundary`, it was in how the
  boundary was *called*, and a test that mounts the boundary directly passes either way.
  Reintroducing the inline `blockType.render(...)` call turns all five red.
- `media.test.tsx` covers the picker's focus trap against the three-part contract its own
  comment states. Disabling the Tab handler turns three of the six red.

Each file was checked by breaking the code it covers and watching it fail. A component test
that has never been seen to fail is the thing that let the boundary ship broken.

**Not covered, and deliberately.** The keyboard sensor is dnd-kit's `KeyboardSensor` with
`sortableKeyboardCoordinates`, configured in three lines at `Editor.tsx:155`; testing it
means mounting the Editor with a drag context to re-verify somebody else's library. And the
focus trap filters on `offsetParent`, which jsdom never sets because it performs no layout —
the test stubs it, so the *visibility* half of that filter still needs a browser.

## Not finished

Honest list. None of it is hidden behind a green tick.

- **Nothing is published to npm.** The registry is Verdaccio, behind the `registry` profile
  in `docker-compose.yml`, so the `@mimnets` scope is unclaimed and no version is public. The
  build, the exports, the publish guard, the install and the upgrade are all real; only the
  hostname is local.
- **The keyboard sensor and the focus trap's visibility filter are still browser-only.**
  Everything else about the boundary and the trap is now in CI. See the Tests section.

- **The nav is one level deep**, deliberately (see `render/context.ts`). A client wanting a
  dropdown means reopening that decision, and the comment there is right that hover intent,
  keyboard traps and mobile behaviour make it harder than it looks.
- **There is no lint.** ESLint cannot run here at all: TypeScript 7.0 is the native Go port
  and ships a CLI with no compiler API, which typescript-eslint needs. Revisit at 7.1 rather
  than adding a linter that cannot see types (I-64).
- **Nobody has sent through Resend.** SMTP is proven against a real mail server; Resend is
  not, because that needs an account and a verified domain.
- **Provisioning mode of the installer is still untested.** This machine already had a
  database configured, so the no-database path has never been run.
- **A form's fields are fixed**: name, email, message.
- **Deleting a file leaves the Pages that used it pointing at nothing.** Deliberate, argued
  in ADR-0012, but there is no "where is this used?" view.
- **AVIF and SVG upload without dimensions.** They render; just without width and height.
- **No caching anywhere.** Every request reads the database. Deliberate.
- **The Medium and Low audit bands are untouched** — 56 findings. `research.md` has them all
  with a file and a line number, so picking one up costs no investigation.

## What is next

This section used to carry its own numbered ordering, and it drifted — it still listed stock
images as next after they had shipped. It defers now, which is the only way two documents stay
in agreement:

- **[docs/FEATURES.md](./docs/FEATURES.md)** — the inventory. What is built, what is partly
  built, what is planned, and the sixty-three open audit findings.
- **[docs/ROADMAP.md](./docs/ROADMAP.md)** — the milestones and what each is for. M10.5, M11
  and M12 were all written on 5 September. M11 has met its exit criterion and has two small
  things left; M10.5 and M12 are untouched.

The immediate job is at the top of this file: **review and merge `feat/m11-theme-tokens`, or
finish M11 on it**.


## The toolchain, and a diagnosis that was wrong

The 3 September handoff said component tests were blocked on a pnpm store mismatch. They were
not, and the misdiagnosis cost more than the bug would have.

`pnpm install` was always content with the store it had. What failed was `pnpm run`, which
performs a pre-flight dependency check by spawning a nested synchronous `pnpm install`, and
that nested process crashed — first on the no-TTY purge prompt, then on `0xC0000409` after
`--force`. Every script inherited the fault, so a broken dependency tree was the obvious
explanation and the wrong one. Run directly, `vitest` was green the whole time.

The check is off in **`pnpm-workspace.yaml`** — `verifyDepsBeforeRun: false`, with the
reasoning beside it. Note *where*: pnpm 11 no longer reads pnpm settings from `.npmrc`, which
the `allowBuilds` key already sitting in the yaml had been showing all along. With it off,
jsdom and `@testing-library/react` installed in thirteen seconds and
`ERR_PNPM_UNEXPECTED_STORE` never appeared at all.

Two other things that were quietly untrue and are now fixed:

- **`vitest.config.ts` carried dead configuration.** It set `esbuild: { jsx: "automatic" }`
  with a comment explaining why it was required. Vitest 4 uses oxc, printed that it was
  ignoring the option, and infers JSX from the file extension on its own. No `.tsx` test file
  existed to expose it.
- **A NUL byte sat in `packages/core/src/ai/assist.ts`.** `ASSIST_ERROR` is a NUL on purpose —
  it separates streamed content from a message for the Author — but it had been written as a
  raw byte rather than `\u0000`, so git and grep both classified the file as binary. It had
  had no readable diff since it was introduced.

Component tests opt into a DOM per file with a `// @vitest-environment jsdom` docblock, so the
node tests stay fast and there is no new configuration to keep in step.

## Things to know before you touch the code

- Read [CONTEXT.md](./CONTEXT.md) first. It is a glossary and nothing else, and it now defines
  **Enquiry** and the four **Install modes**, both of which are load-bearing.
- The ADRs record what was rejected and why. Nineteen of them now.
- The registry cannot cross the server/client boundary. The database lives behind
  `@mimnets/core/db`; storage and email behind `@mimnets/core/storage` and
  `@mimnets/core/email`, never the root import — they read the filesystem, hold API keys and
  sign with `node:crypto`.
- Server actions are the boundary, not the Editor.
- **An image field holds a key, not a URL.** Blocks build their own URL from
  `context.mediaBaseUrl`. An absolute URL in a layout is what ADR-0012 exists to prevent.
- **A contact form posts to a route handler, not a server action.** It has to work with no
  JavaScript, and a plain `<form method="post">` can only reach a URL. That is also why the
  result message is a query parameter rather than component state.
- **Everything a form sends is attacker-controlled, hidden fields included.** The return path
  is reduced to a path on this Site and the timestamp is signed. Both have tests; read them
  before changing either. The recipient is no longer sent at all — see ADR-0016's sibling
  reasoning in the I-01 commit.
- **Spam checks live in `starter/lib/spam.ts`**, as a list. Adding a CAPTCHA means appending
  one signal, not editing the contact Block.
- **A bundler that cannot read a filesystem path statically traces the whole project into the
  deploy.** `starter/lib/storage.ts` carries a `turbopackIgnore` for exactly this.
- **The Editor reaches the media library through a prop, not an import.** Same reason save and
  publish are props: the admin package cannot import a server action.
- **A Slot the Page does not own is never written by a Page save** (ADR-0017). Shared Slots
  change in Headers & Footers and nowhere else.

## Running it

```bash
# The local npm registry, for the packaging work. Not needed day to day.
docker compose --profile registry up -d registry

docker compose up -d db                        # Postgres, stack name mimnets-multisite
pnpm dev                                       # http://localhost:3000
pnpm seed                                      # three demo Pages, the main Menu, an image, a contact form
pnpm test                                      # the count is the thing to read
AI_LIVE_TESTS=1 pnpm test                      # plus the seven that call a real model
pnpm build:packages                            # dist for the three packages
pnpm release                                   # changeset publish — pnpm, never npm
pnpm typecheck                                 # 7 tasks, strict
pnpm build                                     # must stay warning-free

docker compose --profile storage up -d storage # MinIO on :9000, for the S3 adapter's tests
docker compose --profile mail up -d mail       # Mailpit, SMTP on :1025, inbox on :8025
```

Those last two back the tests that would otherwise be mocks. Both suites skip rather than
fail when their container is absent, so a green suite without Docker means fewer tests rather
than more passing ones — `pnpm test` prints the count, and the count is the thing to read.

One trap: running `pnpm build` while `pnpm dev` is running leaves the dev server serving a
broken shell, because the production build overwrites `.next` underneath it. Stop dev first.

Signed in as `mdmonirulislammonir@gmail.com` (Owner). The Site is installed, so `/install`
redirects away and public sign-up returns 403 — both by design.
