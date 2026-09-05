/**
 * Variants: a Block Type's declared looks, and the two Block Types that had one before there
 * was a mechanism.
 *
 * The interesting half is not the feature, it is the migration. A button's look was
 * `props.style` and prose's was `props.width`, on every Page of every Site written so far,
 * and `props` has stopped carrying them — an unknown key is stripped silently, so without
 * the lift every accent button on every Site comes back primary and nobody finds out from a
 * stack trace.
 */

import { describe, expect, it } from "vitest";

import { defineBlock } from "./define";
import { field } from "./fields";
import { createRegistry } from "./registry";

/** A Block Type with three looks, the first of which is what it has always been. */
const badge = defineBlock({
  name: "badge",
  label: "Badge",
  variants: ["card", "quote", "minimal"],
  fields: { text: field.text({ label: "Text", default: "" }) },
  render: () => null,
});

/** The shape of the pair this migration exists for. */
const button = defineBlock({
  name: "button",
  label: "Button",
  variants: ["primary", "accent", "outline"],
  variantWasField: "style",
  fields: { label: field.text({ label: "Label", default: "Learn more" }) },
  render: () => null,
});

/** No variants declared at all, which is most of the library. */
const plain = defineBlock({
  name: "plain",
  label: "Plain",
  fields: { body: field.text({ label: "Body", default: "" }) },
  render: () => null,
});

const registry = createRegistry([badge, button, plain]);

function layoutWith(block: Record<string, unknown>) {
  return {
    version: 1,
    slots: {
      header: [],
      main: [
        {
          id: "sec-1",
          layout: "1",
          tone: "default",
          padding: "normal",
          background: { key: "", overlay: 0.45 },
          columns: [{ id: "col-1", blocks: [block] }],
        },
      ],
      sidebar: [],
      footer: [],
    },
  };
}

function parseBlock(block: Record<string, unknown>) {
  return registry.parseLayout(layoutWith(block)).slots.main[0]?.columns[0]?.blocks[0];
}

describe("a Block Type that declares variants", () => {
  it("defaults to the first, which is what the Block already looked like", () => {
    // The whole reason this shipped without a database migration: a Block stored before
    // variants existed carries no variant, and the one it gets is the one it had.
    const parsed = parseBlock({ id: "blk-1", type: "badge", props: { text: "hi" } });

    expect(parsed?.style.variant).toBe("card");
  });

  /**
   * The shape almost every stored Block is actually in, and the one worth being explicit
   * about: `style` exists — Blocks have had a tone, a font and an animation for a while —
   * but has no `variant`, because until now there was no such thing. The default has to
   * apply *inside* the object, not only when `style` is missing altogether.
   */
  it("defaults inside a style object that predates variants", () => {
    const parsed = parseBlock({
      id: "blk-1",
      type: "badge",
      props: { text: "hi" },
      style: { tone: "primary", font: "heading", animate: "rise" },
    });

    expect(parsed?.style.variant).toBe("card");
    // And nothing else about the Block's appearance is disturbed on the way past.
    expect(parsed?.style.tone).toBe("primary");
    expect(parsed?.style.animate).toBe("rise");
  });

  it("keeps a variant an Author chose", () => {
    const parsed = parseBlock({
      id: "blk-1",
      type: "badge",
      props: { text: "hi" },
      style: { tone: "default", font: "default", animate: "none", variant: "quote" },
    });

    expect(parsed?.style.variant).toBe("quote");
  });

  /**
   * The set is per Block Type, not global, so this cannot be one shared enum: a testimonial's
   * "quote" and a button's "outline" have nothing to do with each other, and a Block accepting
   * another Block Type's variant would render as the default with a data attribute no rule
   * matches — which looks like nothing happening rather than like an error.
   */
  it("refuses another Block Type's variant", () => {
    expect(() =>
      parseBlock({
        id: "blk-1",
        type: "badge",
        props: { text: "hi" },
        style: { tone: "default", font: "default", animate: "none", variant: "outline" },
      }),
    ).toThrow();
  });

  it("refuses a variant that reaches for CSS", () => {
    // `variant` is emitted as a data attribute and selects rules; the enum is the boundary.
    expect(() =>
      parseBlock({
        id: "blk-1",
        type: "badge",
        props: { text: "hi" },
        style: { tone: "default", font: "default", animate: "none", variant: 'x"] {display:none}' },
      }),
    ).toThrow();
  });
});

describe("a Block Type that declares none", () => {
  it("has no variant at all, rather than an empty one", () => {
    const parsed = parseBlock({ id: "blk-1", type: "plain", props: { body: "hi" } });

    expect(parsed?.style.variant).toBeUndefined();
  });

  it("does not gain one from a Page that claims it has one", () => {
    const parsed = parseBlock({
      id: "blk-1",
      type: "plain",
      props: { body: "hi" },
      style: { tone: "default", font: "default", animate: "none", variant: "card" },
    });

    expect(parsed?.style.variant).toBeUndefined();
  });
});

describe("the Pages written before variants existed", () => {
  /**
   * The failure this is the guard against, stated plainly: the Starter's own seeded home page
   * has an accent "Book a table" button, and every Site built so far has buttons like it.
   * Without the lift they all parse to `primary` — no error, no dropped Block, just every
   * call to action on every Site quietly changing colour.
   */
  it("lifts a button's old style field into its variant", () => {
    const parsed = parseBlock({
      id: "blk-1",
      type: "button",
      props: { label: "Book a table", style: "accent" },
    });

    expect(parsed?.style.variant).toBe("accent");
  });

  it("leaves the old field behind rather than carrying it in props", () => {
    const parsed = parseBlock({
      id: "blk-1",
      type: "button",
      props: { label: "Book a table", style: "accent" },
    });

    // One place to read it from. A Page rewrites itself into this shape on the next save.
    expect(parsed?.props).not.toHaveProperty("style");
  });

  it("lets a variant that was actually chosen win over the old field", () => {
    // A Page saved once since this landed has both. The new one is the one somebody meant.
    const parsed = parseBlock({
      id: "blk-1",
      type: "button",
      props: { label: "Book a table", style: "accent" },
      style: { tone: "default", font: "default", animate: "none", variant: "outline" },
    });

    expect(parsed?.style.variant).toBe("outline");
  });

  it("ignores an old field holding something that is not a variant", () => {
    // Rather than failing the Block. The value is unusable either way, and the first variant
    // is a correct answer; refusing would drop a Block over a field nobody can see any more.
    const parsed = parseBlock({
      id: "blk-1",
      type: "button",
      props: { label: "Book a table", style: "chartreuse" },
    });

    expect(parsed?.style.variant).toBe("primary");
  });

  it("does not lift anything for a Block Type that never had an old field", () => {
    const parsed = parseBlock({
      id: "blk-1",
      type: "badge",
      // A prop the Block Type does not declare, which happens to be named like a variant.
      props: { text: "hi", style: "quote" },
    });

    expect(parsed?.style.variant).toBe("card");
  });
});
