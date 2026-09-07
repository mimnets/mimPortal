# @mimnets/admin

## 0.4.0

### Patch Changes

- Updated dependencies [c2d1c73]
  - @mimnets/core@0.4.0

## 0.3.0

### Minor Changes

- The Editor's preview paints a Section's band, and layouts can be asked which pictures they use.
  
  **The preview was not honest about bands.** Setting a Section to Dark, Tinted or Mesh changed
  nothing in the split view — it only appeared once the Page was published, which is the one
  thing a live preview promises not to do. The band is now drawn with the same class and the
  same `data-` attributes the renderer emits, so `@mimnets/blocks`' own stylesheet paints it and
  the two cannot drift apart.
  
  Two consequences worth knowing if you style the Dashboard yourself. Inside a painted band a
  Block's card is transparent, because an opaque card is a rectangle the published Page does not
  have — and on a dark band, where the stylesheet sets text to white, it made Block text
  invisible. And nothing in the Editor may clip a Section's contents: menus open out of them.
  
  **`mediaKeysIn(layout)` and `usesMediaKey(layout, key)`** are new on `@mimnets/core`. They
  return the storage keys a layout document refers to, covering both shapes that carry one — an
  image field, `{ key, alt }`, and a Section background, `{ key, overlay }` — at any depth,
  including inside repeaters.
  
  They walk the document structurally rather than consulting the registry, deliberately. The
  registry knows where images are only for Block Types a Site still registers, and a Page holding
  a Block whose type was removed still holds that Block's picture. A usage check that could not
  see it would report the file as unused and invite somebody to delete it.
  
  The Starter uses them to show, on every row of the media library, where each file is used —
  published Pages, unpublished drafts, and Shared Slots reported separately, because "on every
  Page at once" and "in something nobody has published" are different answers to the question an
  Author is actually asking. Deleting still breaks the Pages that used a file, as ADR-0012
  intends; you can now find out first.
  
  **Upgrading an existing Site:** nothing is required. A Site with its own Dashboard styling that
  overrides `.mn-ed-block` may want to check it against a coloured band.

### Patch Changes

- Updated dependencies
  - @mimnets/core@0.3.0

## 0.2.0

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
