# Handoff — 5 September 2026

Where Mimnets stands, what is not finished, and where to pick up. Read this first; it is
written to be the only thing you need before starting.

The previous handoff was dated 3 September. If you are reading a copy of that one, discard
it: it says component tests are blocked on a pnpm store mismatch, and that diagnosis was
wrong — see the toolchain note below.

## Where to start

**The next session's job: M11's Theme tokens, on `feat/m11-theme-tokens`.** The branch exists
and is pushed, sitting exactly on `main` with nothing on it yet. Everything else below is
context.

Read [docs/ROADMAP.md § M11](./docs/ROADMAP.md), the section headed *"First, the Theme has to
be able to say anything"*. The short version, with the numbers that make it a prerequisite
rather than a nice-to-have:

- A Theme can express **six token families** — colour, font, gutter, measure, radius,
  section-spacing. That is all.
- There is **one radius token, used 26 times**, so every rounded corner on every Site is the
  same value.
- There is **no shadow token at all**. The two `box-shadow` rules in ~1,500 lines of
  `packages/blocks/src/blocks.css` are hard-coded and unthemeable.
- There are **no gradients**.

So every Site is the same flat rectangles in a different palette, and `starter/theme.ts`
claiming *"your Site will not look like everyone else's"* is a claim the tokens cannot back.
M11 promises the same Block looking like three different Sites; it cannot deliver that until
this lands.

### What to build, in order

1. `elevation: { none, low, high }` — and **tint the shadow with the Site's primary** via
   `color-mix()` rather than using grey. This is the highest-value line in the milestone: a
   grey `box-shadow` reads as a 2015 card, and the same shadow carrying the brand colour reads
   as considered. One token, and it changes every card, quote and pricing plan at once.
2. `radius: { none, sm, base, lg, full }` — a scale replacing the single value. Keep `--mn-radius`
   emitting the base so nothing breaks while the 26 uses are moved over.
3. `border: { hairline, base, bold }`.
4. `surface: "flat" | "bordered" | "raised" | "glass"`.

Then the CSS-only looks — glass, mesh gradients built from the Theme's own colours, grain as an
inline SVG data URI, gradient text — none of which need an asset, a dependency or a client
component.

### Three things to know before starting

- **This changes how every existing Site looks.** Work on the branch and look at it rendered
  before merging. `docker compose up -d db && pnpm dev` then <http://localhost:3000>.
- **`defineTheme` derives four readable colours** and an explicitly stated one always wins
  (`packages/core/src/theme/index.ts`). New tokens should follow that shape: derived where a
  sensible value can be computed, overridable where a Site has an opinion.
- **There is no `field.color` and there should not be.** A free hex picker is
  [ADR-0003](./docs/adr/0003-sections-and-columns-not-free-canvas.md)'s mistake in a different
  hat. If a Block needs to offer a choice, it offers Theme tokens.

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

**3. Two colour decisions were deliberately left to you**, with their numbers pinned in
`packages/core/src/theme/derive.test.ts`. `readableOn` picks white on the default accent at
3.27:1 where black would be 5.77:1, and changing it flips button text on every Site whose accent
sits in that range — a design decision rather than a bug fix, which is why it was recorded and
not taken. See A-26 and A-27. **Worth settling as part of M11**, since that milestone is about
what a Theme can express and this is a question about the same tokens.

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

`pnpm test` — **508 passing, 7 skipped, about twenty seconds.** It was 2 failing, 152 passing
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
  and M12 were all written on 5 September and none is started.

The immediate job is at the top of this file: **M11's Theme tokens, on
`feat/m11-theme-tokens`**.


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
- The ADRs record what was rejected and why. Seventeen of them now.
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
pnpm test                                      # 249 in about nine seconds
AI_LIVE_TESTS=1 pnpm test                      # plus the seven that call a real model
pnpm build:packages                            # dist for the three packages
pnpm release                                   # changeset publish — pnpm, never npm
pnpm typecheck                                 # 4 packages, strict
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
