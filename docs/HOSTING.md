# Hosting a Site

A Site is one deployable ([ADR-0008](./adr/0008-one-deployable-host-agnostic.md)) plus one
Postgres database of its own ([ADR-0001](./adr/0001-packaged-template-cloned-per-site.md)).
It builds to a standalone Node server and ships a `Dockerfile`, so the host is a per-Site
choice you can change later without touching code.

There are two supported paths. Both are in the repository; neither is more "real" than the
other.

## Path A — Self-hosted, all Docker

Everything on one machine: the app and its database, on a VPS you rent for a flat monthly
fee. One box hosts many Sites.

```bash
docker compose --profile full up -d     # app on :3000, Postgres beside it
```

- **Cost:** flat. One small VPS hosts several Sites and the price does not move when a Site
  gets busy.
- **You own:** TLS certificates, backups, uptime, OS updates. This is the real price, and it
  is paid in attention rather than money.
- **Good for:** the third client onward, and for anyone who wants no external dependency.

The same file runs the database alone, which is what local development uses:

```bash
docker compose up -d db
```

## Path B — Managed host + managed Postgres

The app on Vercel (or Render, Fly, Railway), the database on Neon. Nothing to administer.

- **Cost:** per platform, and it grows with Sites and traffic.
- **You own:** nothing operationally.
- **Good for:** the first paying client, and anything where your time costs more than the
  bill.

### The commercial-use trap

**Vercel's Hobby plan does not permit commercial use, and that explicitly includes client
work** — a site you were paid to build is commercial before it earns the client anything.
Client Sites need Pro, which is billed per team member rather than per project, so one paid
seat covers many Sites. Render, Fly and Railway have no equivalent restriction; Render's
free web services sleep when idle, which is fine for staging and unacceptable for a client's
live site.

## Database: Neon, not Supabase

The decision turns on one database per Site, so read the cost per *additional Site*.

| | Neon | Supabase |
| --- | --- | --- |
| Free tier | ~100 projects, 0.5 GB each, scales compute to zero when idle | 2 projects, 500 MB, **inactive projects pause** |
| Paid shape | Usage-based: compute by the hour plus storage | From ~$25/mo per organization, plus per-project compute |
| Idle Sites | Cost almost nothing | Pause, then need waking |
| Fit here | One project per Site, most of them quiet | Runs out at the second Site |

A portfolio of brochure Sites is mostly idle, mostly small, and numerous — which is exactly
the shape Neon prices well and Supabase does not.

The comparison is also narrower than it appears. Supabase's strengths are its auth, storage,
realtime and edge functions — all of which this product deliberately provides itself
(Better Auth, the StorageAdapter to S3/R2). Picking Supabase would mean paying for the parts
we don't use. See [ADR-0009](./adr/0009-plain-postgres-neon-as-default-host.md).

**Either way, it is plain Postgres.** No provider feature is load-bearing, so switching
providers — or moving a Site from Neon to the Postgres container in Path A — is a connection
string and a `pg_dump`.

## Recommended sequence

1. **Building (M0–M7):** Path A locally. `docker compose up -d db`, no accounts, no bill.
2. **First paying client:** Path B. Vercel Pro plus a Neon project. Price the seat into the
   work.
3. **Third client onward:** Path A on a VPS, with Neon kept for any Site that needs managed
   backups. The Dockerfile already exists, so this is a deployment change and nothing more.

## What is never free

Uploaded images (S3/R2) and AI generation (each Site's own API key) are usage-billed from
the first client. Both are small at this scale, and both are per Site by design, so one
client's usage can never bill another's.

**Verify current prices and terms before committing a client.** Every figure on this page is
a snapshot, and this is the part of the stack that changes most often.
