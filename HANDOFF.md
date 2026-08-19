# Handoff — 19 August 2026

Where Mimnets stands at the end of today, what is not finished, and where to pick up
tomorrow. Read this first; it is written to be the only thing you need before starting.

## Where to start tomorrow

**One sign-in closes out both M6 and M6.5.** Neither is ticked, and neither is waiting on
code — they are waiting on somebody being logged in, which nobody has been. Twenty minutes:

1. `docker compose up -d db` then `pnpm dev`, and sign in at http://localhost:3000/admin.
2. **Media → Upload** a photograph. Check it lists with the right pixel size, then place it
   on a Page with the image Block and publish. That is the last clause of M6.
3. **Enquiries.** Submit the form on `/contact` as a visitor first, then look at that screen
   while signed in. That is the last clause of M6.5.
4. Then either put the thing in front of a real client — which is what v1 was for — or start
   **M7, the AI writing assistant** ([docs/ROADMAP.md](./docs/ROADMAP.md)).

If you want the notification email to actually arrive while testing, point the Site at the
local mail container: `docker compose --profile mail up -d mail`, then the SMTP block from
`starter/.env.example` with `SMTP_HOST=localhost` and `SMTP_PORT=1025`. Its inbox is at
http://localhost:8025. Real setup, for a real Site, is in [docs/EMAIL.md](./docs/EMAIL.md).

## What exists today

Eight milestones, each verified against a running Site and a real database rather than
assumed. The last two carry a warning rather than a tick, for the reason above.

| | Milestone | What it means |
| --- | --- | --- |
| ✅ | **M0** Foundations | pnpm/Turborepo monorepo, Postgres + Drizzle, `pnpm setup` wizard, Dockerfile and compose |
| ✅ | **M1** Layout engine | Slot → Section → Column → Block as one validated JSON document; `defineBlock`; renderer |
| ✅ | **M2** The Editor | Split view, drag between Columns and Slots, forms generated from field declarations |
| ✅ | **M3** Draft, publish, history | Edits invisible until published; every publish snapshots; restore into the draft |
| ✅ | **M4** Auth, roles, installer | Better Auth, Owner/Author, Slot locking enforced server-side, two-mode web installer |
| ✅ | **M5** Pages, Menus, Theme | Path routing, the Menu entity, `theme.ts` → CSS variables, responsive navigation |
| ⚠️ | **M6** Media and SEO | StorageAdapter, uploads, media library, per-Page SEO, sitemap, robots — one clause unverified |
| ⚠️ | **M6.5** Forms and email | Contact Block, enquiries in the Dashboard, pluggable spam checks, EmailAdapter — one clause unverified |

### Proven, not assumed

Yesterday's list still holds. Added today:

- **The mobile drawer opens.** Yesterday's open question, driven at 390px in a real browser:
  tapping the hamburger opens the panel, and all three links land on screen.
- **The drawer is reachable without a mouse — now.** It was not. The checkbox behind it was
  `display: none`, which takes an element out of the focus order entirely, so a keyboard user
  had no way to open the menu and no way to reach any link below 720px. Fixed, and verified
  by tabbing to it and pressing Space.
- **The S3 adapter signs correctly**, tested against a real S3-compatible server, including a
  control that proves a wrong secret is rejected with a 403.
- **The image-size reader works on real files** — PNG, JPEG, WebP and GIF encoded by a
  browser at a known size, not headers hand-written to match the parser.
- **`/sitemap.xml` lists exactly the published Pages.** Checked against a Site carrying a
  deliberately unpublished Page: three listed, the draft absent, and a visitor asking for it
  gets a 404.
- **The media route cannot be walked out of.** Three traversal attempts refused, no `.env`
  leaked.
- **A contact form works end to end with no JavaScript.** A visitor filled it in a real
  browser, was thanked, and the notification arrived at the Owner's address through a real
  SMTP server — with reply-to set to whoever wrote in, so answering is one keystroke.
- **Four bot attempts were refused**: no timestamp, honeypot filled, submitted instantly, and
  a forged timestamp. None of them reached the database.
- **An enquiry survived a broken mail server.** With SMTP pointed at a dead port, the visitor
  was still thanked, the row was still written, and the failure was recorded on it. That is
  the entire argument for storing before sending, and it is now tested rather than asserted.
- **The form endpoint is not an open redirect.** It was one: `mn_return` is a hidden field,
  so anybody could post an absolute URL and have the Site itself bounce the visitor onto
  their domain. Spotted by watching a redirect during testing, fixed, and pinned by tests.
- 105 tests pass, 16 of them against a real database, a real S3 server or a real mail server.

## Decisions you made today

1. **Local disk is the default storage, R2 is the opt-in.** Recorded as
   [ADR-0012](./docs/adr/0012-local-disk-is-the-default-storage.md). A cloned Starter accepts
   an upload with no account anywhere; four environment variables move a Site to a bucket,
   and no Page needs editing because a layout stores keys rather than URLs. The cost is
   written down honestly in [HOSTING.md](./docs/HOSTING.md): a Site on the disk is tied to
   its machine, and on Vercel the disk is not an option at all.
2. **Spam protection is pluggable.** The honeypot, the timing check and the per-IP rate limit
   are a list in `starter/lib/spam.ts`, and adding a CAPTCHA means appending one signal to it
   rather than editing the contact Block. The file says so, with a worked example.
3. **Resend is the default email provider, SMTP the fallback.** Resend's API is one HTTP
   POST, so the provider half needs no SDK — the same trade the S3 adapter made. SMTP costs
   one dependency, because writing an SMTP client by hand means TLS and four authentication
   mechanisms, which is a different kind of risk from signing a request. Setup for both,
   including the DNS records Resend needs, is in [docs/EMAIL.md](./docs/EMAIL.md).

## Not finished

Honest list. None of it is hidden behind a green tick.

- **Nobody has been signed in.** This is the only thing between two milestones and a tick,
  and it blocks exactly two screens: the Upload button in Media, and the Enquiries list.
  Everything underneath both is tested. See the top of this file.
- **Nobody has sent through Resend.** The SMTP adapter is proven against a real mail server;
  the Resend adapter is not proven against Resend, because that needs an account and a
  verified domain. Its failure mode is loud — the enquiry is saved and the refusal written on
  the row — but treat the first real Site's first enquiry as the test.
- **Provisioning mode of the installer is still untested.** Unchanged since yesterday: the
  no-database path writes `.env` and applies migrations, but this machine already had a
  database configured, so it has never been run.
- **An invalid layout still fails whole.** One bad Block renders an empty Page with an error
  instead of dropping the offending Block and rendering the rest. Fine while you are the only
  Author; wrong for a client Site. Worth fixing before the first handover.
- **A form's fields are fixed**: name, email, message. Enough for a brochure Site's contact
  page and not enough for anything else. Making them editable is a repeater field on the
  Block, and belongs with the rest of the Block work at M8.5.
- **The rate limit counts accepted submissions only.** A flood that trips the honeypot every
  time is refused every time but never accumulates, so it costs a database read per attempt.
  Fine behind any host doing connection-level limiting; worth revisiting if a Site is ever
  genuinely targeted.
- **The mobile Header is tall and mostly empty.** The logo and the hamburger stack into two
  grid rows below 720px, so roughly 160px of the first screen is blank. It works, and it was
  not bad enough to block anything, but it is the first thing a client will mention.
- **Deleting a file leaves the Pages that used it pointing at nothing.** Deliberate, and
  argued in ADR-0012. There is no "where is this used?" view, which is the thing that would
  make the confirmation dialog honest.
- **AVIF and SVG upload without dimensions.** One needs a full ISOBMFF walk, the other has no
  intrinsic pixel size. They render fine, just without width and height.
- **Sidebar Slot has no styling of its own.** It renders, but no Page uses it meaningfully.
- **No caching anywhere.** Every request reads the database. Deliberate until a Site needs
  otherwise — though `/media` sets an immutable cache header, since a key is never reused.
- **Deleting a Page deletes its history** (cascade), behind a confirmation.

Closed since yesterday: the mobile drawer is verified and keyboard-operable, `renamePage` has
a UI on the new Page settings screen, and M6.5 exists.

## Next up

**v1 is feature-complete.** M6.5 was the last thing standing between this and a Site you
could hand to a paying client, and it is built. What remains before M7 is not code:

- The two sign-in checks at the top of this file.
- Use it on something real. The roadmap has said since M0 that v1 ends before M8 and that a
  real Site should come first. It is now worth doing — the gaps listed above are the kind
  that only a real client surfaces.

After that, **M7 — the AI writing assistant**: rewrite, shorten, alt text and SEO
descriptions, acting on the selected Block's fields, streaming and cancellable, with the key
held server-side and rate limited per Site. It is also where the provider abstraction that
Presets later reuse gets built ([ADR-0007](./docs/adr/0007-ai-generated-presets.md)).

## Things to know before you touch the code

Yesterday's notes all still apply — read [CONTEXT.md](./CONTEXT.md), the ADRs record what was
rejected and why, the registry cannot cross the server/client boundary, the database lives
behind `@mimnets/core/db`, and server actions are the boundary rather than the Editor. Added:

- **Storage and email live behind `@mimnets/core/storage` and `@mimnets/core/email`**, never
  the root import, for the same reason the database does: they read the filesystem, hold API
  keys and sign with `node:crypto`, and none of that belongs in a browser bundle.
- **An image field holds a key, not a URL.** Blocks build their own URL from
  `context.mediaBaseUrl`. If you find yourself putting an absolute URL into a layout, that is
  the thing ADR-0012 exists to prevent.
- **A contact form posts to a route handler, not to a server action.** It has to work with no
  JavaScript, and a plain `<form method="post">` can only reach a URL. That constraint is
  also why the result message is a query parameter rather than component state.
- **Everything a form sends is attacker-controlled, hidden fields included.** The return path
  is reduced to a path on this Site, and the timestamp is signed — an unsigned timestamp in a
  hidden field is a suggestion. Both have tests; read them before changing either.
- **Spam checks live in `starter/lib/spam.ts`**, as a list. That is the file to edit if a
  Site starts getting spam, and it is deliberately not the contact Block.
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
pnpm seed                                      # three demo Pages, the main Menu, a placeholder image, a contact form
pnpm test                                      # 105 tests
pnpm typecheck                                 # 4 packages, strict
pnpm build                                     # must stay warning-free

docker compose --profile storage up -d storage # MinIO on :9000, for the S3 adapter's tests
docker compose --profile mail up -d mail       # Mailpit, SMTP on :1025, inbox on :8025
```

Those last two back the tests that would otherwise have been mocks. Both suites skip rather
than fail when their container is not running, so a green suite without Docker means twelve
fewer tests rather than twelve passing ones — `pnpm test` prints the count, and it should say
105.

One trap worth knowing: running `pnpm build` while `pnpm dev` is running leaves the dev
server serving a broken shell, because the production build overwrites the `.next` directory
underneath it. Stop dev first, or restart it afterwards.

Signed in as `mdmonirulislammonir@gmail.com` (Owner). The Site is installed, so `/install`
redirects away and public sign-up returns 403 — both by design.
