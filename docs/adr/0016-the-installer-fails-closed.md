# The installer fails closed, and an outage is a mode of its own

`installMode()` answers with one of four states, not three. `provisioning` means no usable
database is configured. `onboarding` means one exists but nobody has installed the Site.
`installed` means every install route refuses, permanently. And `unavailable` means a
database is configured but cannot be reached right now.

Every install route asks whether the Site is in the mode that route belongs to —
`assertMode("provisioning")`, `assertMode("onboarding")` — rather than whether it is not
installed.

## The failure this exists to prevent

The fourth state is not a refinement. Without it, `installMode()` had one `try` around both
questions it was asking, and any failure returned `provisioning`. An unreachable database
and an unconfigured one were the same answer.

`provisionDatabase` is unauthenticated by necessity: nobody has an account yet, so there is
nobody to authenticate. The mode is the whole of its protection. So a Site whose database
went down for thirty seconds became, for those thirty seconds, a Site that would accept a
connection string from anybody who asked — and then write it to `.env`, apply migrations to
it, and restart pointing at it.

The sign-up endpoint failed the same way for the same reason. It gated on `isInstalled()`,
and an unreachable database answered "not installed", which reopened public registration on
a live Site.

Both are instances of one mistake: **asking a negative question of a system that cannot
answer.** "Is this Site already installed?" has three possible answers — yes, no, and *I
cannot tell you* — and code that branches on a boolean silently merges the third into
whichever is more dangerous.

## What was rejected

- **Catching narrower errors instead.** The original `catch` could have distinguished a
  connection failure from a missing table by inspecting the error. That reads the same
  information out of a string rather than by asking, and it fails open again the first time
  a driver changes a message. Reachability is now a `select 1` asked separately, and the
  remaining `catch` means only one thing: the schema is absent, so migrations have never run.
- **A file on disk recording that the installer has finished.** Rejected at
  [ADR-0010](./0010-web-installer-two-modes.md) and still rejected: a redeploy resurrects it.
  The database is the record.
- **Authenticating the installer.** There is no account to authenticate against during
  provisioning. That is the situation, not an oversight.

## Consequences

- **An outage locks the installer until the database answers.** This is the cost, and it is
  accepted deliberately. A Site whose database is down cannot be reinstalled, reconfigured
  or signed up to — which is correct, because a Site whose database is down is not a Site
  anybody should be making decisions about. Recovery is fixing the database, never the
  installer.
- **`/install` renders an outage page rather than a form** when the mode is `unavailable`.
  Offering the provisioning form there is precisely what let an outage reopen the installer,
  so the page must not fall through to it.
- **A fifth state must not be added by pattern-matching.** Each of these four exists because
  a route refuses differently in it. Anything new has to answer: which route opens, and what
  is the unauthenticated caller allowed to do while it holds?
- **The provisioning error is logged, not returned.** An unauthenticated caller told exactly
  why a connection failed has been handed an outbound port scanner with a friendly interface.
  The caller is told where to find the reason; the server log holds it.
