# @mimnets/blocks

## 0.4.0

### Minor Changes

- c2d1c73: A contact form can ask more than name, email and message. **This adds a database column, so
  an upgrading Site must run its migrations.**
  
  The contact Block takes an `extras` list: a question, an answer kind (one line, several lines,
  phone, email, number) and whether it is required. They are asked after the message, shown above
  it in the Dashboard, and included in the notification email above the message — because a phone
  number or a preferred date is what an Owner scans for, and the message is what they then read.
  
  Name, email and message stay and are not in that list. They are what an enquiry *is*: the
  Dashboard shows them as the sender, the notification is addressed from them, and the reply
  button needs the address. A form that could remove them would produce enquiries nobody can
  answer.
  
  **The inputs are named by position — `x_0`, `x_1` — not by the question.** An input's `name`
  comes back as visitor input, so if the label were the name, a form post could invent a question
  nobody asked and have it stored beside the real ones, in an Owner's inbox, looking exactly as
  legitimate. The server reads the labels from the *published* Block at the same index and pairs
  them up; anything posted that does not correspond to a declared question is dropped. This is the
  same rule that moved `recipient` out of the markup, applied to the same class of problem.
  
  A consequence worth knowing: reordering the questions on a Block changes what future visitors
  are asked and leaves what past ones said alone, because an Enquiry stores the label it was
  answered under rather than looking it up on read.
  
  `@mimnets/core` gains `extraFieldName`, `extraAnswers`, `FORM_EXTRA_PREFIX` and the
  `ExtraAnswer` type.
  
  **Upgrading an existing Site:**
  
  1. Run `pnpm db:migrate`. The migration adds one nullable-by-default `jsonb` column to
     `form_submissions`; it is additive and needs no downtime.
  2. Nothing else. Every existing contact form declares no extra questions and behaves exactly
     as it did, and every stored enquiry reads back with an empty list.

### Patch Changes

- Updated dependencies [c2d1c73]
  - @mimnets/core@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies
  - @mimnets/core@0.3.0

## 0.2.0

### Minor Changes

- 248dd62: Eight Block Types, taking the standard library from fourteen to twenty-two: accordion, image
  gallery, carousel, location map, video, Markdown prose, comparison table and social links.
  
  Five are built on the browser rather than on JavaScript — `<details>`, `:target`,
  scroll-snap, sandboxed iframes and a real `<table>` — so `@mimnets/blocks` still has one
  dependency and still contains no client component, and all of it renders on the server.
  
  Three are security boundaries. The video Block allowlists its iframe hosts rather than
  framing whatever address an Author pasted. The social links row parses every address and
  drops anything that is not http, https, a real email or a real phone number. Prose parses
  with markdown-it at `html: false`, so raw HTML is never admitted rather than admitted and
  scrubbed.
  
  `@mimnets/core` gains `renderMarkdown` and `markdownToText`, the shared renderer that
  ADR-0011 requires both the public Site and the Editor preview to use, and takes `markdown-it`
  as a new runtime dependency for it.
  
  It also gains `safeHref`, which reduces an address an Author typed to one a browser may
  follow — http, https, mailto, tel, or a relative path, and nothing else. Every Block that
  turns a field into an `href` now goes through it, including the call to action and the
  pricing plan, which took a free-text address and passed it straight to an anchor.
  
  `@mimnets/blocks` now ships its own stylesheet at `@mimnets/blocks/blocks.css`, the way
  `@mimnets/admin` already ships `editor.css`. Every Block's structural CSS moves out of each
  Site's `globals.css` and into the package, so a Site that upgrades to new Block Types receives
  something to draw them with rather than the components alone. It is written entirely against
  Theme tokens and is imported above a Site's own stylesheet, so anything the Site says still
  wins.
  
  **Upgrading an existing Site:** add `import "@mimnets/blocks/blocks.css";` above
  `import "./globals.css";` in `app/layout.tsx`, then delete the Block sections from that Site's
  `globals.css`, keeping only what the Site itself renders.
- 248dd62: Eleven token families where a Theme could express six, and Block variants built on top of
  them. A Theme could say colour, two typefaces, one corner radius and two spacing values;
  one radius token did the work of twenty-six rules and there was no shadow token at all.
  
  `elevation`, `radius` as a five-step scale, `border` as three weights, `surface` as one of
  four keywords, and `texture` as grain or nothing. Two looks are composed from them: a `mesh`
  Section tone, four soft radials of the Site's own brand colours, and a `gradient` Block tone
  that clips a run between them to a heading's glyphs. Both are CSS only.
  
  The highest-value line in it is one `color-mix()`: every card, quote and plan now carries a
  shadow mixed from that Site's own primary rather than grey. `surface` is one word that
  redraws four Block Types at once.
  
  **Variants.** `defineBlock` takes `variants`, the registry builds the enum per Block Type,
  the renderer emits `data-variant`, and the Editor generates the control the same way it
  generates every settings form. The testimonial has three looks with byte-identical markup
  and no change to its `render`.
  
  The first declared variant is what the Block already looked like, and is the default. That
  is what let this ship without migrating a stored Page, and it is the rule to keep when the
  rest of the library gets variants. Note that the `variants` array is therefore an ordered,
  storage-affecting contract: reordering it restyles every Block that has not been re-saved.
  
  **Two fields are gone, and one of them was on every Page ever written.** A button's look was
  `props.style` and prose's was `props.width`. Neither Block Type declares those fields any
  more, and an undeclared key is stripped in silence — so without a migration every accent
  button on every Site would have come back primary with no error and nothing in a log.
  
  `variantWasField` names the old field and the registry lifts the value across as a Page is
  read. An explicitly chosen variant always wins, so a Page saved once never consults the old
  field again, and a Page rewrites itself into the new shape the next time an Author saves it.
  There is no database migration and no script. **Nothing is required of an upgrading Site**,
  but the hook is deletable once every Site has re-saved its Pages, and worth deleting then.
  
  **Two enums grew**, which is the change that can break every stored layout. `SECTION_TONES`
  gained `mesh` and the Block tones gained `gradient`. Both are defaulted *and* caught, so a
  Section carrying a tone this Site does not know is repainted rather than blanking the Page —
  which matters when a Shared Slot is published from a Site running a newer version of these
  packages than the one reading it.
  
  **A Theme derives what it can check** (ADR-0019). `elevation`, the mesh and the text gradient
  are absent from `themeSchema` entirely and always derived: a `box-shadow` has no shape a
  regex can check, and every one of these is compiled into a `<style>` tag on every Page.
  `surface` and `texture` are accepted, because a closed set of words is a design choice rather
  than a string.
  
  **Upgrading an existing Site:** nothing is required. A Theme that states only what it stated
  before gets the derived scales for free, and stored Pages keep the looks they had. To take
  the new families, add any of `radius`, `border`, `surface` or `texture` to `theme.ts` — each
  scale derives from the one `base` value you state, rather than merging onto the default's, so
  a Site asking for square corners gets them all the way down.
- 248dd62: The last two pieces of M11: a Section can shape its bottom edge, and a Block can offer a
  choice between the Theme's own colours.
  
  **Section dividers.** `divider` on a Section is `"none"`, `"angle"` or `"curve"`, and the
  renderer emits `data-divider` for the last two. It is a Section property rather than a Block
  one because the edge belongs to the band (ADR-0013), and two shapes rather than an angle in
  degrees so a Site cannot draw one steep enough to eat its own content.
  
  The shape is on a pseudo-element and never on the Section itself. That matters to anyone
  styling their own Sections: `clip-path` on a Section would establish a containing block for
  fixed and absolutely positioned descendants, which traps things like a lightbox or a menu
  inside the band they sit in. The edge inherits the band's colour, so a Section on the page
  background draws nothing.
  
  **`field.token`.** A new field kind whose value is the name of a Theme colour, not a colour.
  `field.token({ tokens: ["accent", "primary"], default: "accent" })` — the Block Type narrows
  the list to what reads where it will be used, and `COLOR_TOKENS` is the full set. There is
  still no `field.color` and there should not be. The Editor generates a picker with a swatch
  from the declaration, like every other control.
  
  `eyebrowBlock` is the first to use it. Its colour was hard-coded to `--mn-color-accent` and
  `accent` is the default, so **no eyebrow on any Site changes colour**.
  
  **Upgrading an existing Site:** nothing is required. Both enums default and catch, so Pages
  written before either existed parse unchanged. A Site with its own stylesheet that styles
  `.mn-eyebrow` should know it now carries a `data-colour` attribute; a Site that has forked
  `blocks.css` will want the four `[data-colour]` rules and the `[data-divider]` block.

### Patch Changes

- Updated dependencies [248dd62]
- Updated dependencies [248dd62]
- Updated dependencies [9fc4606]
- Updated dependencies [248dd62]
  - @mimnets/core@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies
  - @mimnets/core@0.1.1

## 0.1.0

### Minor Changes

- The packages build before they ship.
  
  Until now they exported TypeScript source and the Starter compiled it, which
  `next.config.ts` recorded as a deferral: "consumed as TypeScript source until M8 adds
  a build step". A published package has no such arrangement with its consumer, so each
  one now emits JavaScript and declarations to `dist`, and ships only that.
  
  Development still reads the source. `exports` points at `src` for anyone working in
  the monorepo, and `publishConfig.exports` swaps to `dist` at publish time — so a test
  run cannot pass against a stale build, and an installed package never carries a `.ts`
  file the consumer would have to compile.

### Patch Changes

- Updated dependencies
  - @mimnets/core@0.1.0
