# Handoff — 6 September 2026

Where Mimnets stands, what is not finished, and where to pick up. Read this first; it is
written to be the only thing you need before starting.

**This replaces the second 5 September version at `2232ced`.** That one said the next
session's job was to review and merge `feat/m11-theme-tokens`. The review has happened, it
found five things worth stopping for, all five are fixed, and the branch is pushed — so its
whole "Where to start" is spent. Anything older than this file is safe to discard; if you are
reading a copy dated 3 September, see the toolchain note below for why its central claim was
wrong.

## Where to start

**Publish to npm.** Everything a session can do is done: M11 is merged, its review is merged,
the audit's H-1 is closed, and the milestone's last two features landed on 6 September. What
is left needs a person, and the publish needs one most — `npm login` is interactive, the first
publish claims the `@mimnets` scope permanently, and `sites/ledger` cannot be finished until
it can install a real package rather than one from a disposable local registry.

Read what `pnpm release` prints rather than trusting it. A-28 was `pnpm build:packages`
matching no packages at all and being willing to publish whatever happened to be in `dist`.

Then **A-26 and A-27**, which have now been deferred three times and want a person with an
opinion rather than another session.

`main` is at the merge of `fix/h1-theme-css-injection`. `pnpm typecheck` is 7/7, `pnpm test`
is 609 passing with the Docker suites up, and `turbo build --force` is warning-free on an
uncached build.

The commits below are M11 and everything that followed it. The first four are the milestone;
the nine after them are its review.

| | Commit | What it is |
| --- | --- | --- |
| 1 | `5fbea22` | The prerequisite: four token families a Theme could not say before |
| 2 | `15ba162` | The CSS-only looks: mesh, grain and gradient type, all from the palette |
| 3 | `285dcf0` | The variants: a Block Type declares its looks the way it declares its fields |
| 4 | `2232ced` | The previous handoff |
| 5 | `900f667` | The Dashboard was deleting `theme.texture` on every colour edit |
| 6 | `5a72cbd` | The derived radius scale could fail the schema that validates it |
| 7 | `b6ff6f1` | An unknown Section tone blanked the Page instead of repainting the band |
| 8 | `46273ce` | AI page generation had silently lost the button-colour choice |
| 9 | `a5ccb49` | Tests for the mechanism the milestone is named for, which had none |
| 10 | `3e2f67d` | A flat card on a mesh band was the colour of the band |
| 11 | `44f9f8f` | `padding` gets the fallback `tone` got; `layout` documented as keeping none |
| 12 | `ecec5a3` | Presets and seed stopped minting documents in the legacy shape |
| 13 | `fd31e9d` | The M11 changeset, which had only ever described M8.5 |

**M11's exit criterion is met.** The same testimonial Block looks like three different Sites —
card, quote, minimal — with byte-identical markup and no change to its `render`. Changing six
values in `theme.ts` still rebrands all three, because every rule in all three is written
against tokens.

### What the review found, and the one shape it kept finding

Worth reading before writing the next token family, because it was the same mistake five
times: **a guard that already existed, with one new case not added to it.**

| The guard, already written | The case nobody added |
| --- | --- |
| Three Theme families "carried, not edited" so a save cannot drop them | `texture` — the one the Starter actually sets |
| The `[data-tone="surface"]` card-collision override | `mesh`, which paints itself in the same colour |
| `length` widened to admit bare `0`, for "a round trip nobody runs until a client does" | decimals: halving a 2-dp rem gives a third |
| I-04: a bad Block is dropped, not blanking the Page | a bad **Section** tone, which still blanked it |
| The AI *theme* prompt, updated for `surface` and `texture` | the AI *page* prompt, never updated for variants |

None of them was architectural and none took more than a few lines. The review method that
found them is the one worth repeating: for each existing guard, ask whether the five new
families were added to it.

**The tests were the other half.** Disabling the legacy-variant lift used to fail **one test
out of 565** — four of its six tests asserted the enum default, which is what you get with no
migration at all. Deleting `data-variant` from the renderer entirely failed **nothing**, which
meant the milestone's headline mechanism rested on a line no test read. Both are covered now;
disabling the lift fails seven tests across three files. Every fix on commits 5 to 13 was
either written test-first or verified by reverting it and watching its test go red.

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

### What was left of M11, and is not any more

Both landed on 6 September, on `feat/m11-dividers-and-token`.

- **Section dividers** — an angled or curved bottom edge, a Section property for ADR-0013's
  reason. The shape is on a pseudo-element and never on the Section: `clip-path` there would
  become a containing block for fixed and absolutely positioned descendants and trap the
  gallery lightbox and the mobile nav drawer inside the band. That is the grain overlay's bug,
  avoided this time before it cost anything rather than after.
- **`field.token`** — a Block offers names from the Theme rather than a colour. The eyebrow is
  the first to use it and keeps `accent`, the colour it had hard-coded, so nothing changes on
  any Site.
- **CSS 3D**, which is held back rather than missed. A tilt on hover is a hover affordance and
  a quote is not something a visitor clicks; the tinted elevation already carries the depth it
  was for. It belongs on whatever a variant makes genuinely interactive. The roadmap has the
  argument.

Nineteen Block Types have no variants yet. Adding them is now `defineBlock` work and CSS,
which was the point.

**The shim is now deletable on schedule, and was not before.** `variantWasField` is documented
as removable once every Site has re-saved its Pages — but the three built-in designs and
`pnpm seed` were still writing `props.style` on every button, so every apply and every seed
minted a fresh legacy document for it to rescue. They state `style.variant` now. The shim
itself stays until real Sites have re-saved, and it is tested against the real `buttonBlock`
and `proseBlock` rather than only against stand-ins.

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

This file asked for that before the session started, and it has now paid for itself three
times. Three defects were found by looking and could not have been found any other way:

- **Gradient statistics.** A gradient needs width to be a gradient. Across a box two characters
  wide every glyph lands on the run's midpoint, so 24 / 12 / 0 came out as three identical
  muddy olives — worse than either brand colour. Gradient type is headings only because of it.
- **A stacking context.** Grain was an absolutely-positioned overlay first, which needed a
  `z-index` on `.mn-columns` to keep content above it — and that traps the gallery lightbox
  (`z-index: 50`) and the mobile nav drawer (`z-index: 30`) inside whatever Section they live
  in. An open drawer painted under the Page below it, on every phone. Grain is a background
  layer now and needs no stacking context at all.
- **The Editor does not paint Section tones in its preview.** Found on 6 September, setting a
  band to Mesh and watching the split view not change; it only appears on the published Page.
  Pre-existing and not M11's doing — the Section chrome in the Editor is the Editor's own UI
  rather than a `.mn-section` — but the Editor's whole claim is that the preview is honest,
  and for a Section's tone it is not. Only tone was checked; padding and background are the
  same kind of Section property and worth checking before anyone assumes either way. Worth
  fixing or worth writing down as a limit; it is currently neither.

None of the three was a failing test. All three were a screenshot.

The mesh band is worth looking at once before you touch it. `/test` currently carries one,
with a testimonial on it, published on 6 September to see the band with a card on it. Delete
the Section or restore an earlier version from that Page's History when it stops being
useful — it is a demonstration, not content.

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

**1. Publish, if you want it public.** `npm login` is interactive. Then `pnpm release`;
`pnpm changeset status` reports all three packages bumping minor. Read the notes before you
run it: until 6 September the only changeset described M8.5's eight Block Types, so the status
command reported a ready publish while the release notes said nothing about eleven token
families, variants, or the two `props` fields that no longer exist — which is where
`sites/ledger` takes its upgrade steps from. There is an M11 changeset now. The
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

`pnpm test` — **609 passing, 7 skipped, about a minute.** It was 2 failing, 152 passing
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
- **The Medium and Low audit bands are mostly untouched.** Six of the second audit's were
  closed on 6 September, four of them by earlier sessions that never went back to say so --
  which is the thing to know about that file: verify a finding before acting on it, because
  the code moves and the audit does not. `research.md` has them all
  with a file and a line number, so picking one up costs no investigation.

## What is next

This section used to carry its own numbered ordering, and it drifted — it still listed stock
images as next after they had shipped. It defers now, which is the only way two documents stay
in agreement:

- **[docs/FEATURES.md](./docs/FEATURES.md)** — the inventory. What is built, what is partly
  built, what is planned, and the open audit findings.
- **[docs/ROADMAP.md](./docs/ROADMAP.md)** — the milestones and what each is for. M10.5 gained
  a fourth item on 6 September: a **button row** Block, because two buttons cannot sit side by
  side today and the honest answer — set the Section to two Columns — puts them half a band
  apart. M10.5, M11
  and M12 were all written on 5 September. M11 has met its exit criterion and has two small
  things left; M10.5 and M12 are untouched.

The immediate job is at the top of this file: **publish**, then settle A-26 and A-27. Every
milestone from M0 to M11 is now done and merged.


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
