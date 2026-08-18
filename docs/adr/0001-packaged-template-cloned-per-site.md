# Packaged Template, cloned per Site

Each Site is a clone of the Starter rather than a tenant inside one shared
application, because Sites must be free to differ in structure, code and hosting.
To stop those clones from drifting, the Template is published as versioned packages
(`core`, `admin`, `blocks`) that the Starter depends on, so a fix made once reaches
every Site through a dependency upgrade rather than by hand-patching each repo.

## Considered Options

- **Multi-tenant builder** — one deployment serving every Site from a shared database.
  Rejected: every query becomes a data-isolation risk, and Sites could no longer carry
  their own code.
- **Single self-contained template repo** — clone the whole thing, no packages.
  Rejected: five Sites means five divergent copies and five manual bug fixes.

## Consequences

- The repo is a monorepo and the packages must be versioned and published from day one;
  this is real setup cost before the first Site exists.
- A Site can pin an old version of the Template indefinitely, so breaking changes to the
  Block data model have to be handled with migrations, not assumptions.
