# The Editor is ours, because the Block Type is

`packages/admin` is written here rather than built on Puck, GrapesJS or ui-builder. The
reason is not the drag-and-drop, which any of them would have supplied. It is
`defineBlock` — the interface a Block Type declares itself through, which the Editor reads
to generate settings forms, which the Zod schemas validate against, and which M9's Preset
prompt is generated *from*. An Editor library brings its own component configuration, so
adopting one means either keeping two registries in step or writing an adapter between
them, and the adapter is exactly where the Preset guarantee — *a model cannot invent a
Block Type that does not exist* — would quietly stop holding.

This ADR exists because the alternative was never written down. ADR-0001 recorded
"multi-tenant builder" and "single template repo" as the options it rejected; "use an
existing editor library" was not among them, and a contributor arriving at 3,264 lines of
hand-written editor is entitled to ask why. The honest answer is below, including the part
that does not flatter the decision.

## Considered Options

**Editor libraries** — packages that supply a drag-and-drop editing interface and nothing
else (see [CONTEXT.md](../../CONTEXT.md), *Prior art*).

- **Puck** (MIT, React) — the closest fit by far, and the one to keep watching. Rejected:
  it replaces `packages/admin` only. No storage, no accounts, no draft/publish, no media,
  no forms — every milestone from M3 onward stays ours, and its component config would sit
  alongside `defineBlock` rather than replacing it.
- **GrapesJS** (BSD-3, vanilla JS) — the largest of them. Rejected: it edits HTML and CSS
  with a style manager, which is a free canvas in a different costume and contradicts
  [ADR-0003](./0003-sections-and-columns-not-free-canvas.md). Wiring a vanilla-JS editor
  into a React Server Component tree is cost with nothing bought.
- **ui-builder** (MIT, shadcn) — the nearest in spirit: a component registry, Zod, JSON
  layouts. Rejected: it names "multi-page publishing workflow" among its non-goals, which
  is M3, M5 and most of what a Site is. Its 124 block templates are shadcn components, not
  Block Types, so they answer a different question.
- **open-design** (Apache-2.0) is not in this list. It is a local-first desktop app that
  turns coding agents into a design engine and exports HTML, PDF, PPTX and MP4. It has no
  notion of a deployed Site with its own database and hands no client a Dashboard.

**Content platforms** — the projects that actually have the database, the accounts, the
media library and the publish workflow. These are the harder question, and the one a
contributor is more likely to ask.

- **Payload** (MIT, 44.6k★) — installs directly into an existing Next.js `/app` folder,
  with a Postgres adapter, authentication, uploads, versions and drafts, live preview and
  a block-based layout builder. Rejected for the Editor: its admin is field-based forms,
  so a layout is a repeating list of blocks in a panel rather than a preview an Author
  rearranges — and the roadmap calls that preview "the product". See *Consequences*, where
  this option costs more than a bullet.
- **Directus** (37.7k★) — a Studio over any SQL database, deployed as a separate service
  rather than inside the Site. Rejected twice: [ADR-0008](./0008-one-deployable-host-agnostic.md)
  wants one deployable per Site, and its Monospace Sustainable Core License gates use by
  the organisation's revenue and headcount. A Site is handed to a client, so a licence
  whose terms depend on how large that client grows is a liability we would be shipping.
- **TinaCMS** (Apache-2.0) — git-backed, with genuine inline visual editing. Rejected: an
  edit is a commit to Markdown in the repository, so publishing means a rebuild. That is
  the direct negation of [ADR-0002](./0002-layout-stored-as-data-and-rendered-at-runtime.md),
  and an Author who cannot fix a typo without a deploy is not the Author we defined.
- **Builder.io** — the SDKs are MIT; the visual editor is hosted SaaS and the content
  lives on their servers. Rejected: [ADR-0001](./0001-packaged-template-cloned-per-site.md)
  makes each Site self-contained — own database, own domain, own deploy — and a Site whose
  content is a third party's hostage is not a Site we can hand over.

## Consequences

- **Every drag-and-drop bug is ours.** Puck has thirteen thousand users finding its edge
  cases; `packages/admin` has one. The mitigation is that the Editor is deliberately small
  — Sections and Columns, no nesting, no free positioning — and each of those constraints
  was chosen before this ADR for its own reasons. A large editor built alone would be the
  wrong trade; this one is defensible because ADR-0003 already made it narrow.

- **The Block library must never compete on volume, and this is the live risk.** GrapesJS
  has a plugin ecosystem and ui-builder ships 124 templates; twenty-two Block Types will
  not out-number either, ever, and the moment M8.5 is read as a race toward more it has
  been misread. The exit criterion M8.5 wrote for itself is the right one — *a plausible
  landing page for three industries without writing a custom Block* — because it measures
  fit, not count. `sites/ledger` shipping its own filing-deadline table is the model
  working, not a gap in the library.

- **Payload deserved an evaluation and never got one, and the decision is narrower than it
  looks.** What is defended above is the Editor: nothing in the field-based admin gives an
  Author a preview to rearrange, so M1, M2 and M8.5 would have been built regardless. The
  rest is not so clean. Payload had authentication and roles, uploads and a media library,
  versions and drafts, and a Postgres adapter — most of M3, M4 and M6, plus the storage
  abstraction — and we wrote them without checking. The verdict stands, because the Editor
  is the product and the packaging in ADR-0001 wants the data model to be ours; but it
  stands on a narrower base than "we compared and chose", and a future reader should know
  that. If a second product ever starts here, Payload is the first thing to cost.

- **Inline text editing is cheaper than it looks, and Puck has already shown the shape.**
  After-M9 item 2 appeared to threaten the fact that `packages/blocks` contains no client
  component. It does not. Puck 0.20 makes a field `contentEditable`, and its string prop
  becomes a `ReactNode` when rendered inside the editor but stays a string in its public
  renderer — the same split Mimnets already has, since `packages/admin/src/Preview.tsx` is
  a client component calling each Block Type's real `render`, while
  `packages/core/src/render/render.tsx` runs on the server. So the work is widening a text
  field to `string | ReactNode` and having the preview pass an editable node; the Block
  Types stay as they are, and the public path stays server-rendered.

- **Puck is worth re-reading at each of its releases.** It is the only one of the eight
  solving the same problem as `packages/admin`, and it is where this decision would first
  start to look wrong.
