# Mimnets

A TypeScript product for building websites you hand to clients.

Mimnets is **not** a single website and **not** a hosted site builder. It is a set of
versioned packages plus a Starter app. You clone the Starter once per client, and that
clone is a complete website with a Dashboard where content, layout and theme are changed
without touching code. Fixes made here reach every Site through a dependency upgrade.

> **Status: M0 complete.** The monorepo, database and build pipeline are up and verified.
> M1 — the layout schema and the first Block Types — is next. See
> [docs/ROADMAP.md](./docs/ROADMAP.md).

## Installation

### Prerequisites

| | Needed for | Check |
| --- | --- | --- |
| **Node 20+** | everything | `node -v` |
| **pnpm 10+** | everything | `pnpm -v` — or `corepack enable` |
| **Docker** | the local database, and self-hosting | `docker info` — optional if you use Neon or Supabase |

### Install and set up

```bash
pnpm install
pnpm setup
pnpm dev          # http://localhost:3000
```

`pnpm setup` is the first-run wizard. It is self-paced, re-runnable, and never writes
anything it has not first verified:

1. **Reads `starter/.env`.** If a database is already configured it offers to keep it, and
   checks it still answers before moving on.
2. **Detects Docker.** If the daemon is running, option 1 starts Postgres in a container,
   waits for it to accept connections, and needs no further input. If Docker is installed
   but stopped, it says so and waits for you to start it.
3. **Otherwise asks for a connection string** — Neon, Supabase or any other Postgres. It
   tells you where to find it, connects to prove the string works, and only then writes
   `.env`. Paste something that is not a connection string and it explains what you pasted
   rather than failing with a driver error.
4. **Applies the migrations.**

Both managed providers are plain Postgres here, so either works. Note that Supabase wants
its **connection string** (Project Settings → Database → Connection string → URI), not an
`anon` or `service_role` key — this project never uses Supabase's REST client. Neon is the
default recommendation, for reasons in
[ADR-0009](./docs/adr/0009-plain-postgres-neon-as-default-host.md).

### Commands

| Command | What it does |
| --- | --- |
| `pnpm setup` | First-run wizard: find a database, write `.env`, migrate |
| `pnpm dev` | Run the Site at http://localhost:3000 |
| `pnpm build` | Production build (standalone output) |
| `pnpm typecheck` | Type-check every package |
| `pnpm db:generate` | Turn a schema change into a migration file |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm changeset` | Record a change for the next package release |

### Running the database yourself

```bash
docker compose up -d db            # Postgres only — what pnpm dev expects
docker compose --profile full up   # the whole Site, app and database, self-hosted
docker compose down                # stop; add -v to delete the data too
```

The stack is named `mimnets-multisite`. Running more than one Site on the same host needs a
distinct name and port per Site:

```bash
COMPOSE_PROJECT_NAME=client-a docker compose up -d db
```

Deployment options and their costs are in [docs/HOSTING.md](./docs/HOSTING.md).

### If something goes wrong

| Symptom | Cause and fix |
| --- | --- |
| `failed to connect to the docker API` | Docker Desktop is not running. Start it, then `pnpm setup` again. |
| `Bind for 0.0.0.0:5432 failed: port is already allocated` | Another Postgres owns the port. Stop it, or change the published port in `docker-compose.yml`. |
| `password authentication failed` | The password is missing from a pasted connection string — Supabase's UI shows a placeholder, not your real password. |
| Setup wrote the wrong database | Run `pnpm setup` again and answer `n` to "Keep it?". |

## Vocabulary

Mimnets uses a small number of words precisely. Read [CONTEXT.md](./CONTEXT.md) before
reading anything else — `Slot`, `Section`, `Block`, `Block Type` and `Preset` all mean
specific things here, and "module" and "template" mean nothing.

## How a Page is built

A Page is a tree, not a canvas. Blocks sit in Columns, Columns sit in Sections, Sections
sit in Slots:

```
PAGE  /about
├── Slot: header        [locked]
│    └── Section [1 column]
│         ├── Logo block
│         └── Menu block          → renders the "Main" Menu
├── Slot: main
│    ├── Section [2 columns]
│    │    ├── Column 1 → Heading block, Text block
│    │    └── Column 2 → Image block
│    └── Section [1 column]
│         └── Video block
└── Slot: footer        [locked]
```

Authors drag Sections to reorder them, choose each Section's column layout, and drag
Blocks between Columns. Columns stack vertically on narrow screens, so responsive
behaviour is automatic rather than authored. There is no absolute positioning
([ADR-0003](./docs/adr/0003-sections-and-columns-not-free-canvas.md)).

The whole tree is stored as one JSON document per Page and rendered by the server on
request, so an edit is live the moment it is published — no build step
([ADR-0002](./docs/adr/0002-layout-stored-as-data-and-rendered-at-runtime.md),
[ADR-0004](./docs/adr/0004-page-layout-as-a-single-json-document.md)).

## Block Types are defined once

The single most important interface in Mimnets. A Block Type declares its editable fields
and its rendering in one place; the Editor generates the settings form from the field
declarations. Adding a Block is minutes of work, not a day:

```ts
defineBlock({
  name: "heading",
  fields: {
    text:  field.text({ label: "Heading text" }),
    level: field.select({ options: ["h1", "h2", "h3"], default: "h2" }),
  },
  render: ({ text, level }) => <Heading as={level}>{text}</Heading>,
});
```

Blocks are styled against Theme tokens, never hardcoded colours — that is what lets one
Block library look like five different brands.

## Presets

A **Preset** is a Theme plus a set of starting Page layouts, generated by a model and
picked from a handful of options. An Owner applies one when scaffolding a new Site; an
Author may apply one to a single Page, which writes to that Page's Draft and snapshots the
previous version first.

This is safe for a reason worth understanding: a Preset is Block JSON validated against
the same Zod schemas the Editor writes through. The model cannot invent a Block Type that
does not exist — invalid output is rejected before it is stored, so there is no failure
mode where generation breaks a live Site.

Generation is provider-agnostic with `claude-opus-5` as the default. The model is an
Owner-only Site setting, each Site holds its own API key, and an Author never sees a model
dropdown ([ADR-0007](./docs/adr/0007-ai-generated-presets.md)).

## Repository shape

```
mimnets/                            ← this repo (the product)
├── packages/
│   ├── core/          layout schema, block registry, renderer, storage adapter
│   ├── admin/         the Dashboard and the Editor
│   └── blocks/        standard Block Types: heading, text, image, video, logo, menu
└── starter/           the thin app cloned to create a Site

client-site/                       ← a clone of starter/
├── package.json       depends on @mimnets/core, @mimnets/admin, @mimnets/blocks
├── theme.ts           colours, fonts, spacing — makes this Site look like itself
├── blocks.config.ts   explicit registry: standard blocks + this Site's custom ones
└── blocks/            Block Types only this client needs
```

Sites are independent: own database, own domain, own deploy, own API key. Nothing is
shared at runtime ([ADR-0001](./docs/adr/0001-packaged-template-cloned-per-site.md)).

## Stack

| Concern    | Choice                                                     |
| ---------- | ---------------------------------------------------------- |
| Framework  | Next.js (App Router)                                       |
| Language   | TypeScript                                                 |
| Database   | Plain Postgres — Neon managed, or Docker self-hosted       |
| ORM        | Drizzle                                                    |
| Validation | Zod — shared by the database, the Editor forms and Presets  |
| Styling    | Tailwind wired to Theme tokens                             |
| Auth       | Better Auth (Owner / Author)                               |
| Files      | StorageAdapter → S3 / R2, swappable for local disk         |
| AI         | Provider-agnostic, default `claude-opus-5`, key per Site   |
| Monorepo   | pnpm workspaces + Turborepo + Changesets                   |
| Hosting    | Portable — standalone build + Dockerfile ([HOSTING.md](./docs/HOSTING.md)) |

## People

Two roles, and the difference shapes the data model:

- **Owner** — you. Deploys the Site, writes code, creates and deletes Pages, changes the
  Theme, chooses the AI model, decides which Slots are locked.
- **Author** — the client. Adds, moves and edits Blocks in unlocked Slots, and may apply a
  Preset to a single Page. Cannot create or delete Pages, change the Theme, or touch a
  locked Header or Footer.

Header and Footer Slots are locked by default. Every publish writes a version snapshot, so
a deleted homepage is recoverable.

## Scope

**v1 is finished when** an Author can log in, arrange Blocks across several Pages, publish
them, and the Site renders live with its own Theme, working responsive navigation,
uploaded images, per-Page SEO fields and a sitemap.

The one AI feature inside v1 is a writing assistant in the Editor: write, rewrite, shorten,
generate alt text, draft an SEO description. **Presets come immediately after v1**, once
the Block library is large enough for generated Sites to look genuinely different.

**Deliberately excluded** — Collections, a public chatbot, redirect management, JSON-LD, an
analytics dashboard, a translation UI, and a raw database admin UI (that last one
permanently). The reasoning for each is in
[ADR-0006](./docs/adr/0006-v1-scope-boundary.md).

## Decisions

Read these before proposing a change to the architecture — each records an alternative that
was considered and rejected for a reason.

1. [Packaged Template, cloned per Site](./docs/adr/0001-packaged-template-cloned-per-site.md)
2. [Layout stored as data, rendered at runtime](./docs/adr/0002-layout-stored-as-data-and-rendered-at-runtime.md)
3. [Sections and Columns, not a free canvas](./docs/adr/0003-sections-and-columns-not-free-canvas.md)
4. [Page layout as a single JSON document](./docs/adr/0004-page-layout-as-a-single-json-document.md)
5. [Locale on Page from the start](./docs/adr/0005-locale-on-page-from-the-start.md)
6. [What v1 deliberately excludes](./docs/adr/0006-v1-scope-boundary.md)
7. [AI-generated Presets](./docs/adr/0007-ai-generated-presets.md)
8. [One deployable, host-agnostic](./docs/adr/0008-one-deployable-host-agnostic.md)
9. [Plain Postgres, Neon as the default managed host](./docs/adr/0009-plain-postgres-neon-as-default-host.md)

## Build order

The Editor is built before login. Authentication is a solved problem and slots in later
without changing anything; drag-and-drop editing is the unproven part and is proven first.
Milestones and their exit criteria: [docs/ROADMAP.md](./docs/ROADMAP.md).
