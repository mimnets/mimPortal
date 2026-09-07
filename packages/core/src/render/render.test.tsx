// @vitest-environment jsdom

/**
 * What a rendered Block carries on its wrapper.
 *
 * This file exists because of one line. `data-variant` is how every variant on the Site
 * reaches the page: the renderer emits it, `blocks.css` selects on it, and nothing else
 * connects the two. Deleting it from the renderer entirely used to leave the whole suite
 * green, which meant M11's exit criterion -- the same Block Type wearing three different
 * looks -- rested on a line no test read.
 *
 * The asymmetry below is deliberate and is the other thing being pinned. `tone`, `font` and
 * `animate` are omitted at their defaults because each has a value that means "nothing
 * applied". A variant does not: a Block Type's looks are a set of equals, so the first one is
 * as much a choice as the third and the attribute is always present. That reads like an
 * inconsistency, and the obvious tidy-up -- make variant behave like the other three -- would
 * silently unstyle every Block on every Site that had never chosen a variant explicitly.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { defineBlock } from "../blocks/define";
import { field } from "../blocks/fields";
import { createRegistry } from "../blocks/registry";
import { SlotView } from "./render";

afterEach(cleanup);

const registry = createRegistry([
  defineBlock({
    name: "quotes",
    label: "Quotes",
    variants: ["card", "quote", "minimal"],
    fields: { note: field.text({ label: "Note", default: "" }) },
    render: () => null,
  }),
  defineBlock({
    name: "plain",
    label: "Plain",
    fields: { note: field.text({ label: "Note", default: "" }) },
    render: () => null,
  }),
]);

/** One Block in one Column in one Section, parsed the way a stored Page is. */
function draw(block: Record<string, unknown>) {
  const layout = registry.parseLayout({
    version: 1,
    slots: {
      header: [],
      main: [
        {
          id: "sec-1",
          layout: "1",
          columns: [{ id: "col-1", blocks: [{ id: "blk-1", props: {}, ...block }] }],
        },
      ],
      sidebar: [],
      footer: [],
    },
  });

  const { container } = render(<SlotView layout={layout} slot="main" registry={registry} />);
  const wrapper = container.querySelector(".mn-block");
  if (!wrapper) throw new Error("no Block was rendered");
  return wrapper;
}

describe("the variant on a rendered Block", () => {
  it("reaches the page as data-variant", () => {
    expect(draw({ type: "quotes", style: { variant: "quote" } }).getAttribute("data-variant")).toBe(
      "quote",
    );
  });

  it("is emitted for every declared look, not only the unusual ones", () => {
    for (const variant of ["card", "quote", "minimal"]) {
      expect(draw({ type: "quotes", style: { variant } }).getAttribute("data-variant")).toBe(
        variant,
      );
    }
  });

  /**
   * The one that guards the asymmetry. A Block that has never been given a variant parses to
   * the first one, and it must still be *stated* on the wrapper -- `blocks.css` styles
   * `[data-variant="card"]`, not "the absence of a variant". Omitting it here, the way `tone`
   * is omitted at "default", unstyles every unmodified Block on every Site.
   */
  it("is present even when nobody chose one and it fell back to the first", () => {
    const wrapper = draw({ type: "quotes" });

    expect(wrapper.getAttribute("data-variant")).toBe("card");
  });

  it("is absent for a Block Type that declares no looks at all", () => {
    expect(draw({ type: "plain" }).hasAttribute("data-variant")).toBe(false);
  });
});

describe("a Section's bottom edge", () => {
  /** One Section carrying whatever the caller says about its edge. */
  function band(section: Record<string, unknown>) {
    const parsed = registry.parseLayout({
      version: 1,
      slots: {
        header: [],
        main: [{ id: "sec-1", layout: "1", columns: [{ id: "col-1", blocks: [] }], ...section }],
        sidebar: [],
        footer: [],
      },
    });

    const { container } = render(<SlotView layout={parsed} slot="main" registry={registry} />);
    const el = container.querySelector(".mn-section");
    if (!el) throw new Error("no Section was rendered");
    return el;
  }

  it("reaches the page as data-divider", () => {
    expect(band({ divider: "angle" }).getAttribute("data-divider")).toBe("angle");
    expect(band({ divider: "curve" }).getAttribute("data-divider")).toBe("curve");
  });

  /**
   * Omitted at "none", unlike a Block's variant. The two look inconsistent and are not: a
   * variant has no value meaning "unstyled", and an edge does -- "none" is the absence of an
   * edge, so there is nothing for the stylesheet to select and no attribute to write.
   */
  it("is absent when the edge is straight, which is most Sections", () => {
    expect(band({ divider: "none" }).hasAttribute("data-divider")).toBe(false);
    expect(band({}).hasAttribute("data-divider")).toBe(false);
  });

  it("reaches the page as data-width, including at its default", () => {
    expect(band({ width: "wide" }).getAttribute("data-width")).toBe("wide");
    expect(band({ width: "full" }).getAttribute("data-width")).toBe("full");

    // Stated even at the default, which is the opposite of `divider` three tests up, and the
    // difference is real rather than an inconsistency. "none" is the absence of an edge, so
    // there is nothing to select on; "measure" is a width the Section genuinely has. A
    // Section that stated nothing would leave the Editor and any Site override guessing
    // whether absence meant "the measure" or "written before widths existed".
    expect(band({ width: "measure" }).getAttribute("data-width")).toBe("measure");
    expect(band({}).getAttribute("data-width")).toBe("measure");
  });
});

describe("the style keys that are omitted at their defaults", () => {
  /**
   * Not a variant, and the contrast is the point: each of these has a value meaning "nothing
   * applied", so emitting it would put a dead attribute on every Block on every Page.
   */
  it("leaves tone, font and animate off when they say nothing", () => {
    const wrapper = draw({ type: "quotes" });

    expect(wrapper.hasAttribute("data-tone")).toBe(false);
    expect(wrapper.hasAttribute("data-font")).toBe(false);
    expect(wrapper.hasAttribute("data-animate")).toBe(false);
  });

  it("emits them once they say something", () => {
    const wrapper = draw({
      type: "quotes",
      style: { tone: "gradient", font: "heading", animate: "fade" },
    });

    expect(wrapper.getAttribute("data-tone")).toBe("gradient");
    expect(wrapper.getAttribute("data-font")).toBe("heading");
    expect(wrapper.getAttribute("data-animate")).toBe("fade");
  });
});
