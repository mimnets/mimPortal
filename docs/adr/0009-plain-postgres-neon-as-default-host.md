# Plain Postgres, Neon as the default managed host

A Site talks to plain Postgres through Drizzle and uses no provider-specific features — no
vendor auth, no vendor storage buckets, no row-level-security policies, no edge functions.
The connection string is the entire integration, so moving a Site between a managed
provider and a container on a VPS is a configuration change.

**Neon is the default managed host.** The deciding factor is the one-database-per-Site rule
from [ADR-0001](./0001-packaged-template-cloned-per-site.md): cost has to be read per
*additional Site*, not per database. Neon's free tier covers on the order of a hundred
projects and scales compute to zero when idle, which matches a portfolio of low-traffic
brochure Sites almost exactly. Supabase's free tier covers two projects and pauses inactive
ones — a client's quiet Site going to sleep for a week is not an acceptable failure mode —
and its paid tier is priced per organization with per-project compute on top.

The comparison is also less close than it looks, because most of what Supabase charges for
is what this product deliberately builds itself: authentication is Better Auth, file storage
goes through the StorageAdapter to S3-compatible storage, and there is no realtime
requirement. Choosing Supabase would mean paying for a platform whose distinguishing
features are the ones we do not use.

## Consequences

- No Postgres extension or provider feature may become load-bearing without revisiting this.
  The moment a Site depends on one, the deployable stops being portable.
- Provider pricing moves. Because the integration is a connection string, re-checking it is
  a purchasing decision each year rather than a migration.
- Local development and self-hosting run the same plain Postgres in Docker, so there is no
  behavioural gap between a developer machine, a VPS and the managed provider.
