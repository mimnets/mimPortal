# Mimnets

A TypeScript product for building websites: shared packages plus a Starter cloned once per
Site, each with a Dashboard where content, layout and theme change without touching code.

This file is loaded automatically at the start of every session. It exists to point at the
four documents that hold the real information, so nothing has to be rediscovered.

## Read these, in this order

1. **[docs/FEATURES.md](./docs/FEATURES.md)** — what is built and what is not. Start here to
   know the state of the product. It links a
   [visual overview](https://claude.ai/code/artifact/acf61387-ca91-42ff-bac8-4e3d25d9b30f)
   of the same content.
2. **[HANDOFF.md](./HANDOFF.md)** — where to pick up, and what needs a person rather than a
   session. Read before starting work.
3. **[CONTEXT.md](./CONTEXT.md)** — the glossary. Site, Slot, Section, Column, Block, Block
   Type, Draft, Published, Shared Slot, Enquiry, the four Install modes. These words are used
   precisely; using them loosely is how the code drifts.
4. **[docs/ROADMAP.md](./docs/ROADMAP.md)** — the milestones and what each is for, including
   the exit criterion each was judged against.

`docs/adr/` holds nineteen decision records. They are the answer to "why is it like this?", and
several record what was *rejected*, which is usually the more useful half.

## Each document has one job

They have drifted into each other before — on 5 September the roadmap and the handoff named
different Block Types as the same milestone's remaining work, and only reading the code settled
it. So: FEATURES owns the inventory, ROADMAP owns intent, HANDOFF owns where to pick up,
CONTEXT owns vocabulary. If you are editing the same fact in two of them, one is wrong about
its job.

## Before you touch the code

- **An image field holds a key, never a URL** (ADR-0012). Blocks build their own URL from
  `context.mediaBaseUrl`.
- **An Author is a client**, and everything they type is untrusted input. That is why prose
  parses with raw HTML disabled, the video Block allowlists its hosts, and `safeHref` exists.
- **The registry cannot cross the server/client boundary.** The database lives behind
  `@mimnets/core/db`; storage, email and stock behind their own subpaths, never the root
  import — they read the filesystem, hold API keys and sign with `node:crypto`.
- **A Slot the Page does not own is never written by a Page save** (ADR-0017).
- **A contact form posts to a route handler, not a server action**, because it has to work
  with no JavaScript.

## Running it

```bash
docker compose up -d db      # Postgres, stack name mimnets-multisite
pnpm dev                     # http://localhost:3000
pnpm seed                    # demo Pages, the main Menu, an image, a contact form
pnpm test                    # the count is the thing to read
pnpm typecheck               # 7 tasks, strict
pnpm build                   # must stay warning-free
```

**Stop `pnpm dev` before running `pnpm build`.** A production build overwrites `.next`
underneath a running dev server, which then serves stale JavaScript while its CSS keeps
updating — a convincing disguise for "my change does nothing". It cost an hour on 5 September.

## Working here

- **Verify a fix by breaking it.** Every test written on 5 September was checked by reverting
  the code it covers and watching it fail. Three tests passed against the bug they were meant
  to catch, and one audit finding turned out to be wrong, because of that habit.
- **Two sessions must not share one working tree.** Use a git worktree per session. On
  5 September one session's `git add -A` swept up another's uncommitted feature.
- **Write escapes carefully in heredocs.** `\u0000` written through a shell heredoc became a
  literal NUL three separate times, and git silently reclassifies such a file as binary — no
  diff, no grep, nobody notices.
