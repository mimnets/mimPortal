# One deployable, host-agnostic

A Site is a single deployable application. The public renderer, the Dashboard and the data
access all live in one Next.js app rather than a separate frontend and backend deployed to
different hosts.

Splitting them would put a network hop between the renderer and the database on the path of
every public request, which is the one path that has to be fast under
[ADR-0002](./0002-layout-stored-as-data-and-rendered-at-runtime.md). It would also double
the deployment surface at exactly the wrong multiple: Sites are independent
([ADR-0001](./0001-packaged-template-cloned-per-site.md)), so ten clients would mean twenty
services, twenty sets of environment variables and two sets of logs each, maintained by one
person. The App Router already is the backend — server components read the database
directly, route handlers serve the Dashboard's mutations — so separating them buys an
internal HTTP API, CORS, and token plumbing that nothing outside the app ever consumes.

Portability is the real goal behind the question, and it is bought differently: the Starter
builds to a standalone server bundle and ships a Dockerfile, so a Site runs on a container
host, a plain Node process, or a serverless platform without code changes. The host becomes
a per-Site deployment choice rather than an architectural commitment.

## Considered Options

- **Next.js frontend on one host, a separate API service on another** — rejected for the
  reasons above. The cost lands on every page view and on every client added.
- **A separate backend service later, if one is genuinely needed** — still available. A
  background worker (scheduled publishing, image processing, long-running AI generation) is
  a legitimate second deployable, because it is not on the request path. That is a different
  decision from splitting the app in two, and can be made when the need is real.

## Consequences

- A Site needs a host that runs a server; static-only hosting was already ruled out by
  ADR-0002.
- Vercel's Hobby plan forbids commercial use — which includes client work — so client Sites
  need a paid plan or a different host. This is a hosting bill, not an architecture problem,
  precisely because the deployable is portable. See [HOSTING.md](../HOSTING.md).
