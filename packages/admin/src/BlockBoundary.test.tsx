// @vitest-environment jsdom

/**
 * The Editor's containment guarantee: one Block that throws must not take the Editor with it.
 *
 * These assertions go through `Preview` rather than mounting `BlockBoundary` directly, and
 * that is the whole point of the file. `BlockBoundary` in isolation passes whether or not the
 * Editor is safe — the defect this guards against was never in the boundary, it was in how
 * the boundary was called. A `blockType.render(props, context)` written inline is an ordinary
 * function call made during the *parent's* render, so the throw unwinds past a boundary
 * wrapped around its result and unmounts the Editor along with the Author's unsaved draft.
 * Only a boundary with the call in a descendant catches anything, and only rendering the real
 * composition can tell the two apart.
 *
 * This shipped broken to review once and a browser was the only thing that noticed.
 */

import { createRegistry, defineBlock, emptyContext, emptyLayout, field } from "@mimnets/core";
import type { PageLayout } from "@mimnets/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { newBlock, newSection } from "./state";
import { Preview } from "./Preview";

/**
 * A Block Type that throws for exactly the reason a real one does: a field is mid-keystroke.
 * `new URL("h")` is the case from the Editor — a URL field holding the first character of
 * "https://…" is enough.
 */
const brittleBlock = defineBlock({
  name: "brittle",
  label: "Brittle",
  fields: {
    href: field.text({ label: "Link", default: "h" }),
  },
  render: ({ href }) => <a href={new URL(href as string).toString()}>Go</a>,
});

const steadyBlock = defineBlock({
  name: "steady",
  label: "Steady",
  fields: {
    text: field.text({ label: "Text", default: "Still here" }),
  },
  render: ({ text }) => <p>{text as string}</p>,
});

const registry = createRegistry([brittleBlock, steadyBlock]);

/** A Page whose `main` Slot holds the throwing Block above a healthy one. */
function pageWithABrittleBlock(): PageLayout {
  const layout = emptyLayout();
  const section = newSection("1");
  section.columns[0]!.blocks.push(newBlock(brittleBlock), newBlock(steadyBlock));
  layout.slots.main.push(section);
  return layout;
}

function renderPreview(layout: PageLayout) {
  return render(
    <Preview
      layout={layout}
      registry={registry}
      selection={null}
      dispatch={vi.fn()}
      context={emptyContext()}
      visibleSlots={["main"]}
    />,
  );
}

beforeEach(() => {
  // The boundary logs the stack for whoever wrote the Block. That is correct behaviour and
  // this suite triggers it on purpose, so silence it rather than let a passing run look red.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("a Block that throws while rendering", () => {
  it("is replaced by a message instead of unmounting the Editor", () => {
    renderPreview(pageWithABrittleBlock());

    expect(screen.getByText("This Block could not be drawn.")).toBeTruthy();
  });

  it("leaves every other Block on the Page rendered", () => {
    renderPreview(pageWithABrittleBlock());

    // Containment is the guarantee. If the throw escaped the boundary this Block is gone too,
    // and so is everything the Author had not saved.
    expect(screen.getByText("Still here")).toBeTruthy();
  });

  it("keeps the Editor's own chrome around the failed Block", () => {
    const { container } = renderPreview(pageWithABrittleBlock());

    // The Slot and its Section still exist: the failure is contained to one Block's card,
    // not to the region holding it.
    expect(container.querySelector('[data-slot="main"]')).toBeTruthy();
  });

  it("shows the Author the underlying message", () => {
    renderPreview(pageWithABrittleBlock());

    // Not a specific string — `new URL` phrases itself differently across runtimes. What
    // matters is that something diagnostic reached the page rather than an empty element.
    const code = screen.getByText("This Block could not be drawn.").closest(".mn-block-error");
    expect(code?.querySelector("code")?.textContent?.length).toBeGreaterThan(0);
  });

  it("recovers on its own once the props are valid again", () => {
    const layout = pageWithABrittleBlock();
    const { rerender } = renderPreview(layout);

    expect(screen.getByText("This Block could not be drawn.")).toBeTruthy();

    // The next keystroke that completes the URL. `resetKey` is the Block's serialised props,
    // so this is exactly what the Editor does when an Author finishes typing.
    layout.slots.main[0]!.columns[0]!.blocks[0]!.props = { href: "https://example.com/" };

    rerender(
      <Preview
        layout={structuredClone(layout)}
        registry={registry}
        selection={null}
        dispatch={vi.fn()}
        context={emptyContext()}
        visibleSlots={["main"]}
      />,
    );

    expect(screen.queryByText("This Block could not be drawn.")).toBeNull();
    expect(screen.getByRole("link", { name: "Go" })).toBeTruthy();
  });
});
