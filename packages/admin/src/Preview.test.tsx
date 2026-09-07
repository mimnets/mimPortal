// @vitest-environment jsdom

/**
 * Selecting a Section by clicking it.
 *
 * The settings panel tells an Author, in as many words, to "click a Block to edit its fields,
 * or a Section to change its Columns". The second half of that was not true: the Section's
 * click handler selected the Section, the click then carried on up to the preview root whose
 * own handler clears the selection, and both applied in that order. The net result was
 * nothing selected, so Section settings were reachable only by adding a Section — which sets
 * the selection inside the reducer — and never by clicking one.
 *
 * Confirmed in a browser before it was fixed, and confirmed fixed in a browser afterwards.
 * The assertion below is about the dispatch sequence rather than the rendered panel, because
 * that sequence is the whole bug: with the fault present the Section is selected *and then*
 * unselected, which no single snapshot of the panel can distinguish from never having been
 * selected at all.
 */

import { createRegistry, defineBlock, emptyContext, emptyLayout, field } from "@mimnets/core";
import type { PageLayout } from "@mimnets/core";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { newBlock, newSection } from "./state";
import { Preview } from "./Preview";

afterEach(cleanup);

const spacer = defineBlock({
  name: "spacer",
  label: "Spacer",
  fields: { note: field.text({ label: "Note", default: "" }) },
  render: ({ note }) => <p>{note as string}</p>,
});

const registry = createRegistry([spacer]);

function pageWithOneSection(): PageLayout {
  const layout = emptyLayout();
  const section = newSection("1");
  section.columns[0]!.blocks.push(newBlock(spacer));
  layout.slots.main.push(section);
  return layout;
}

function draw() {
  const dispatch = vi.fn();
  const result = render(
    <Preview
      layout={pageWithOneSection()}
      registry={registry}
      selection={null}
      dispatch={dispatch}
      context={emptyContext()}
      visibleSlots={["main"]}
    />,
  );
  return { ...result, dispatch };
}

describe("clicking a Section", () => {
  it("selects it", () => {
    const { container, dispatch } = draw();

    fireEvent.click(container.querySelector(".mn-ed-section")!);

    expect(dispatch).toHaveBeenCalledWith({
      type: "select",
      selection: { kind: "section", path: { slot: "main", section: 0 } },
    });
  });

  it("does not then unselect it on the way up", () => {
    const { container, dispatch } = draw();

    fireEvent.click(container.querySelector(".mn-ed-section")!);

    // The bug in one line. Two dispatches — the Section, then null from the preview root —
    // leave the panel empty and look exactly like a click that did nothing.
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalledWith({ type: "select", selection: null });
  });

  it("still lets a click on the preview background clear the selection", () => {
    const { container, dispatch } = draw();

    // Stopping propagation must not cost the deselect-by-clicking-away behaviour, which is
    // the reason the root handler exists.
    fireEvent.click(container.querySelector(".mn-ed-preview")!);

    expect(dispatch).toHaveBeenCalledWith({ type: "select", selection: null });
  });

  it("selects the Block, not the Section, when a Block is clicked", () => {
    const { container, dispatch } = draw();

    fireEvent.click(container.querySelector(".mn-ed-block")!);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      type: "select",
      selection: { kind: "block" },
    });
  });
});

describe("the band behind a Section", () => {
  /**
   * The preview's whole claim is that it is honest, and for a Section's band it was not:
   * setting one to Dark or Mesh changed nothing here and only appeared after publishing.
   * The band is now drawn with the same class and the same attributes `SlotView` emits, so
   * `blocks.css` paints it and the two cannot drift.
   */
  function band(overrides: Partial<{ tone: string; padding: string; divider: string }> = {}) {
    const layout = pageWithOneSection();
    Object.assign(layout.slots.main[0]!, overrides);

    const { container } = render(
      <Preview
        layout={layout}
        registry={registry}
        selection={null}
        dispatch={vi.fn()}
        context={emptyContext()}
      />,
    );

    const el = container.querySelector(".mn-ed-band");
    if (!el) throw new Error("the preview drew no band");
    return el;
  }

  it("uses the Site's own Section class, not a copy of it", () => {
    // The reason this works at all: `blocks.css` is already loaded in the Dashboard, so the
    // band is painted by the Page's stylesheet rather than by a second one that would drift.
    expect(band().classList.contains("mn-section")).toBe(true);
  });

  it("carries the tone, so a coloured band looks coloured", () => {
    expect(band({ tone: "dark" }).getAttribute("data-tone")).toBe("dark");
    expect(band({ tone: "mesh" }).getAttribute("data-tone")).toBe("mesh");
  });

  it("carries the height and the bottom edge too", () => {
    expect(band({ padding: "large" }).getAttribute("data-padding")).toBe("large");
    expect(band({ divider: "curve" }).getAttribute("data-divider")).toBe("curve");
  });

  it("leaves the edge off when it is straight, as the renderer does", () => {
    expect(band({ divider: "none" }).hasAttribute("data-divider")).toBe(false);
  });
});

describe("the wrapper a Block is rendered inside", () => {
  /**
   * A button has no colour of its own. `.mn-btn` sets a transparent border and no background,
   * and everything visible about it comes from `.mn-block[data-variant="..."] .mn-btn` — so a
   * preview that does not carry `data-variant` renders it as invisible text. It did, from the
   * day variants landed until somebody opened the Editor and said the button was missing.
   */
  function body(style: Record<string, unknown> = {}) {
    const layout = pageWithOneSection();
    Object.assign(layout.slots.main[0]!.columns[0]!.blocks[0]!.style, style);

    const { container } = render(
      <Preview
        layout={layout}
        registry={registry}
        selection={null}
        dispatch={vi.fn()}
        context={emptyContext()}
      />,
    );

    const el = container.querySelector(".mn-ed-block-body");
    if (!el) throw new Error("the preview drew no Block body");
    return el;
  }

  it("is the Site's own Block class, so the stylesheet applies", () => {
    expect(body().classList.contains("mn-block")).toBe(true);
  });

  it("carries the variant, which is the only thing that colours a button", () => {
    expect(body({ variant: "quote" }).getAttribute("data-variant")).toBe("quote");
  });

  it("carries tone, font and animate once they say something", () => {
    const el = body({ tone: "gradient", font: "heading", animate: "fade" });

    expect(el.getAttribute("data-tone")).toBe("gradient");
    expect(el.getAttribute("data-font")).toBe("heading");
    expect(el.getAttribute("data-animate")).toBe("fade");
  });

  it("leaves them off at their defaults, as the renderer does", () => {
    const el = body({ tone: "default", font: "default", animate: "none" });

    expect(el.hasAttribute("data-tone")).toBe(false);
    expect(el.hasAttribute("data-font")).toBe(false);
    expect(el.hasAttribute("data-animate")).toBe(false);
  });

  it("names the Block Type, so a Site can style one of its own", () => {
    expect(body().getAttribute("data-block")).toBe("spacer");
  });
});

/**
 * The responsive preview, M10's fourth.
 *
 * Columns stack on narrow screens without anybody authoring it, which meant an Author never
 * saw the stacked result until they published — the one thing a live preview promises not to
 * do, and the same complaint the Section band answered above.
 *
 * The mechanism is the thing to protect. `blocks.css` carries a `@container` twin of each
 * `@media` layout rule, and this frame is the only element in the product that declares
 * `container-type`. jsdom does not evaluate container queries, so what is tested here is the
 * contract that makes them fire: the frame exists, it carries the chosen width, and it is in
 * the Dashboard rather than in anything a Site publishes.
 */
describe("the preview's width", () => {
  function frame(viewport?: "full" | "tablet" | "phone") {
    const { container } = render(
      <Preview
        layout={pageWithOneSection()}
        registry={registry}
        selection={null}
        dispatch={vi.fn()}
        context={emptyContext()}
        viewport={viewport}
      />,
    );
    const el = container.querySelector(".mn-ed-frame");
    if (!el) throw new Error("the preview drew no frame");
    return el;
  }

  it("draws the Page at full width unless asked otherwise", () => {
    expect(frame().getAttribute("data-viewport")).toBe("full");
  });

  it("carries the width an Author picked", () => {
    expect(frame("phone").getAttribute("data-viewport")).toBe("phone");
    expect(frame("tablet").getAttribute("data-viewport")).toBe("tablet");
  });

  /**
   * The frame wraps the Slots rather than sitting beside them. A container only governs its
   * descendants, so a frame that did not contain the Sections would change nothing at any
   * width and the whole feature would be a select box that does nothing.
   */
  it("wraps the Slots, because a container only governs what is inside it", () => {
    const el = frame("phone");
    expect(el.querySelector(".mn-ed-slot")).not.toBeNull();
  });
});
