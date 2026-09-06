/**
 * The migration, run against the real Block Types rather than stand-ins.
 *
 * `packages/core/src/blocks/variants.test.ts` proves the mechanism with synthetic Blocks,
 * which is the right place for it -- core cannot import this package. But the mechanism is
 * not what breaks. What breaks is the declaration: delete `variantWasField: "style"` from
 * `design.tsx` and every core test still passes, because none of them has ever seen the real
 * button. The pair below is the whole reason the shim exists, so the pair is what this reads.
 *
 * Both cases are the shape almost every stored Block is actually in: `props` carrying the old
 * field, and no `style.variant` anywhere, because the Page was written before variants were.
 */

import { createRegistry } from "@mimnets/core";
import { describe, expect, it } from "vitest";

import { standardBlocks } from "./index";

const registry = createRegistry([...standardBlocks]);

/** One stored Block, parsed the way reading a Page parses it. */
function parse(block: Record<string, unknown>) {
  const layout = registry.parseLayout({
    version: 1,
    slots: {
      header: [],
      main: [
        {
          id: "sec-1",
          layout: "1",
          columns: [{ id: "col-1", blocks: [{ id: "blk-1", ...block }] }],
        },
      ],
      sidebar: [],
      footer: [],
    },
  });

  return layout.slots.main[0]?.columns[0]?.blocks[0];
}

describe("the two Block Types that had a look before there was a mechanism", () => {
  it("still declares which field each one used to keep it in", () => {
    // The declaration the lift reads. Without these two lines the lift is a no-op and every
    // stored Page quietly loses the look it was given.
    expect(registry.get("button")?.variantWasField).toBe("style");
    expect(registry.get("prose")?.variantWasField).toBe("width");
  });

  it("lifts a stored button's accent style into its variant", () => {
    // The Starter's own seeded home page has exactly this Block.
    const block = parse({
      type: "button",
      props: { label: "See how it works", href: "/about", style: "accent", size: "large" },
    });

    expect(block?.style.variant).toBe("accent");
  });

  it("lifts a stored prose Block's full width into its variant", () => {
    const block = parse({
      type: "prose",
      props: { body: "A paragraph written before any of this.", width: "full" },
    });

    expect(block?.style.variant).toBe("full");
  });

  it("leaves a button that was already saved with a variant alone", () => {
    const block = parse({
      type: "button",
      props: { label: "Book a table", href: "/contact", style: "accent" },
      style: { variant: "outline" },
    });

    expect(block?.style.variant).toBe("outline");
  });

  it("keeps the first look for a stored Block that never stated one", () => {
    expect(parse({ type: "button", props: { label: "More", href: "/" } })?.style.variant).toBe(
      "primary",
    );
    expect(parse({ type: "prose", props: { body: "Words." } })?.style.variant).toBe("readable");
  });
});
