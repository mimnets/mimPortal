# @mimnets/core

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
- 9fc4606: Button and band text now picks black or white by measuring which one actually reads, rather
  than by comparing brightness to a fixed threshold. **This changes visible output on any Site
  that has not stated `onPrimary` or `onAccent` itself.**
  
  `readableOn` compared relative luminance to `0.55`, which was far too high. Counted across
  every button colour the product ships — the built-in default, the Starter, and the three
  ready-made designs — **five of ten were below the 4.5:1 that normal text needs**. All five
  were accent colours, and every one of them passes comfortably in black:
  
  | Colour | Was (white) | Now (black) |
  | --- | --- | --- |
  | `#d08a1e` Larder accent | 2.86:1 | 6.60:1 |
  | `#f0568c` built-in accent | 3.27:1 | 5.77:1 |
  | `#b0813b` Chambers accent | 3.47:1 | 5.44:1 |
  | `#f43f5e` Signal accent | 3.67:1 | 5.14:1 |
  | `#e05a26` Starter accent | 3.71:1 | 5.09:1 |
  
  Every primary colour is unchanged.
  
  **It is not a lower threshold, deliberately.** The textbook crossover is `0.1791`, and the
  product's own default primary `#3b6cf6` sits at `0.1831` — just the wrong side of it, where
  white reaches 4.50 and black only 4.19. Lowering the number would have made that button worse.
  Any threshold has an edge like that somewhere; comparing the two ratios has none.
  
  `defaultTheme` stated `onAccent: "#ffffff"` explicitly, which is the value this was wrong
  about, so it is now `#111111` — the same answer the rule gives.
  
  **Upgrading an existing Site:** nothing is required, and most Sites should simply look better.
  If a Site wants its old button text back, state it: `onPrimary` and `onAccent` are still
  accepted in `theme.ts` and an explicit value is always kept. Worth a look at any Site with a
  mid-tone accent, since that is where the text will have flipped.
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

## 0.1.1

### Patch Changes

- The local storage adapter keeps the content type it was given.
  
  `put` is handed a `contentType` and was discarding it; `get` guessed from the key's
  extension instead, which is right for the images a Site uploads and wrong for anything
  else — it returned `application/octet-stream` for a type it had actually been told.
  
  The S3 adapter has always stored it, so the two implementations disagreed, and a Site
  moving from the disk to a bucket changed behaviour for a reason nobody could see. The
  declared type is now kept beside the object; objects written before this fall back to
  the extension, which is exactly what they used to return.

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
