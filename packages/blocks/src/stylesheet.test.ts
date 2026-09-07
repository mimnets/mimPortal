/**
 * Two properties of `blocks.css` that no rendering test can see, because they are about what
 * the stylesheet must *not* contain.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./blocks.css", import.meta.url)), "utf8");

describe("the published stylesheet", () => {
  /**
   * The load-bearing half of M10's responsive preview.
   *
   * `container-type` implies `contain: layout`, which makes the element carrying it a
   * containing block for `position: fixed` descendants. The gallery lightbox and the popover
   * panels are both `position: fixed` and both live inside a Section, so a `container-type`
   * anywhere in this file would trap them inside whatever band they happen to be in — the
   * lightbox covering one Section instead of the window, on every published Page.
   *
   * The container belongs in `@mimnets/admin`, on a preview wrapper that holds no published
   * markup. This is the guard that keeps it there, and it is the same shape as the warning
   * the divider comment already makes about `clip-path`.
   */
  it("declares no container-type, so nothing can trap the lightbox or a popover", () => {
    expect(css).not.toMatch(/container-type\s*:/);
  });

  /**
   * The other half. The `@container` rules are useless without a container, so if they were
   * ever dropped as "dead CSS" the preview would silently stop narrowing — it would still
   * change width, and the Columns would simply never stack, which looks like a working
   * feature until an Author trusts it.
   */
  it("keeps a @container twin for every layout breakpoint it answers to a viewport with", () => {
    const media = (css.match(/@media \(max-width/g) ?? []).length;
    const container = (css.match(/@container \(max-width/g) ?? []).length;

    expect(container).toBeGreaterThan(0);
    // Not every @media is a layout rule -- forced-colors and reduced-motion have no twin --
    // so this is a floor rather than an equality, and it fails the moment a twin is deleted.
    expect(container).toBe(6);
    expect(media).toBeGreaterThanOrEqual(container);
  });
});
