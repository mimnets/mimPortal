---
spec: project-audit-2
phase: research
created: 2026-09-05
supersedes: none — the 20 August audit's Medium and Low bands remain open and are not restated here
---

# Research: project-audit-2

## Executive Summary

The second audit, covering everything since [the first](../project-audit/research.md) on
20 August: the packaging pipeline, the second Site, the twenty August fixes, and the eight
Block Types written on the morning of 5 September.

**The headline is not what it was in August.** There is no unauthenticated entry point, no
open relay, no data-loss path through Shared Slots. What this audit found instead is a
recurring shape: **decisions that were made correctly, written down correctly, and then not
enforced anywhere.** Five of the six High findings are that shape.

- ADR-0012 says an image field holds a key and never a URL. Nothing checked. A Section's
  background key reached a CSS `url()` in an inline style.
- ADR-0011's threat model says an Author is a client. Six places turned an Author's text into
  an `href` with no protocol check; React 19 was silently doing the work.
- The August fix for I-19 was written in two halves and only one landed. `ASSIST_ERROR` sat
  imported and unused in the route for two weeks.
- The Theme derives four readable colours so nobody has to compute a contrast ratio. Zod
  stripped two of them on every read, so every Site rendered another Site's blue.
- Eight Block Types, two new `core` exports and a new `core` dependency were written with no
  changeset, so `pnpm release` would have bumped nothing.

**Six findings were fixed during the audit** and are recorded below with their commits. All
of them were reproduced before being touched, and each carries a test that fails when the fix
is reverted. **Fifteen remain open.**

`pnpm typecheck` passes 7/7. `pnpm test` is **447 passing, 7 skipped** — it was 249 at the
start of the day and 152 at the August audit.

---

## What was actually run

| Check | Command | Result |
|---|---|---|
| Types | `pnpm typecheck` | **Pass** — 7/7 tasks |
| Tests | `pnpm test` | **Pass** — 447 passed, 7 skipped (454) in ~22s |
| Build | `pnpm build` | **Pass** — 4/4 tasks |
| Changesets | `pnpm changeset status` | All three packages bumping minor |
| Registry prompt | probe against `describeRegistry` | 22 Block Types described, ~1,083 tokens |
| Git | `git status`, `git log`, `git diff 1dac8e7..HEAD` | 202 files, +26,426 since the last audit |

### How this audit was run

Three independent reviewers worked in parallel over separate areas — the new Block library,
the packaging and second Site, and the application and Editor. None of them wrote to the
repository. **Every finding below was then reproduced by hand before being recorded**, and
two were corrected in the process:

- A reported hostname-suffix attack on the video Block used `youtube.com.evil.example`, which
  a naive `endsWith` already rejects. The test now covers the three shortcuts separately.
- A first mutation check appeared to show the gallery's scoping test was worthless. The
  replacement had silently matched nothing; the real mutation does fail it.

Line numbers below are for `feat/block-library`. The Editor findings (A-08 to A-10) carry
different line numbers on `feat/editor-m10`, where those files were rewritten.

### Boundary of this audit — what could NOT be checked

- **No browser.** Every accessibility finding is reasoned from source or from jsdom. The
  focus trap's visibility filter still needs a real browser: jsdom performs no layout, so
  `offsetParent` is stubbed in its test.
- **`sites/ledger` was never installed or run.** It is outside the workspace, its lockfile
  pins a Verdaccio hash (A-14), and CI never touches it (A-17). Everything about it is read
  from source or compared byte-for-byte against `starter/`.
- **No live AI provider.** The seven `AI_LIVE_TESTS` suites were not run.
- **Nothing was published.** The `@mimnets` scope remains unclaimed by choice.
- **The Editor was not driven by hand.** A-08 in particular deserves a click to confirm.

---

## Fixed during this audit

| # | Band | Finding | Commit |
|---|---|---|---|
| A-01 | High | Every image in a Prose Block rendered `alt=""` | `b5fae3c` |
| A-02 | High | Six `href` sites took Author text with no protocol check | `b5fae3c` |
| A-03 | High | I-19 half-landed: the assistant's failure sentinel was never sent | `5b13500` |
| A-04 | High | A storage key reached a CSS `url()` in an inline style | `693c19c` |
| A-05 | High | Every Site painted its Block tones in the default theme's colours | `47341a8` |
| A-06 | Medium | No changeset for eight Block Types and a new `core` dependency | `4f82702` |
| A-11 | Medium | Four writers replaced a draft without moving `revision` | `a0dd088` |
| A-12 | Medium | `listVersions` had no authorisation check | `a0dd088` |
| A-13 | Medium | Thirteen Dashboard error banners were unannounced | *(this commit)* |
| A-17 | Medium | The publish guard checked the publisher, never the artifact | *(this commit)* |
| A-18 | Medium | Every published source map was dangling | *(this commit)* |
| A-19 | Medium | Unfinished config committed as a value | *(this commit)* |
| A-28 | **High** | `pnpm build:packages` built nothing, and `pnpm release` runs it | *(this commit)* |
| A-07 | **High** | `sites/ledger` could not generate a migration, and no Site outside the repo could | `7affd37` |
| A-15 | Medium | The Block library's CSS did not ship with the Block library | *(this commit)* |
| A-20 | Low | The second Site's bespoke Block was unstyled | `7affd37` |
| A-08 | Medium | Clicking a Section selected then instantly deselected it | *(this commit)* |
| A-09 | Medium | `setSectionLayout` left the selection pointing at a Column that had gone | *(this commit)* |

### A-01 — Markdown images were announced as decorative

`packages/core/src/render/markdown.tsx`. markdown-it emits `alt` as an empty attribute and
fills it from the token's `children` inside its own renderer. The walker copied attributes and
ignored children, so `![A cat asleep on a roof](cat.png)` rendered `alt=""` — and because an
image token has `nesting === 0`, the text was not recovered as visible content either. It was
simply gone.

A silent WCAG 1.1.1 failure on a page that looks entirely correct, in code written the same
morning, whose test file had no image case at all.

### A-02 — Author text reached an `href` unchecked

Six sites: `design.tsx:233` (call to action) and `:284` (pricing plan), both plain text
fields; `design.tsx:563` (carousel) and `:924` (comparison table), both link fields;
`index.tsx:195` (menu). Two were written that morning; four predate it.

This was not already causing incidents because **React 19 neutralises `javascript:` hrefs by
itself**. That is not a defence: it covers exactly one scheme, leaving `vbscript:` and
`data:text/html` through, and it is a framework implementation detail rather than a promise.
`safeHref` in core is now the boundary — http, https, mailto, tel or a relative path.

### A-03 — The assistant's failure sentinel was never emitted

`starter/app/api/ai/route.ts:98`, and the identical file in `sites/ledger`. The August repair
for I-19 was made in two halves. `packages/admin/src/Assist.tsx:102` got the reading half and
describes the bug in the past tense; the route got the import and nothing else, still
enqueuing `` `\n\n[${reason}]` `` as ordinary stream text. `ASSIST_ERROR` sat imported and
unused, which is the shape of the whole bug: every piece present, none connected.

An Author on the default free-model chain pressing Rewrite while OpenRouter is rate limiting
got `[Every provider failed. OpenRouter (free · …) (rate limited); …]` as their heading —
publishable, carrying upstream error text to the public Site.

Fixed with the repo's first route-handler test.

### A-04 — A storage key reached a CSS `url()`

`packages/core/src/layout/schema.ts:137` (Section background) and
`packages/core/src/blocks/fields.ts:70` (`imageSchema`), both `z.string()` with no constraint,
interpolated at `packages/core/src/render/render.tsx:88`.

React escapes the attribute, but the browser un-escapes it before the CSS parser reads it, so
escaping is not what saves you. **The ceiling is lower than it first appears and higher than
it should be.** An inline style is a declaration list with no selectors and no at-rules, so
there is no path to script and neither classic CSS exfiltration technique works — no
`@import`, and no `input[value^="a"]{background:url(…)}` to leak a field a character at a
time. What does work:

- `position: fixed; inset: 0; z-index: 2147483647` on one Section covers the entire page,
  Header included — defacement, and a clickjacking surface where the attacking Section's own
  Blocks sit on top of the real page.
- A `background-image` on another origin is a request every visitor makes, leaking IP and
  User-Agent. A poor property to lose silently for a product that sells "the map sets no
  third-party cookies".

Fixed in the schema rather than at the interpolation: the same key reaches seven `img src`
interpolations that escaping `render.tsx` would have left untouched, and parse-time failure
reaches the Author through `safeParseLayout`'s existing drop-and-report path. The rule was not
invented — `assertSafeKey` has always applied exactly it, and the predicate is now shared.

### A-05 — Every Site rendered another Site's colours

`packages/core/src/theme/index.ts`. `themeSchema` does not carry `primaryText` or `accentText`
— correctly, since they are derived and never asked for — so Zod strips them from a stored
Theme on the way out of the database, and `defineTheme` filled the gap from `defaultTheme`.
The Starter stored jade `#0b6b62` and rendered `#2f5ad6`, beside a settings panel promising
that nothing there could be off-brand.

The existing guard could not see it: `starter/lib/starter-theme.test.ts:33` asserts through
`completeTheme`, which derives correctly and is not on the render path.

Fixed in `defineTheme` so all four call sites are covered at once —
`starter/theme.ts`, `starter/lib/theme.ts` and both of ledger's — rather than at the four that
happen to exist today.

---

## Open — High

### A-07 — `sites/ledger` cannot generate a migration, and no Site outside the monorepo can

`sites/ledger/drizzle.config.ts:10`

```ts
schema: ["../packages/core/src/db/schema.ts", "../packages/core/src/db/auth-schema.ts"],
```

Copied verbatim from `starter/`, where `../packages` is correct. From `sites/ledger/` it
resolves to `sites/packages/core/…`, which does not exist. A reviewer verified this
empirically against drizzle-kit 0.31.10: `No schema files found for path config`.

It fails loudly rather than emitting a DROP-everything migration, so there is no data risk.
The structural problem is worse than the typo: `files: ["dist"]` means **no published package
ever ships `schema.ts`**, so no Site outside this monorepo can regenerate migrations at all.
`db:migrate` is unaffected — it reads `./drizzle/*.sql` — and the nine committed migrations
are byte-identical to starter's and consistent with the schema.

Needs a decision, not just an edit: whether drizzle-kit can read a compiled `.js` schema, or
whether the packages must ship `schema.ts`.

---

### A-28 — `pnpm build:packages` silently built nothing

*Found while fixing A-17, not by any reviewer.*

`package.json` declared `turbo run build --filter='@mimnets/*'`. The single quotes reached
turbo as part of the filter string, so it matched no package and exited successfully:

```
WARNING  No tasks were executed as part of this run.
Tasks:    0 successful, 0 total
```

`pnpm release` is `pnpm build:packages && changeset publish`. A release would therefore have
built nothing and published whatever happened to be sitting in `dist` — or, with `dist`
absent, a package containing only `package.json`. That is precisely the failure A-17's guard
was written for, and the two were found within minutes of each other: the guard caught a
missing `dist` on the first run.

Double quotes survive. Verified by deleting `packages/blocks/dist` and watching the script
restore all three packages.

---

## Open — Medium

### A-08 — Clicking a Section selects it and then immediately deselects it *(fixed, confirmed in a browser)*

`packages/admin/src/Preview.tsx:226-228` dispatches `select` for the Section and takes no
event argument, so it never calls `stopPropagation()`. The click bubbles to the preview root
at `:312`, which dispatches `selection: null`. Both apply in order; the net selection is
`null`.

`BlockCard` (`:105`) and the toolbar buttons all stop propagation. The Section body does not.

An Author clicking a Section's padding to change its tone or background gets an empty panel.
Section settings are reachable only via Add Section or Duplicate, which set the selection
inside the reducer.

**Confirmed in a browser, which it needed.** Clicking a Section left the panel reading
"Nothing selected"; clicking a Block in the same Section selected it correctly, which is what
rules out the panel simply being broken. Fixed by stopping propagation on the Section, and
confirmed the same way afterwards — the panel now reads "Section" from both the Section's
padding and its toolbar.

Two things that cost time and are worth writing down. The dev server on :3000 had been serving
JavaScript hours stale, because `pnpm build` had been run repeatedly while it was up — the
trap HANDOFF.md documents, which silently makes every code change appear to have no effect.
Its CSS updated while its JS did not, which is a convincing disguise. And clicking an element
by accessibility reference clicks its centre, which for a Section is a Block card; only a real
coordinate in the Section's own padding exercised the handler.

### A-09 — `setSectionLayout` is the one structural action that skips `followSelection`

`packages/admin/src/state.ts:338` returns `selection: state.selection` while `:327-333`
deletes Columns and merges their Blocks into the last survivor. Every other structural case
calls `followSelection` (`:228`, `:253`, `:283`, `:296`).

Going 3 columns → 1 with a Block selected in column 2 leaves the path pointing at
`{column: 2}` when the Block now lives at `{column: 0}`; `blockAt` returns undefined and the
panel says "That Block is no longer here" while the Block is on screen.

**Correction, on my own reporting.** This finding originally claimed a worse second case —
3 → 2 with the selection in column 1, where the stale path stays valid and addresses a
*different* Block. That is not reachable, and it was written down without being run. Merging
*appends* the removed Columns' Blocks onto the survivor, so a surviving Column keeps its own
Blocks at their original indices: 3 → 2 leaves `[a]` and `[b, c]`, and `{column: 1, block: 0}`
is still `b`. Only a path into a Column that has *gone* breaks, and it breaks loudly. The
invariant is now asserted so the claim cannot be made again without a test disagreeing.

`state.test.ts` tests this action's Block counts and never its selection.

### A-10 — Save clears `dirty` for edits made during the save

`packages/admin/src/Editor.tsx` — `run()` dispatches `{type:"saved"}` unconditionally on
success, while `onSave` captured the layout at click time.

An Author clicks Save, keeps typing, the request resolves: `dirty` goes false, the status
reads "All changes saved", Save disables, and the `beforeunload` guard unregisters. Closing
the tab loses those edits with no prompt, immediately after being told they were saved.

### A-11 — Four writers of `draftLayout` bypass the revision guard

`atRevision` and the `revision` bump exist only in `saveDraft`
(`starter/app/admin/actions.ts:198`). These write `pages.draftLayout` with a plain
`eq(pages.id, …)` and leave `revision` untouched:

- `starter/app/admin/actions.ts:276` — `restoreVersion`
- `starter/app/admin/actions.ts:324` — `copyPageStructure`
- `starter/app/admin/slot-actions.ts:210` — `setPageSlots`
- `starter/app/admin/preset-actions.ts:160`, `:245` — `applyPreset`, `generatePageLayout`

An Author has a Page open at revision 7; an Owner restores an old version elsewhere; the draft
is replaced but `revision` is still 7. The Author presses Save, `atRevision(X, 7)` matches, and
the restore is destroyed with no `STALE` message in either tab.

`applySlotsToAllPages` documents the correct reasoning for its own case
(`slot-actions.ts:241-243`: the layout document is untouched, so `revision` is left alone) —
these four do not have that excuse.

### A-12 — `listVersions` has no authorisation check

`starter/app/admin/actions.ts:122` — the only export in the file with neither `requireUser()`
nor `requireOwner()`. It queries straight into `pageVersions`.

Impact is genuinely limited: version ids and publish timestamps, and it needs a Page UUID.
The gap is the point — every sibling in the file checks.

### A-13 — I-15 half done: thirteen Dashboard error banners are still unannounced *(fixed — the count was wrong)*

Editor status became a live region; these are unchanged plain `<p>` with no `role` and no
`aria-live`:

- `starter/app/admin/PageList.tsx:39`
- `starter/app/admin/menus/MenuEditor.tsx:71`
- `starter/app/admin/design/DesignStudio.tsx:152`
- `starter/app/admin/media/MediaLibrary.tsx:81`
- `starter/app/admin/pages/[id]/settings/PageSettings.tsx:93`
- `packages/admin/src/History.tsx:43`

A screen-reader user who fails a save on any of those screens is told nothing.

**The reviewer's list of six was not exhaustive.** Fixing it turned up seven more of exactly
the same shape: `design/ReadyMade.tsx`, `design/ThemeEditor.tsx`, `sign-in/SignInForm.tsx`,
`slots/SlotList.tsx`, `install/InstallForm.tsx` (twice) and `packages/admin/src/media.tsx`.
Thirteen in total, all now `role="alert"` with `aria-atomic` — announced on insertion, which
is what somebody who has just pressed a button and is waiting needs.

Deliberately *not* changed: the unconditional notices at `design/DesignStudio.tsx:61` and
`enquiries/EnquiryList.tsx:68` and `:96`. Those are configuration messages that are part of
the page rather than failures of an action, and `role="alert"` on them would interrupt on
page load. They are read in document order, which is correct.

### A-14 — Ledger's lockfile pins a hash only the throwaway registry can satisfy

`sites/ledger/pnpm-lock.yaml:828` pins an integrity hash computed from the tarball in the
Verdaccio volume, which `docker-compose.yml:88` explicitly calls disposable. With
`sites/ledger/.npmrc` pointing at `localhost:4873`, nobody but this machine can install the
second Site, and republishing to a fresh registry produces a different tarball.

### A-15 — The Block library's CSS does not ship with the Block library

`starter/app/globals.css` gained **609 lines** for the eight new Block Types — accordion,
gallery, carousel, map, video, prose, comparison table, social links — and none of it lives in
`@mimnets/blocks`.

When `sites/ledger` upgrades it receives the components and no styles, and must hand-copy 609
lines. `@mimnets/admin` already ships `dist/editor.css` through a subpath export, so the
mechanism exists and is simply not used for Blocks. This undermines exactly what M8 set out to
prove: that a Site extends the product without forking it.

Note this is not only the new CSS — the pre-existing Block styles have the same problem, so
fixing it for eight Blocks and not the other fourteen would split the concern rather than
close it.

### A-16 — CI never installs, builds, typechecks or tests `sites/ledger`

`vitest.config.ts:12` includes only `packages/**` and `starter/**`; CI's
`pnpm install --frozen-lockfile` runs at the root, which never installs the second Site.
Ledger has zero test files. CI could not have caught A-07 and will not catch the next
divergence.

### A-17 — `prepublishOnly` asserts the package manager, never the artifact

`packages/*/package.json`. The guard refuses `npm` in favour of `pnpm`, which is correct and
well argued. Nothing checks that `dist` exists or is fresh. A direct `pnpm publish` with a
stale or absent `dist` passes the guard and ships a package containing only `package.json`.

### A-18 — Every published source map is dangling

`packages/*/tsconfig.build.json:14-15` sets `declarationMap` and `sourceMap` with
`files: ["dist"]`. Verified: `sites/ledger/node_modules/@mimnets/core/dist/index.js.map` has
`"sources":["../src/index.ts"]`, and `…/@mimnets/core/src` does not exist. The comment at
`tsconfig.build.json:5-7` claiming consumers "land in the original source" is false, and
roughly half of the 761 KB `dist` is dead map data.

### A-19 — Unfinished config committed as a value

`sites/ledger/pnpm-workspace.yaml:12` reads `esbuild: set this to true or false` — literal
instruction text where the root has `esbuild: true`. `pnpm list` exits 0 and the binaries
exist, so it is not currently breaking anything; it is unfinished text in the file defining
the Site's build policy.

---

## Open — Low

| # | Finding |
|---|---|
| A-20 | `sites/ledger/blocks/deadlines.tsx:33` renders `className="ledger-deadlines"`; nothing in ledger's CSS matches. The Site's one bespoke Block is unstyled — a raw `<table>` with no overflow container. The code itself is clean |
| A-21 | Only 5 of 22 Block Types have an icon in the Editor picker (`packages/admin/src/icons.tsx:137-143`); the other 17 fall back to the same generic square |
| A-22 | `Dockerfile` and `docker-compose.yml` build and run only `starter`. No container path for ledger, though its `next.config.ts:16` correctly sets `outputFileTracingRoot` |
| A-23 | Published tarballs carry `prepublishOnly` and `build` scripts, and `@mimnets/admin`'s declares `devDependencies: {"@mimnets/blocks": "0.1.1"}` from pnpm's `workspace:*` conversion — a dependency on a version that may not exist on the target registry. Harmless: devDependencies are not installed by consumers |
| A-24 | `sites/ledger/pnpm-workspace.yaml:22` sets `minimumReleaseAge: 0`, disabling pnpm's supply-chain delay. Documented and correct for a local-registry exercise; nothing enforces restoring it on a public registry |
| A-25 | `packages/*/package.json` has no top-level `main`/`types` fallback and no `sideEffects`. Fine for modern bundlers; breaks older resolvers and costs tree-shaking |
| A-26 | `readableOn` picks black or white by a luminance threshold of 0.55. On the default accent `#f0568c` that selects white at 3.27:1 where black is 5.77:1 — the less readable of the only two options, on the colours the product ships with. **Deliberately not fixed:** on the default blue the margin is 4.70 against 4.47, so changing it flips button text to black on every Site whose accent sits in that range. That is a design decision about brand buttons, not a bug fix. The numbers are pinned in `packages/core/src/theme/derive.test.ts` |
| A-27 | Deriving the Theme's readable colours uniformly (A-05) changed `defineTheme()` with no colours from `#2f5ad6` to `#3b6cf6` — 4.51:1 against 5.91:1. Both clear AA; the hand-picked value was more comfortable. Uniform derivation was preferred to a special case for one Theme |

---

## Verified clean

Recorded because a "no finding" that was actually checked is worth as much as a finding, and
because the next audit should not spend the time again.

**`sites/ledger` was forked after every security fix and is missing none.** It was added in
`6b8018b`; the six fixes — open mail relay, installer failing open, reply-to header injection,
`/media` serving the whole bucket, the unchecked Theme, form timing and signature — all landed
in ancestors of it. All 98 tracked ledger files were byte-compared against `starter/`: every
`lib/*.ts`, every `app/**` route, and all nine migrations are **byte-identical**. Only five
files differ, all deliberately: `package.json`, `next.config.ts`, `tsconfig.json`,
`blocks.config.ts`, `theme.ts`, `globals.css`. The guards in ledger's copies were spot-read to
confirm they are the fixed versions rather than coincidentally identical stale ones.

**No secrets are committed.** `git ls-files | grep -iE '(^|/)\.env'` returns only the two
`.env.example` files, both placeholders.

**No XSS in the new Block library.** Twenty-five crafted Markdown inputs plus direct React
probes. Specifically:

- **The video Block's allowlist is not actually the security boundary** — the `src` is *rebuilt*
  as a hardcoded `https://www.youtube-nocookie.com/embed/` plus an id constrained to
  `/^[\w-]{6,}$/`, so no attacker-controlled host can reach the iframe at all.
  `youtube.com@evil.com`, `evil.com@youtube.com`, uppercase, ports, trailing dots, IDN and
  punycode, and `%2e%2e%2f` traversal were each confirmed to fail closed.
- **`socialHref` holds.** `javascript:x@y.z` does pass the email regex, but it is prefixed to
  `mailto:javascript:x@y.z` and is inert.
- **The token walker cannot desynchronise** on a balanced stream; the depth counter is correct,
  and an unbalanced stream only drops one trailing token.
- **markdown-it's `validateLink` runs at parse time in the correct decode-then-validate order.**
  `[a](&#106;avascript:…)` and `[a](java&Tab;script:…)` are both neutralised.
- **Block props really are schema-validated before render**, including the lenient salvage
  path, so `latitude` is genuinely a number and the Google Maps interpolation cannot be
  injected.
- There is **no `dangerouslySetInnerHTML` and no `srcDoc` anywhere in the repository.**

**The Preset guarantee still holds at 22 Block Types.** `describeRegistry` describes all of
them in ~1,083 tokens, so a model still cannot invent a Block Type that does not exist. Both
Sites spread `standardBlocks`, so neither needs editing to pick up a new Block.

**The nested repeater works.** The comparison table is the first repeater inside a repeater;
the Editor's blank item is `{label: "", values: []}` and the Block renders it rather than
throwing. Now asserted, because it rests on one `.default([])` deep in the field builder.

---

## What the next session should do first

1. **A-08** deserves a browser before anything else — it is the finding most likely to be
   wrong in a way source reading cannot settle, and if it is right, Section settings are
   unreachable by clicking.
2. **A-09** is a correctness bug of the class I-17 was supposed to close. It belongs on
   `feat/editor-m10` with the rest of the Editor work.
3. **A-15** is the one that undermines M8's own claim, and it wants a decision about all
   twenty-two Blocks rather than a patch for eight.
4. The August Medium and Low bands — 56 findings — remain open and pre-diagnosed in
   [the first audit](../project-audit/research.md).
