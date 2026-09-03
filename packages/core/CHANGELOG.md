# @mimnets/core

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
