# Handoff — 3 September 2026

Where Mimnets stands, what is not finished, and where to pick up. Read this first; it is
written to be the only thing you need before starting.

The previous handoff was dated 19 August and went eleven commits stale. If you are reading a
copy of that one, discard it: it presents M7 as "next up" and M7 shipped the same afternoon.

## Where to start

**Launch Docker Desktop.** It is not running, and everything below waits on it.

Then, in order:

1. `docker compose up -d db`, `pnpm dev`, and sign in at http://localhost:3000/admin.
2. **Media → Upload** a photograph. Check it lists at the right pixel size, place it on a
   Page with the image Block, publish. That is the last unverified clause of **M6**.
3. **Enquiries.** Submit the form on `/contact` as a visitor, then look at that screen while
   signed in. That is the last unverified clause of **M6.5**.
4. Then continue the audit fix pass on `audit/high-severity` — see *The work in progress*.

Those two checks have been the only thing between two milestones and a tick since 19 August.
Neither is waiting on code. Both are waiting on somebody being logged in, which nobody has
been.

If you want the notification email to arrive while testing, point the Site at the local mail
container: `docker compose --profile mail up -d mail`, then the SMTP block from
`starter/.env.example` with `SMTP_HOST=localhost` and `SMTP_PORT=1025`. Inbox at
http://localhost:8025. Real setup is in [docs/EMAIL.md](./docs/EMAIL.md).

## What exists today

| | Milestone | What it means |
| --- | --- | --- |
| ✅ | **M0** Foundations | pnpm/Turborepo monorepo, Postgres + Drizzle, `pnpm setup` wizard, Dockerfile and compose |
| ✅ | **M1** Layout engine | Slot → Section → Column → Block as one validated JSON document; `defineBlock`; renderer |
| ✅ | **M2** The Editor | Split view, drag between Columns and Slots, forms generated from field declarations |
| ✅ | **M3** Draft, publish, history | Edits invisible until published; every publish snapshots; restore into the draft |
| ✅ | **M4** Auth, roles, installer | Better Auth, Owner/Author, Slot locking enforced server-side, web installer |
| ✅ | **M5** Pages, Menus, Theme | Path routing, the Menu entity, `theme.ts` → CSS variables, responsive navigation |
| ⚠️ | **M6** Media and SEO | StorageAdapter, uploads, media library, per-Page SEO, sitemap, robots — one clause unverified |
| ⚠️ | **M6.5** Forms and email | Contact Block, enquiries in the Dashboard, pluggable spam checks, EmailAdapter — one clause unverified |
| ✅ | **M7** AI writing assistant | Rewrite, shorten, alt text, search descriptions, over a chain of providers (ADR-0014) |
| ❌ | **M8** Packaging, Site two | **Not started.** The milestone that proves ADR-0001 earned its cost |
| ⚠️ | **M8.5** Block library | 14 Block Types, Section tones, a Theme built around them — six Block Types still missing |
| ✅ | **M9** Presets | Generate a Theme and Pages together, validated against the registry before they land |

Shipped since the last handoff, none of it recorded there: M7, Shared Headers and Footers
(ADR-0015), M9 Presets, design-from-an-image, and per-Block text colour and typeface.

**M8 is the gap worth naming.** The roadmap has said since M0 that v1 ends after M8, and M8
is what proves the packaged-template architecture works — fix one bug in `packages/core`,
publish, upgrade two Sites. Everything built since M7 rests on an assumption that has never
been tested against a second Site.

## The audit, and the work in progress

On 20 August the project was audited end to end. It produced
[specs/project-audit/research.md](./specs/project-audit/research.md) — **85 findings**, each
with a file and line number, banded:

| Band | Count | Range |
| --- | --- | --- |
| High | 20 | I-01 – I-20 |
| Medium | 42 | I-21 – I-62 |
| Low | 14 | I-63 – I-76 |
| Docs vs reality | 9 | I-77 – I-85 |

**Twenty are in scope for the current pass**: the High band, plus I-30, I-48 and I-32
promoted from Medium because they are security-shaped rather than merely untidy. Three are
done. They are the first three commits on `audit/high-severity`:

- **I-01 — the contact form was an open mail relay.** `recipient` was a hidden input, so any
  visitor could name an address and have the Site deliver their message from its own verified
  domain. Now looked up server-side from the published Block.
- **I-02 — the installer failed open during a database outage.** An unreachable database read
  as an unconfigured one, which handed an unauthenticated `provisionDatabase` to whoever
  caught the Site while it was down. Four install modes now, and every route asks positively.
  [ADR-0016](./docs/adr/0016-the-installer-fails-closed.md).
- **I-03 — saving a Page destroyed its own Header.** The Editor is handed the resolved
  document and posted back a copy of whichever Shared Slot was rendered in its place.
  [ADR-0017](./docs/adr/0017-the-editor-does-not-own-shared-slots.md).

The remaining seventeen sort into six seams, to be taken in this order, one commit each:

| Seam | Findings |
| --- | --- |
| **Test foundation** | I-08, I-10 |
| Layout integrity | I-04, I-11 |
| Entry points | I-07, I-30, I-32, I-48 |
| Resilience | I-05, I-20 |
| Editor correctness | I-06, I-17, I-18, I-19 |
| Accessibility | I-09, I-12, I-13, I-14, I-15, I-16 |

**The test foundation goes first, and it is not a formality.** I-10 found that no test
touches `actions.ts`, `slots.ts`, `render.tsx` or either route handler — which is precisely
where I-04, I-07 and I-11 live. The coverage that would prove the rest of this pass does not
exist yet. Building it first is what makes the other five seams verifiable rather than
asserted.

## Not finished

Honest list. None of it is hidden behind a green tick.

- **Nobody has been signed in.** Two milestones, two screens, twenty minutes. See the top.
- **Seventeen of the twenty audit findings are open**, including: one bad Block blanks the
  whole Page and Publish is not gated on `dirty`, so a click bakes it in (I-04); there are no
  error boundaries anywhere (I-05); `/media` has no auth at all (I-30); there is no timeout
  anywhere in the AI stack, so a hung upstream hangs a visitor's form POST (I-20); and a total
  AI failure is written into the Author's field as content, which they can then publish (I-19).
- **The Editor has no keyboard route** (I-09) — and its drag handles announce dnd-kit's
  keyboard instructions for a sensor that was never registered.
- **`pnpm test` fails without Docker.** `permissions.test.ts` gates on `DATABASE_URL` being
  *set* rather than *reachable*, so it hard-fails where it was designed to skip (I-08). The
  audit's 20 August run reported 166 tests with 2 failing for this reason; that number has not
  been re-measured since, and cannot be until Docker is up.
- **There is no CI and no lint.** No `.github`, no workflow, no lint script — yet eight
  `eslint-disable` comments sit in the source (I-64). Note that ESLint *cannot* currently run
  here: TypeScript 7.0 is the native Go port and ships a CLI with no compiler API until 7.1.
- **M8 has not been started**, and no second Site exists.
- **Six Block Types from M8.5 are missing**: accordion, embed, image gallery, carousel,
  location map, and Markdown prose with its sanitising renderer (ADR-0011).
- **Nobody has sent through Resend.** SMTP is proven against a real mail server; Resend is
  not, because that needs an account and a verified domain.
- **Provisioning mode of the installer is still untested.** This machine already had a
  database configured, so the no-database path has never been run.
- **A form's fields are fixed**: name, email, message.
- **Deleting a file leaves the Pages that used it pointing at nothing.** Deliberate, argued in
  ADR-0012, but there is no "where is this used?" view.
- **AVIF and SVG upload without dimensions.** They render; just without width and height.
- **No caching anywhere.** Every request reads the database. Deliberate.
- **`next-env.d.ts` is tracked and churns** between `.next/types` and `.next/dev/types`
  depending on whether `dev` or `build` ran last. Next's own docs say it should not be tracked
  (I-63). Out of scope for the current pass, so it is sitting modified in the working tree.

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
docker compose up -d db                        # Postgres, stack name mimnets-multisite
pnpm dev                                       # http://localhost:3000
pnpm seed                                      # three demo Pages, the main Menu, an image, a contact form
pnpm test                                      # see the note on I-08 above
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
