# What v1 deliberately excludes

v1 ends at: an Author can arrange Blocks on Pages, publish them, and the Site renders with
its own Theme, menus, images and basic SEO. The following are understood, wanted, and
explicitly out of scope until that is finished and used on a real Site.

- **Collections** (Blog Posts, Products and other structured content types, with Blocks
  that query them) — a second system as large as the Editor.
- **AI Page generation from a prompt** — deferred rather than rejected, and later narrowed to
  Presets by [ADR-0007](./0007-ai-generated-presets.md): once Block Types
  are Zod-validated, generation becomes "emit JSON and validate it", so it is cheap later
  and speculative now.
- **A public-site chatbot** — a different product wearing this one's clothes.
- **Redirect management, JSON-LD, an analytics dashboard** — analytics in particular stays
  out permanently; Sites embed an existing analytics tool instead.
- **A generic database admin UI** — rejected outright, not deferred. Raw table access
  handed to an Author is a data-loss incident waiting for a slow afternoon.
- **A translation UI** — see ADR-0005; the column exists, the feature does not.

## Consequences

The Dashboard shipped in v1 will look thin next to the original brief. That is the point:
the Editor is the risky, unproven part, and it is finished first.
