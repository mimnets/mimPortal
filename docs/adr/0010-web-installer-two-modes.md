# The web installer has two modes

A Site can be set up from a browser rather than a terminal. `pnpm setup` remains the
developer path; the web installer exists because Owners stand up Sites without a terminal
to hand, and because clients are handed a link and expected to finish the job themselves.

Those two audiences must not be given the same form. A screen that accepts an arbitrary
Postgres connection string is a credential-entry point and an outbound-connection primitive;
it is appropriate for the person who owns the infrastructure and inappropriate for a client
who was sent a link. So the installer branches on whether the database is already
configured:

- **Provisioning mode** — no `DATABASE_URL` in the environment. The installer asks for a
  database, verifies the connection, applies migrations, then creates the first Owner. This
  is the Owner's path, and it requires a writable filesystem.
- **Onboarding mode** — `DATABASE_URL` is already set, but the Site has never been
  installed. The installer only creates the first account and names the Site. It cannot see
  or change database configuration. This is the client's path.

In both modes the installer disappears permanently once finished: completion writes an
`installed_at` marker to the database, and every route under `/install` refuses to run
while that marker exists. The check is a database read, not a file on disk, so a redeploy
or a fresh container cannot resurrect it.

## Consequences

- **On managed hosting the installer is onboarding-only.** Vercel's filesystem is read-only
  at runtime and configuration cannot be written back, so `DATABASE_URL` must be set as a
  platform environment variable before the first request. Provisioning mode is a
  self-hosted feature ([ADR-0008](./0008-one-deployable-host-agnostic.md)).
- Onboarding mode is reachable by anyone who has the URL before the Site is installed, so
  it is gated by a one-time token generated at first boot and shown in the server logs. The
  Owner passes it to the client with the link.
- Setup logic now exists twice, in `pnpm setup` and in the installer. They must share the
  verification and migration code rather than drift into two behaviours.
