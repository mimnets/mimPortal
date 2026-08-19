# Handoff — 19 August 2026

Where Mimnets stands at the end of today, what is not finished, and where to pick up
tomorrow. Read this first; it is written to be the only thing you need before starting.

## Where to start tomorrow

1. **Sign in and upload an image.** This is the one clause of M6 nobody has done by hand,
   and the milestone is not ticked until you have. `docker compose up -d db` then `pnpm dev`,
   sign in at http://localhost:3000/admin, open **Media**, upload a photograph, then place it
   on a Page with the image Block and publish. Everything under that click is tested; the
   click is not.
2. Check the upload appears at `/admin/media` with its pixel size read correctly.
3. Start **M6.5 — Forms and email** ([docs/ROADMAP.md](./docs/ROADMAP.md)).

Disk is no longer a problem — 13 GB free this morning, against the 1 GB that broke two
builds yesterday.

## What exists today

Seven milestones, each verified against a running Site and a real database rather than
assumed.

| | Milestone | What it means |
| --- | --- | --- |
| ✅ | **M0** Foundations | pnpm/Turborepo monorepo, Postgres + Drizzle, `pnpm setup` wizard, Dockerfile and compose |
| ✅ | **M1** Layout engine | Slot → Section → Column → Block as one validated JSON document; `defineBlock`; renderer |
| ✅ | **M2** The Editor | Split view, drag between Columns and Slots, forms generated from field declarations |
| ✅ | **M3** Draft, publish, history | Edits invisible until published; every publish snapshots; restore into the draft |
| ✅ | **M4** Auth, roles, installer | Better Auth, Owner/Author, Slot locking enforced server-side, two-mode web installer |
| ✅ | **M5** Pages, Menus, Theme | Path routing, the Menu entity, `theme.ts` → CSS variables, responsive navigation |
| ⚠️ | **M6** Media and SEO | StorageAdapter, uploads, media library, per-Page SEO, sitemap, robots — one clause unverified |

### Proven, not assumed

Yesterday's list still holds. Added today:

- **The mobile drawer opens.** Yesterday's open question. It was driven at 390px in a real
  browser: tapping the hamburger opens the panel, and all three links land on screen.
- **The drawer is reachable without a mouse — now.** It was not. The checkbox behind it was
  `display: none`, which takes an element out of the focus order entirely, so a keyboard user
  had no way to open the menu and no way to reach any link below 720px. It is now visually
  hidden but focusable, with the focus ring drawn on the button; verified by tabbing to it
  and pressing Space, with nothing else touched on desktop.
- **The S3 adapter signs correctly**, tested against a real S3-compatible server, including a
  control that proves a wrong secret is rejected with a 403. Signing is written by hand
  against the specification rather than pulled in with the AWS SDK.
- **The image-size reader works on real files** — PNG, JPEG, WebP and GIF encoded by a
  browser at a known size, not headers hand-written to match the parser.
- **`/sitemap.xml` lists exactly the published Pages.** Checked against a Site carrying a
  deliberately unpublished Page: three listed, the draft absent, and a visitor asking for it
  gets a 404.
- **The media route cannot be walked out of.** Three traversal attempts — `../`, an encoded
  `..%2f`, and a mid-path `..` — were all refused without leaking `.env`.
- **A stored key survives the round trip**: the seeded placeholder renders on the published
  home page through `/media`, which is the whole point of storing keys rather than URLs.
- 65 tests pass, 11 of them against a real database or a real S3 server.

## Decisions you made today

1. **Local disk is the default storage, R2 is the opt-in.** Recorded as
   [ADR-0012](./docs/adr/0012-local-disk-is-the-default-storage.md). A cloned Starter accepts
   an upload with no account anywhere; four environment variables move a Site to a bucket,
   and no Page needs editing because a layout stores keys rather than URLs. The cost is
   written down honestly in [HOSTING.md](./docs/HOSTING.md): a Site on the disk is tied to
   its machine, and on Vercel the disk is not an option at all.
2. **Spam protection is pluggable**, rather than honeypot-only or CAPTCHA-now. M6.5 ships the
   honeypot, the timing check and the per-IP rate limit behind an interface, so a Site that
   is actually attacked drops a CAPTCHA in without touching the contact Block's markup. This
   is the one M6.5 design decision already made — the rest is open.

## Not finished

Honest list. None of it is hidden behind a green tick.

- **Nobody has uploaded an image through the Dashboard.** See step 1 above. The rules that
  accept or reject a file, the key generation, the write, the row and the render are each
  tested, and the seeded placeholder proves the render path end to end — but the Editor's
  Upload button has never been pressed by a person.
- **Provisioning mode of the installer is still untested.** Unchanged from yesterday: the
  no-database path writes `.env` and applies migrations, but this machine already had a
  database configured, so it has never been run.
- **An invalid layout still fails whole.** One bad Block renders an empty Page with an error
  instead of dropping the offending Block and rendering the rest. Fine while you are the only
  Author; wrong for a client Site. Worth fixing before the first handover.
- **The mobile Header is tall and mostly empty.** The logo and the hamburger stack into two
  grid rows below 720px, so roughly 160px of the first screen is blank. It works, and it was
  not bad enough to block anything, but it is the first thing a client will mention.
- **Deleting a file leaves the Pages that used it pointing at nothing.** Deliberate, and
  argued in ADR-0012: re-uploading is recoverable, rewriting every Page that referenced an
  image is not. There is no "where is this used?" view, which is the thing that would make
  the confirmation dialog honest.
- **AVIF and SVG upload without dimensions.** One needs a full ISOBMFF walk, the other has no
  intrinsic pixel size. They render fine, just without width and height, so they can shift
  the text under them as they load.
- **Sidebar Slot has no styling of its own.** It renders, but no Page uses it meaningfully.
- **No caching anywhere.** Every request reads the database. Deliberate until a Site needs
  otherwise — though `/media` now sets an immutable cache header, since a key is never reused.
- **Deleting a Page deletes its history** (cascade), behind a confirmation.

Closed since yesterday: the mobile drawer is verified and now keyboard-operable, and
`renamePage` has a UI — it lives on the new Page settings screen beside the SEO fields.

## Next up — M6.5, Forms and email

The last thing standing between this and a Site you can hand to a paying client.

- The contact Block and a `form_submissions` table, readable in the Dashboard
- Spam protection behind an interface: honeypot, timing check, per-IP rate limit
- `EmailAdapter`, the same shape as `StorageAdapter` — a transactional provider by default,
  SMTP as the self-hosted fallback. M4's password resets use it too, so building it once
  here serves both.

**Done when:** a visitor submits the contact form on a published Site, the Owner gets an
email, the submission is visible in the Dashboard, and a bot posting the form directly is
rejected.

## Things to know before you touch the code

Yesterday's notes all still apply — read [CONTEXT.md](./CONTEXT.md), the ADRs record what was
rejected and why, the registry cannot cross the server/client boundary, the database lives
behind `@mimnets/core/db`, and server actions are the boundary rather than the Editor. Added:

- **Storage lives behind `@mimnets/core/storage`**, never the root import, for the same
  reason the database does: it reads the filesystem and signs with `node:crypto`, and neither
  belongs in a browser bundle.
- **An image field holds a key, not a URL.** Blocks build their own URL from
  `context.mediaBaseUrl`. If you find yourself putting an absolute URL into a layout, that is
  the thing ADR-0012 exists to prevent.
- **A bundler that cannot read a filesystem path statically traces the whole project into the
  deploy** — every source file and the public folder, shipped as server code.
  `starter/lib/storage.ts` carries a `turbopackIgnore` for exactly this, and the build warns
  loudly if it is removed.
- **The Editor reaches the media library through a prop, not an import.** `Editor` takes a
  `media` bridge and puts it in React context; the image field reads it from there. Same
  reason save and publish are props: the admin package cannot import a server action.

## Running it

```bash
docker compose up -d db                        # Postgres, stack name mimnets-multisite
pnpm dev                                       # http://localhost:3000
pnpm seed                                      # three demo Pages, the main Menu, one placeholder image
pnpm test                                      # 65 tests
pnpm typecheck                                 # 4 packages, strict
pnpm build                                     # must stay warning-free

docker compose --profile storage up -d storage # MinIO on :9000, for the S3 adapter's tests
```

The S3 tests skip rather than fail when that container is not running, so a green suite
without Docker means seven fewer tests rather than seven passing ones — `pnpm test` prints
the count, and it should say 65.

One trap worth knowing: running `pnpm build` while `pnpm dev` is running leaves the dev
server serving a broken shell, because the production build overwrites the `.next` directory
underneath it. Stop dev first, or restart it afterwards.

Signed in as `mdmonirulislammonir@gmail.com` (Owner). The Site is installed, so `/install`
redirects away and public sign-up returns 403 — both by design.
