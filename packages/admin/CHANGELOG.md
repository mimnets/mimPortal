# @mimnets/admin

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
