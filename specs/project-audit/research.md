---
spec: project-audit
phase: research
created: 2026-08-20
---

# Research: project-audit

## Executive Summary

Mimnets is architecturally sound — the layout schema, the provider chain, the pooling fix and
the SigV4 signer are all real and well tested. The damage is concentrated at the **seams**:
three unauthenticated or under-validated HTTP entry points, one silent data-loss path through
Shared Slots, no error boundaries anywhere, and no keyboard route through the Editor. The docs
have also drifted seven commits behind the code. `pnpm typecheck` passes; **`pnpm test` fails**.

---

## What was actually run

| Check | Command | Result |
|---|---|---|
| Types | `pnpm typecheck` | **Pass** — 4/4 packages, 3 replayed from Turbo cache |
| Tests | `pnpm test` (`vitest run`) | **FAIL** — 2 failed, 152 passed, 12 skipped (166), 352s |
| Audit | `pnpm audit` | 1 moderate, 0 high, 0 critical, 347 deps |
| Git | `git status`, `git log` | 2 modified files, `specs/` untracked |

The two failures are `starter/lib/permissions.test.ts` — the Slot-locking boundary — failing on
`connect ECONNREFUSED ::1:5432`. Docker was not running.

### Boundary of this audit — what could NOT be checked

- **No running database.** Docker Desktop was not up. Every DB-backed assertion is read from
  source, not observed.
- **No signed-in session.** The two clauses HANDOFF.md is waiting on (Media → Upload, the
  Enquiries screen) remain unverified here too.
- **No browser.** Every accessibility and React finding is reasoned from source. Contrast
  ratios were computed from the Theme tokens, not measured on a rendered page.
- **`pnpm build` was not run** — it overwrites `.next` and would disturb the working tree.
- **Not run:** dev server, migrations, MinIO, Mailpit, any live AI provider.
- 12 tests and 1 whole file skipped for exactly these reasons — see issue **I-08**.

### Dependency versions — the three flagged as odd are all real

| Package | Declared | Installed | Latest (20 Aug 2026) | Verdict |
|---|---|---|---|---|
| typescript | `^7.0.2` | 7.0.2 | 7.0.2 | Real and current — the native Go port. Ships CLI only; **no programmatic API until 7.1** |
| vitest | `^4.1.10` | 4.1.10 | 4.1.11 | Real, current major |
| turbo | `^2.10.10` | 2.10.10 | 2.10.11 | Real, Turborepo is still 2.x |
| next | `^16.3.1` | 16.3.1 | 16.3.1 | Exactly current |
| react / react-dom | `^19.2.8` | 19.2.8 | 19.2.8 | Current |
| drizzle-orm / -kit | `^0.45.2` / `^0.31.10` | same | same | Current, pre-1.0 |
| better-auth | `^1.6.29` | 1.6.29 | **1.7.1** | See **I-26** |
| @anthropic-ai/sdk | `^0.117.1` | 0.117.1 | **0.120.0** | See **I-61** |

Nothing is fabricated and nothing is far behind. TypeScript 7 works here only because Next 16
defaults `useTypeScriptCli: true` and shells out to `tsc`; adding ESLint or a typed test
transform would break immediately, since those need the compiler API that 7.0 does not ship.

---

# Issues

Ranked most severe first. **V** = verified by reading or running. **S** = suspected.

## Top ten

| # | Issue | Where | Sev |
|---|---|---|---|
| I-01 | Contact form is an open mail relay | `starter/app/api/forms/route.ts:87` | High |
| I-02 | Installer fails open; unauthenticated `.env` rewrite | `starter/lib/install.ts:34` | High |
| I-03 | Saving a Page destroys its own Header; Authors locked out | `starter/app/admin/actions.ts:126` | High |
| I-04 | One bad Block blanks the whole Page — and Publish bakes it in | `packages/core/src/blocks/registry.ts:73` | High |
| I-05 | No error boundaries anywhere | `starter/app/**`, `packages/admin/**` | High |
| I-06 | Clicking a Block in the Editor navigates away, losing the draft | `packages/admin/src/Preview.tsx:68` | High |
| I-07 | `replyTo` is unvalidated visitor input | `starter/app/api/forms/route.ts:95` | High |
| I-08 | `pnpm test` fails; the suites that matter most skip | `starter/lib/permissions.test.ts:20` | High |
| I-09 | No keyboard route through the Editor, and handles that lie | `packages/admin/src/Editor.tsx:107` | High |
| I-10 | Zero coverage of Draft/Published transitions | `starter/app/admin/actions.ts` | High |

## High

**I-01 — The contact form sends to any address the visitor names. (V)**
`packages/blocks/src/index.tsx:222` renders `<input type="hidden" name="recipient">`;
`starter/app/api/forms/route.ts:87` reads it back — `const recipient = text("recipient") || defaultRecipient();`
— and `:92` passes it to `email().send({ to: recipient })`. Anyone can POST an arbitrary
`recipient`, `name` and `message` and have the Site deliver attacker-authored mail from its own
verified domain. Same class as the `mn_return` open redirect already fixed at `:40`, and
HANDOFF.md:186 already states the rule ("hidden fields included") that this violates. Resolve
the recipient server-side from the Block config by `slug`. *Independently found by three
separate audits.*

**I-02 — The installer's guard fails open, and the action behind it is unauthenticated. (V)**
`starter/lib/install.ts:30-34` catches every error and returns `"provisioning"` — including an
unreachable database. `starter/app/install/actions.ts:20-24` only throws when the mode is
`"installed"`. So during any Postgres outage, `provisionDatabase` (`:31`, no session, no role,
no token) accepts an attacker's connection string, runs migrations on it, and rewrites the
Site's `.env` at `:61` — repointing the Site permanently on next restart. The comment at `:17`
claims "a redeploy cannot resurrect the installer"; a DB outage can. `:44` also returns the raw
connection error, making it an outbound port-scan oracle. Same fail-open predicate re-opens
public sign-up at `starter/app/api/auth/[...all]/route.ts:18`.

**I-03 — Saving a Page silently overwrites its own Header with a copy of the shared one. (V)**
`starter/app/admin/pages/[id]/page.tsx:37` hands the Editor the *resolved* layout; the Editor
posts the whole document back (`packages/admin/src/Editor.tsx:181`). `lockedSlotsFor` is
role-only (`starter/lib/session.ts:51-53`) and never consults `page.headerSlotId`, so:
- **Owner** → `locked = []`, the comparison in `guardedLayout` (`actions.ts:129-136`) is skipped
  entirely, and `saveDraft` writes the resolved document. The Page's own Header sections are
  destroyed. This directly contradicts `starter/lib/slots.ts:15-17` ("stay in its document
  untouched"), and poisons the detach path at `slot-actions.ts:192`.
- **Author** → `locked = ["header","footer"]`, resolved ≠ stored, so every save throws
  *"The header is locked."* An Author cannot save **any** Page using a Shared Slot.

**I-04 — A single invalid Block blanks the entire Page. (V)**
`packages/core/src/blocks/registry.ts:73-78` — `safeParseLayout` returns `emptyLayout()` on any
error. On the public path (`starter/app/[[...path]]/page.tsx:99`) that is HTTP 200 with an empty
`<main>`, not a 404. Worse, `starter/app/admin/pages/[id]/page.tsx:33` opens the Editor on the
same blank, the returned error string is discarded, and `Editor.tsx:200` leaves Publish enabled
regardless of `dirty` — so one click writes `emptyLayout()` over draft *and* published and
snapshots the blank. HANDOFF.md:124 describes this as "an empty Page with an error"; there is no
error. `starter/lib/slots.ts:82-87` shows the correct pattern (log, degrade, keep going).

**I-05 — There are no error boundaries in the repository. (V)**
No `error.tsx`, `global-error.tsx` or `not-found.tsx` under `starter/app/**`; no
`componentDidCatch`/`ErrorBoundary` anywhere. A Block whose `render` throws at
`packages/admin/src/Preview.tsx:102` unmounts the whole Editor — and since `state.layout` lives
only in a `useReducer` (`Editor.tsx:99`) with no autosave, the draft is gone. `render` runs on
partially-typed props on every keystroke, so this is a live risk, not a theoretical one. On the
public Site the same throw yields Next's blank application-error page. The *data* layer is well
defended; the *render* layer is not defended at all.

**I-06 — Clicking a Block to select it can navigate the Editor away. (V)**
`packages/admin/src/Preview.tsx:68-71` calls `event.stopPropagation()` but never
`preventDefault()`, and rendered Blocks emit real anchors (`blocks/src/index.tsx:145`,
`design.tsx:47`, `:233`). Clicking a Menu Block navigates to `/about`. There is no
`beforeunload` guard anywhere in the repo, so the unsaved draft is discarded silently.

**I-07 — `replyTo` is visitor input, never validated. (V for the gap, S for the impact)**
`starter/app/api/forms/route.ts:68` reads the sender's email through a helper that only
`.trim()`s (`:36`), and `:95` sets `replyTo: senderEmail`. `looksLikeEmail`
(`packages/core/src/email/adapter.ts:53`) *would* reject CRLF but is applied only to `to`.
Interior `\r\n` survives. Whether that becomes real header injection depends on nodemailer and
Resend hardening — **suspected, not confirmed** — but the code contributes no defence of its own.

**I-08 — `pnpm test` fails, and the suites that matter most skip silently. (V — ran it)**
`starter/lib/permissions.test.ts:19-20` gates on `DATABASE_URL` being *set*, not reachable.
`starter/.env` sets it, so the suite runs and hard-fails without Postgres — contradicting
HANDOFF.md:212-215 ("skip rather than fail when their container is not running"). Meanwhile the
three suites that test what unit tests cannot all `describe.skip` by default: SigV4 against
MinIO (`s3.test.ts:24-30`), SMTP against Mailpit (`email.test.ts:20-24`), and live free-model
IDs (`openrouter.test.ts:18-19` — whose own comment says "a mock would pass forever while the
Site's defaults rotted"). **There is no CI at all** (no `.github/`), so nothing catches any of
this. Test count is now 166, not the 108 HANDOFF claims.

**I-09 — The Editor cannot be operated from a keyboard, and says otherwise. (V)**
`packages/admin/src/Editor.tsx:107` registers `PointerSensor` only; `KeyboardSensor` appears
nowhere. `moveBlock`/`moveSection` are dispatched exclusively from `handleDragEnd`
(`:119,131,138`), and no panel offers move controls. A keyboard-only Author can add and delete
Blocks but can never reorder one. Worse, `packages/admin/src/Preview.tsx:74-83` spreads dnd-kit's
`{...attributes}` onto the handle, which announces *"To pick up a sortable item, press the space
bar…"* — instructions for a sensor that is not registered.

**I-10 — Not one test covers a Draft/Published transition. (V)**
No test file imports `actions.ts`, `slot-actions.ts` or `preset-actions.ts`. Untested: publish
(including the codebase's only transaction, `actions.ts:161`), save draft, restore, copy
structure, apply Preset, and every Shared Slot mutation. No test touches `render.tsx`, `slots.ts`,
`site.ts`, the sitemap, or either route handler — which is precisely where I-01, I-03, I-04 and
I-07 live.

**I-11 — Publish takes the client's layout, not the stored draft; no concurrency control. (V)**
`starter/app/admin/actions.ts:155,164`. Combined with Publish not being gated on `dirty`, a stale
tab overwrites both draft and published. `db/schema.ts` has no version or `updatedAt` guard
column — concurrent editors are last-write-wins with no signal.

**I-12 — Alt text is optional, and its absence renders as decorative. (V)**
`packages/core/src/blocks/fields.ts:71` — `alt: z.string().default("")`, rendered raw at
`packages/blocks/src/index.tsx:73`. The Editor only advises (`FieldInput.tsx:303`). A whole page
of undescribed photographs passes every check. Same shape in `logosBlock` (`design.tsx:200`).

**I-13 — No skip link, and the Header/Footer are not landmarks. (V)**
`starter/app/[[...path]]/page.tsx:110-119` has no skip target; `packages/core/src/render/render.tsx:128`
renders every Slot as `<div className="mn-slot">`, so there is no `banner` or `contentinfo`. With a
long Shared Header, every visitor tabs the whole Menu on every Page.

**I-14 — The "Accent colour" Block tone fails WCAG AA. (V — computed from tokens)**
`starter/app/globals.css:789` sets `color: var(--mn-color-accent)`; `starter/theme.ts:38,27` give
`#e05a26` on `#ffffff` ≈ **3.7:1**, under the 4.5:1 body-text threshold. The Editor offers it while
telling the Author "nothing here can be off-brand" (`SettingsPanel.tsx:92-94`). `readableOn`
(`theme/index.ts:171`) exists but is only applied to `onPrimary`/`onAccent`. A primary-toned Block
inside a primary-toned Section is worse still — `globals.css:788` vs `:357` paints the same colour
on itself, rendering text invisible.

**I-15 — Save and publish status is never announced. (V)**
`packages/admin/src/Editor.tsx:171-173` renders status in a bare `<span>` — no `aria-live`, no
`role="status"`. Every Dashboard error banner is a plain `<p>` (`PageList.tsx:39`,
`MenuEditor.tsx:48`, `DesignStudio.tsx:152`, `MediaLibrary.tsx:81`, `History.tsx:43`,
`PageSettings.tsx:93`). A screen-reader user gets no feedback that a save succeeded or failed.

**I-16 — The media picker claims `aria-modal` but never traps focus. (V)**
`packages/admin/src/media.tsx:110`. Escape is handled (`:80-86`), but focus is never moved in,
never trapped, and never restored — so Tab walks into an Editor that `aria-modal="true"` has told
the screen reader is not there.

**I-17 — Selection is a positional path, so deleting a sibling retargets the settings panel. (V)**
`packages/admin/src/state.ts:187-194` clears the selection only when the deleted Block *is* the
selected one. Delete index 0 while index 1 is selected and `selection.path.block` still reads `1`
— now addressing what was index 2. `SettingsPanel.tsx:45` resolves by path, so the Author edits a
Block they did not select. Same class of bug for a drag past the selection.

**I-18 — Assist streams into a stale path. (V)**
`packages/admin/src/Assist.tsx:48-103` captures `onChange` — which closes over `selection.path`
(`SettingsPanel.tsx:67`) — and there is no `useEffect` cleanup aborting the in-flight request.
Selecting a different Block mid-stream keeps writing AI text to the *previous* path.

**I-19 — Total AI failure is written into the Author's field as content. (V)**
`starter/app/api/ai/route.ts:98` enqueues `\n\n[${reason}]` into an already-200 body;
`packages/admin/src/Assist.tsx:86` commits it with `onChange(text)`. The `catch` at `:95` never
fires and `text.trim() === ""` is false, so `before.current` is never restored. The Author's
heading becomes `[Every provider failed. OpenRouter (free · …) (rate limited); …]` — which they
can then publish. The reason string also carries up to 300 bytes of raw upstream body
(`openai-compatible.ts:75`) and names every provider and model (`provider.ts:67`).

**I-20 — No timeout anywhere in the AI stack. (V)**
No `AbortSignal.timeout` or client timeout in `packages/core/src/ai/*`, `starter/lib/ai.ts`, or
`starter/app/api/ai/route.ts`. `GenerateOptions.signal` exists (`preset.ts:177`) but no caller
passes one (`preset-actions.ts:84,213,278`). A hung upstream hangs the request indefinitely —
including the visitor's form POST, since `resend.ts:24` has no signal either.

## Medium

| # | Issue | Evidence | V/S |
|---|---|---|---|
| I-21 | `listVersions` is the one server action with no auth check | `starter/app/admin/actions.ts:115` | V |
| I-22 | Only one transaction exists; installer, Preset apply and Slot delete are unwrapped multi-writes | `actions.ts:161` is the sole `transaction(`; cf. `install/actions.ts:97-113`, `preset-actions.ts:132-163`, `slot-actions.ts:154-156` | V |
| I-23 | Migrations are never copied into the Docker image, so provisioning mode cannot work in a container | `Dockerfile:24-26` vs `install/actions.ts:42` (`join(process.cwd(), "drizzle")`) | V |
| I-24 | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` unset — required for self-hosted multi-instance | absent repo-wide; required per installed Next 16.3.1 docs | V |
| I-25 | Server-action body limit is 1 MB by default, so the 8 MB upload cap is unreachable | `storage/adapter.ts:35` vs no `bodySizeLimit` in `starter/next.config.ts` | V |
| I-26 | `better-auth: "^1.6.29"` permits 1.7.x, which shipped breaking changes in a minor | `starter/package.json:21`, `packages/core/package.json:24` | V |
| I-27 | `X-Forwarded-For` trusted unconditionally, defeating the rate limit off-proxy | `starter/app/api/forms/route.ts:27-33` | V |
| I-28 | No length limit on any enquiry field | `route.ts:67-78`, `db/schema.ts:145-147` | V |
| I-29 | The signed form timestamp binds to nothing — replayable for 12h across every form | `packages/core/src/forms/spam.ts:118-121` | V |
| I-30 | `/media` has no auth, republishing a private bucket to anyone | `starter/app/media/[...key]/route.ts:14`; premise at `:8-10` | V |
| I-31 | Font-stack regex permits `<`, `>`, `/` — breakout of the `<style>` sink | `theme/index.ts:108` → `starter/app/layout.tsx:50` | V |
| I-32 | `applyPresetTheme` stores a browser-supplied theme with no schema check | `preset-actions.ts:171-178` vs `:389` | V |
| I-33 | `StorageAdapter.put` drops `contentType` in the local implementation | `local.ts:39` vs interface `adapter.ts:18` | V |
| I-34 | No shared storage error type — an S3 outage is reported to visitors as 404 | `s3.ts:71`, `local.ts:51`, swallowed at `media/[...key]/route.ts:18-24` | V |
| I-35 | `EmailAdapter` leaks Resend's raw response body into the database and Dashboard | `resend.ts:43` → `forms/route.ts:111-117` | V |
| I-36 | An unconfigured mailer resolves successfully, so a dropped notification looks delivered | `email/adapter.ts:41-47` | V |
| I-37 | SigV4 has no `x-amz-security-token`, so STS/IAM roles cannot be used | `sigv4.ts:16-19,83-88` | V |
| I-38 | No clock-skew handling; S3 returns an opaque 403 | `sigv4.ts:79` | V |
| I-39 | SVG uploads bypass the `/media` CSP when `S3_PUBLIC_BASE_URL` is set | `adapter.ts:32`, `s3.ts:98` | V |
| I-40 | `pages.headerSlotId`/`footerSlotId` have no FK and no index | `db/schema.ts:43-44` | V |
| I-41 | `listPages` fetches every full published layout to compute one boolean | `actions.ts:302` → `admin/page.tsx:25` | V |
| I-42 | `$type<string[]>()` on `locked_slots` lies; a string value silently disables locking | `auth-schema.ts:78` → `permissions.ts:23` → `locking.ts:16` | V |
| I-43 | `role` enum has no CHECK constraint in SQL | `auth-schema.ts:18` vs `0002_smart_monster_badoon.sql:44` | V |
| I-44 | No layout size bounds on the Editor path (the AI path is bounded) | `layout/schema.ts:123,147` vs `ai/preset.ts:29,37` | V |
| I-45 | No id-uniqueness check in the layout schema | `layout/schema.ts:123,129` | V |
| I-46 | There is no unpublish — the only way to take a Page down is delete-with-history | grep: zero implementations | V |
| I-47 | `restoreVersion` overwrites the draft with no snapshot | `actions.ts:202-205` | V |
| I-48 | `applySlotsToAllPages` is an UPDATE with no WHERE | `slot-actions.ts:237-240` | V |
| I-49 | `uniqueSlug` loops unbounded, one query per attempt, with a TOCTOU race | `slot-actions.ts:109-117` | V |
| I-50 | AI rate limit is per-process per-person, not "per Site" as the roadmap claims | `starter/lib/ai.ts:209-225` vs `docs/ROADMAP.md:168` | V |
| I-51 | `request.json` is ignored by the Anthropic provider, so Preset generation runs without JSON mode | `ai/anthropic.ts:42-70` vs `openai-compatible.ts:63` | V |
| I-52 | Only `input` is length-capped on the AI route; three other strings are not | `api/ai/route.ts:59` vs `:63-67` | V |
| I-53 | Duplicate DOM ids inside repeater fields break every label | `FieldInput.tsx:53` | V |
| I-54 | `<legend>` used outside `<fieldset>` in five screens, so those panels are unlabelled | `DesignStudio.tsx:156`, `PageSettings.tsx:97`, +3 | V |
| I-55 | `role="tablist"`/`role="menu"` declared without the matching keyboard behaviour | `Editor.tsx:240-259`, `pickers.tsx:60-79` | V |
| I-56 | Mobile menu checkbox has no `aria-expanded`/`aria-controls` | `packages/blocks/src/index.tsx:135-140` | V |
| I-57 | Every keystroke `structuredClone`s the whole layout and re-renders every Block | `state.ts:165`; no `memo` in `Preview.tsx` | V |
| I-58 | "Draft saved" never clears, so it persists over an unsaved draft | `Editor.tsx:145-158,172` | V |
| I-59 | `field.number` yields `NaN` when cleared → React warning, `null` on save | `FieldInput.tsx:92-93` | V (latent) |
| I-60 | esbuild GHSA-67mh-4wv8-2f99 via deprecated `@esbuild-kit/esm-loader` | `pnpm audit`; `drizzle-kit@0.31.10` chain | V |
| I-61 | `@anthropic-ai/sdk: "^0.117.1"` can never reach 0.120.0 (0.x caret) | `packages/core/package.json` | V |
| I-62 | The `palette` override bypasses the hex colour schema | `ai/preset.ts:226,243-246` | V |

## Low

| # | Issue | Evidence |
|---|---|---|
| I-63 | `next-env.d.ts` is tracked but should not be — churns between `.next/types` and `.next/dev/types` | Installed Next 16.3.1 docs: *"should not be tracked by version control"* |
| I-64 | No lint tooling at all, yet 8 `eslint-disable` comments sit in the source | no config repo-wide; `design.tsx:80`, `FieldInput.tsx:166`, +6 |
| I-65 | Docker image runs as root, declares no `HEALTHCHECK`, no volume for `MEDIA_DIR` | `Dockerfile:21-28` |
| I-66 | `BASE_URL` silently defaults to localhost despite the file claiming it fails loudly | `starter/lib/env.ts:23` |
| I-67 | `AUTH_SECRET` serves three unrelated purposes with no domain separation | `site.ts:45`, `forms/route.ts:41,44` |
| I-68 | Installer's generated `AUTH_SECRET` is a UUID (122 bits) vs the documented 256 | `install/actions.ts:~58` |
| I-69 | `page_versions` grows unbounded and is never pruned | `actions.ts:167`, `preset-actions.ts:149,223` |
| I-70 | Built-in Presets are typed `sections: unknown[]`; safety rests on a test with no CI | `starter/presets/index.ts:28` |
| I-71 | `as unknown as` forces the layout types — `PageLayout` is asserted, not derived | `blocks/registry.ts:61,65,66`, `define.ts:34` |
| I-72 | `window.prompt`/`confirm` used for real workflows in 11 places | `SlotList.tsx:35,68` + 9 |
| I-73 | Local storage adapter does not resolve symlinks before writing | `local.ts:28,42` |
| I-74 | `mediaKey` unguessability comes from `Math.random()` | `storage/adapter.ts:56` |
| I-75 | ADRs carry no Status or Date field, and there is no index | `docs/adr/*.md` |
| I-76 | `engines: node >=20` vs `@types/node@^26` and a Node 24 image | root `package.json` |

## Docs vs reality

Every item below is **verified**, and together they are the most fixable class of issue here.

| # | Claim | Reality |
|---|---|---|
| I-77 | HANDOFF.md is dated 19 Aug and presents M7 as "next up" | Last touched at `f2fb9c9`, **7 commits behind HEAD**. M7, Shared Slots, M9 Presets, image-derived design and per-Block styling all shipped after it |
| I-78 | `docs/ROADMAP.md:164` leaves M7 unticked | Built at `356109b` |
| I-79 | ROADMAP M8.5 says "eight exist… six missing" | **14 Block Types exist** (`packages/blocks/src/index.tsx:258-268`). The six named gaps are real |
| I-80 | `readme.md:169` lists a `video` Block Type | No `videoBlock` anywhere in the repo |
| I-81 | `docs/ROADMAP.md:206` begins mid-sentence — the word "Markdown" is missing | Verified with `cat -A` |
| I-82 | HANDOFF.md:204 says 108 tests | 166 |
| I-83 | `starter/AGENTS.md` contains **only** the auto-generated Next.js block | No project guidance; `CLAUDE.md` is a one-line `@AGENTS.md` |
| I-84 | `docs/AI.md:114` suggests `anthropic/claude-opus-4.5` | Superseded — Opus 4.6, 4.7, 4.8 and 5 have shipped. `.env.example`'s `claude-opus-5` is correct |
| I-85 | `starter/lib/ai.ts:30` says `openrouter/free` "leads deliberately" | It is **last** at `:56`; `docs/AI.md:80` says last. Docblock attached to the wrong constant |

---

# Feature opportunities

Ranked by leverage. Each is grounded in code that already exists.

### 1. User management — the missing half of M4 (highest value)
`signUpEmail` is called in exactly one place (`starter/app/install/actions.ts:97`) and
`siteSettings.lockedSlots` is **only ever read**, never written (`settings/page.tsx:86` shows it
read-only). So an Owner today **cannot add an Author, demote anyone, or change the lock policy
without direct SQL**. The roles, the enforcement and the policy column all exist — only the
screen is missing. Without it, the Owner/Author model the whole product is built on is
unreachable in-product.

### 2. The six missing Block Types (M8.5)
Accordion, embed, image gallery, carousel, location map, and Markdown prose with its sanitising
renderer — all confirmed absent. `field.repeater()` already exists (`blocks/fields.ts:151`) and
is what a gallery and a carousel need; ADR-0011 already specifies the Markdown decision. A
gallery is the first thing a real client asks for.

### 3. Per-Block error boundaries — the fix for I-04 and I-05 together
`starter/lib/slots.ts:82-87` already demonstrates the pattern: log, degrade, keep rendering. Apply
it per Block and per Section instead of per document and the "invalid layout fails whole" item
that has sat on the Not-Finished list disappears, along with the Editor's blank-screen failure.

### 4. A keyboard route through the Editor
`@dnd-kit` ships `KeyboardSensor` and `sortableKeyboardCoordinates`; the handles already carry the
ARIA that promises them (I-09). This is close to a one-file change plus move-up/move-down controls
in `SettingsPanel`, and it converts a false accessibility claim into a true one.

### 5. Editing a contact form's fields
Fixed at name/email/message today. `field.repeater()` already exists, so this is a Block change
rather than a schema change — and it is what turns a brochure form into a booking or quote form.

### 6. Unpublish, and a "where is this used?" view
Neither exists (I-46; and HANDOFF.md:139 already names the media one). Both are small, and both
make an existing confirmation dialog honest.

### 7. CI, and making the skipped suites run
No `.github/` at all. A workflow running `typecheck` + `test` with Postgres, MinIO and Mailpit as
services turns the three highest-value suites from decorative into load-bearing — and would have
caught I-08 immediately.

### 8. Autosave, or at minimum a `beforeunload` guard
`state.dirty` is already tracked (`state.ts:41`). Given I-05 and I-06, the draft is currently one
stray click from gone.

### 9. Contrast validation in the Theme pipeline
`readableOn` already exists (`theme/index.ts:171`) and is applied to `onPrimary`/`onAccent`.
Extending it to the `muted`/`primary`/`accent` Block tones would close I-14 and make the Editor's
"nothing here can be off-brand" promise true — which matters most for image-derived palettes.

### 10. From the roadmap's own "After M9" list
Collections and the blog remain the item that makes this more than a page builder. Inline text
editing, redirects/JSON-LD, and the translation UI (the `locale` column is already there) follow.

---

## Quality Commands

| Type | Command | Source |
|---|---|---|
| TypeCheck | `pnpm typecheck` | root `package.json` → `turbo run typecheck` |
| Test | `pnpm test` | root `package.json` → `vitest run` |
| Build | `pnpm build` | root `package.json` → `turbo run build` |
| Lint | **Not found** | no script, no config anywhere |
| E2E | **Not found** | no framework installed |

**Local CI:** `pnpm typecheck && pnpm test && pnpm build`

## Verification Tooling

| Tool | Value | Detected from |
|---|---|---|
| Dev server | `pnpm dev` | root `package.json` |
| Port | `3000` | `Dockerfile:23`, `starter/lib/env.ts:23` |
| Browser automation | none | no playwright/puppeteer/cypress |
| Health endpoint | none | only `api/ai`, `api/auth`, `api/forms` |
| Docker | `docker-compose.yml`, `Dockerfile` | repo root |

**Project type:** Web app (Next.js 16 + Postgres).
**Verification strategy:** `docker compose up -d db` → `pnpm dev` → sign in at `/admin`. The
`storage` and `mail` profiles must be up for the S3 and SMTP suites to run rather than skip.

## Related Specs

`specs/` contains only `project-audit`. No overlap, no conflicts.

## Sources

- Run locally: `pnpm typecheck`, `pnpm test`, `pnpm audit`, `git log`, `git status`
- Installed Next.js 16.3.1 docs (`starter/node_modules/next/dist/docs/`) — `next-env.d.ts` tracking, 1 MB server-action body limit, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- https://better-auth.com/blog/1-7 · https://github.com/better-auth/better-auth/releases/tag/v1.7.0
- https://github.com/advisories/GHSA-67mh-4wv8-2f99
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- Repo: `CONTEXT.md`, `HANDOFF.md`, `docs/ROADMAP.md`, `docs/adr/*`, `docs/AI.md`, `docs/EMAIL.md`, `docs/HOSTING.md`, and the source files cited inline above
