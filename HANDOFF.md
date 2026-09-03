# Handoff — 3 September 2026

Where Mimnets stands, what is not finished, and where to pick up. Read this first; it is
written to be the only thing you need before starting.

The previous handoff was dated 19 August and went eleven commits stale. If you are reading a
copy of that one, discard it: it presents M7 as "next up" and M7 shipped the same afternoon.

## Where to start

Three things are queued. None is blocked on code, and two need you.

**1. Publish, if you want it public.** `npm login` first — it is interactive, so it cannot be
done for you. Then `pnpm release`. Worth knowing before you do: no package exists under
`@mimnets` today, so the first publish claims the scope, and npm publishes are effectively
permanent. Everything about the packaging is already proven against the local registry, so
this changes the hostname and nothing else.

**2. Component tests are blocked on a pnpm store mismatch.** Installing jsdom and
`@testing-library/react` fails with `ERR_PNPM_UNEXPECTED_STORE`: this repo's `node_modules`
are linked from `~/.pnpm/store/v11` while pnpm now wants `~/AppData/Local/pnpm/store/v11`.
Either keep the old store, or accept the new one and reinstall:

```bash
pnpm config set store-dir "C:/Users/Monir/.pnpm/store" --global    # keep the old store
pnpm install                                                        # or accept the new one
```

The second reinstalls the whole monorepo, which is why it was left rather than started at the
end of a session. It is worth doing. **There are still no component tests**, the vitest
environment is `node` with no DOM, and that is precisely why the Block error boundary shipped
broken to review earlier today: it was wrapped around a function call rather than a child
component, so it caught nothing, and only a browser showed it.

**3. A fresh audit.** The last one is dated 20 August and the codebase has moved a long way
since — twenty findings fixed, a build step, published packages, a second Site. A new pass
would find what those changes introduced, which is where problems hide after a big change.

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
| ⚠️ | **M8.5** Block library | 14 Block Types, Section tones, a Theme built around them — six Block Types still missing |
| ✅ | **M9** Presets | Generate a Theme and Pages together, validated against the registry before they land |

**v1 is finished.** M8.5 is the only partial, and it sits after the v1 boundary in the
roadmap by design.

There are two Sites now. `starter` is the one the monorepo develops against; `sites/ledger`
is a chartered accountant with its own Theme and one Block Type of its own, deliberately
outside the pnpm workspace so that it installs the published packages rather than linking to
their source. A workspace link would have tested the monorepo rather than the packaging.

## The audit is closed

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

`pnpm test` — **249 passing, 7 skipped, about nine seconds.** It was 2 failing, 152 passing
and red without Docker.

The seven skips are the live-provider suites, off unless asked for:

```bash
AI_LIVE_TESTS=1 pnpm test     # calls a real model; slow and occasionally flaky by nature
```

They are opt-in because free models are rate limited and retired without notice, so they
fail for reasons unrelated to the code — which is the failure I-08 was about, reintroduced
once a run. Run them before shipping anything that touches the AI stack.

**There are still no component tests.** The vitest environment is `node`, with no jsdom, so
`BlockBoundary`, the focus trap and the keyboard sensor are verified in a browser rather than
in CI. One of them shipped broken to review because of it.

## Not finished

Honest list. None of it is hidden behind a green tick.

- **Nothing is published to npm.** The registry is Verdaccio, behind the `registry` profile
  in `docker-compose.yml`, so the `@mimnets` scope is unclaimed and no version is public. The
  build, the exports, the publish guard, the install and the upgrade are all real; only the
  hostname is local.
- **No component tests.** See the top — blocked on a pnpm store mismatch, not on effort.
- **Six Block Types from M8.5 are missing**: accordion, embed, image gallery, carousel,
  location map, and Markdown prose with its sanitising renderer (ADR-0011). A carousel and a
  gallery are the first two a real client asks for.
- **The nav is one level deep**, deliberately (see `render/context.ts`). A client wanting a
  dropdown means reopening that decision, and the comment there is right that hover intent,
  keyboard traps and mobile behaviour make it harder than it looks.
- **There is no lint.** ESLint cannot run here at all: TypeScript 7.0 is the native Go port
  and ships a CLI with no compiler API, which typescript-eslint needs. Revisit at 7.1 rather
  than adding a linter that cannot see types (I-64).
- **No component tests.** See the note above.
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

In the order agreed, and none of it started:

1. **Finish M8.5** — carousel, accordion, image gallery, comparison table, social links row.
   This is what turns "a plausible landing page" into "we could rebuild that client's Site",
   and it is the prerequisite for a Preset being worth generating, exactly as M8.5's own text
   has said since it was written.
2. **Stock images.** Generated Presets ship with grey rectangles where photographs belong.
   Behind a `StockAdapter`, in the same shape as StorageAdapter and EmailAdapter. Photos are
   **downloaded into the Site's own media store at apply time**, never hotlinked — layouts
   hold keys, not URLs (ADR-0012) — and fetching at apply time rather than generate time
   means a Preset nobody chooses costs nothing. Media rows record where a photo came from so
   the Dashboard can show which are still placeholders.
3. **Effects and a demo page.** Section stagger, slide/scale/blur/wipe, speed as Gentle /
   Normal / Brisk, parallax. Named options resolving to Theme tokens, never utility classes —
   the rule from `1dac8e7` holds. Plus an ⓘ explaining each in plain words and a gallery at
   `/admin/design/effects`, because choosing "Rise" today shows an Author nothing.
4. **A preview panel in the Design tab**, so a Theme can be seen before it is applied.
5. **AI provider and model settings.** Gemini and Grok by name, Groq and Mistral as presets
   over the existing custom endpoint. Model chosen from each provider's live catalogue.
   Site-wide default in Settings, per-job override kept in Design Studio. Keys stay in the
   environment: the Settings screen chooses among what the environment already enabled, and
   never stores a secret.
6. **The blog** — the Markdown prose Block first, then posts with their own routing and a
   listing Block. Collections generalise it later.
7. **A Vercel deploy button** plus a Neon integration. Note that ADR-0012 rules out the local
   disk on Vercel, so that template must require R2 or S3 rather than offer it.

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
