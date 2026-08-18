# Handoff — 18 August 2026

Where Mimnets stands at the end of today, what is not finished, and where to pick up
tomorrow. Read this first; it is written to be the only thing you need before starting.

## Where to start tomorrow

1. **Free disk space first.** `C:` has around 1 GB free. Docker timed out twice today and a
   build failed outright with `No space left on device`. `docker system prune -a` and
   clearing old `node_modules` elsewhere are the usual wins.
2. `docker compose up -d db` then `pnpm dev`, and sign in at http://localhost:3000/admin.
3. Read the two open questions under **Decisions waiting on you** below.
4. Start **M6 — Media and SEO** ([docs/ROADMAP.md](./docs/ROADMAP.md)).

## What exists today

Six milestones are finished, each verified against a running Site and a real database
rather than assumed.

| | Milestone | What it means |
| --- | --- | --- |
| ✅ | **M0** Foundations | pnpm/Turborepo monorepo, Postgres + Drizzle, `pnpm setup` wizard, Dockerfile and compose |
| ✅ | **M1** Layout engine | Slot → Section → Column → Block as one validated JSON document; `defineBlock`; renderer |
| ✅ | **M2** The Editor | Split view, drag between Columns and Slots, forms generated from field declarations |
| ✅ | **M3** Draft, publish, history | Edits invisible until published; every publish snapshots; restore into the draft |
| ✅ | **M4** Auth, roles, installer | Better Auth, Owner/Author, Slot locking enforced server-side, two-mode web installer |
| ✅ | **M5** Pages, Menus, Theme | Path routing, the Menu entity, `theme.ts` → CSS variables, responsive navigation |

### Proven, not assumed

- **The permission boundary holds when the client lies.** The Slot policy was changed
  server-side *after* a page had loaded; the browser still believed the Slot was editable,
  deleted a Block and saved, and the server refused. Nothing was written.
- **Publishing is isolated.** A draft edit left `published_layout` untouched and the public
  page unchanged until Publish.
- **Generated layouts cannot invent Blocks.** Pointing a Block at an unregistered type made
  the whole document fail validation, which is the guarantee AI Presets depend on
  ([ADR-0007](./docs/adr/0007-ai-generated-presets.md)).
- **A Theme rebrands everything.** Editing only `starter/theme.ts` changed colour, type and
  spacing across all three Pages, with no Block touched.
- **Routing.** `/`, `/about`, `/contact` serve; an unknown path 404s; an unpublished Page is
  a 404 to a visitor.
- 20 tests pass, four of them against the real database.

## Not finished

Honest list. None of it is hidden behind a green tick.

- **Mobile navigation is verified structurally, not visually.** The drawer markup and the
  720px rules are present and correct, but the browser would not actually resize during
  testing, so nobody has *seen* the drawer open. **Check this on a phone width first thing.**
- **Provisioning mode of the installer is untested.** Onboarding mode was walked end to end
  (you did it). The no-database path writes `.env` and applies migrations, but it has never
  been run, because this machine already had a database configured.
- **An invalid layout still fails whole.** One bad Block renders an empty Page with an error
  instead of dropping the offending Block and rendering the rest. Fine while you are the only
  Author; wrong for a client Site. Worth fixing before the first handover.
- **`renamePage` has no UI.** The action exists and is Owner-guarded; nothing calls it.
- **Sidebar Slot has no styling of its own.** It renders, but no Page uses it meaningfully.
- **No caching anywhere.** Every request reads the database. Correct, and slow at scale —
  deliberate until a Site needs otherwise.
- **Deleting a Page deletes its history** (cascade). It asks for confirmation, and that is
  the only safety net.

## Decisions waiting on you

1. **Where do uploaded images go for the first real Site?** M6 builds the `StorageAdapter`
   with an S3/R2 implementation and a local-disk one. Which is the default in the Starter —
   R2 (needs an account, works on any host) or local disk (no account, ties a Site to its
   machine)? My recommendation: **R2 as the default, local disk as the documented fallback.**
2. **Does the contact form at M6.5 need a spam service?** The plan is honeypot + timing +
   rate limit, no CAPTCHA. That is enough for a brochure site and keeps the page accessible.
   Say so now if you want a CAPTCHA, because it changes the form's markup.

## Next up — M6, Media and SEO

- `StorageAdapter` (`put`/`get`/`delete`) with S3/R2 and local-disk implementations
- Real image uploads and a media library in the Dashboard; the image Block stops taking a URL
- Per-Page SEO title, description and social share image
- Generated `sitemap.xml` (published Pages only) and `robots.txt`

**Done when:** you upload an image in the Dashboard, it appears on the published page, and
`/sitemap.xml` lists exactly the published Pages.

Then **M6.5 Forms and email**, which is the last thing standing between this and a Site you
can hand to a paying client.

## Things to know before you touch the code

- **Read [CONTEXT.md](./CONTEXT.md).** Slot, Section, Column, Block, Block Type, Preset and
  Author all mean something specific. "Module" and "template" mean nothing.
- **Eleven ADRs are in [docs/adr/](./docs/adr/).** Each records what was rejected and why.
  If you find yourself proposing a free-positioning canvas or a Supabase feature, the reason
  it was rejected is already written down.
- **The registry cannot cross the server/client boundary.** It holds React components and
  Zod schemas. Both sides import `blocks.config.ts` directly. This has bitten once already.
- **The database lives behind `@mimnets/core/db`**, never the root import, or a Postgres
  driver ends up in the browser bundle.
- **Server actions are the boundary, not the Editor.** Every mutation re-checks role and
  re-validates the layout. Adding a new action means adding those checks.

## Running it

```bash
docker compose up -d db     # Postgres, stack name mimnets-multisite
pnpm dev                    # http://localhost:3000
pnpm seed                   # rebuilds the three demo Pages and the main Menu
pnpm test                   # 20 tests
pnpm typecheck              # 4 packages, strict
```

Signed in as `mdmonirulislammonir@gmail.com` (Owner). The Site is installed, so `/install`
redirects away and public sign-up returns 403 — both by design.
