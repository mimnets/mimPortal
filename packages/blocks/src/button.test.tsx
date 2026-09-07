// @vitest-environment jsdom

/**
 * The standalone button Block.
 *
 * Its "Links to" field is a free-text box a client edits, and whatever goes in it becomes an
 * href — the same shape as the social row, the carousel and the pricing plan, all of which
 * run their links through `safeHref`. This Block did not, which is what these tests are here
 * for; the rest of it is a link with a label.
 */

import { emptyContext } from "@mimnets/core";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buttonBlock } from "./design";

afterEach(cleanup);

type ButtonProps = Parameters<typeof buttonBlock.render>[0];

function draw(overrides: Record<string, unknown> = {}) {
  const props = buttonBlock.propsSchema.parse({
    label: "Learn more",
    ...overrides,
  }) as ButtonProps;
  return render(<>{buttonBlock.render(props, emptyContext(), { id: "blk-test" })}</>);
}

const href = (c: HTMLElement) => c.querySelector("a.mn-btn")?.getAttribute("href");

describe("what it draws", () => {
  it("is a link carrying the label", () => {
    const { container } = draw({ label: "Book a table", href: "/book" });

    expect(container.querySelector("a.mn-btn")?.textContent).toBe("Book a table");
    expect(href(container)).toBe("/book");
  });

  it("draws nothing without a label, rather than an invisible link", () => {
    expect(draw({ label: "" }).container.querySelector("a")).toBeNull();
  });

  it("carries the size the Author chose", () => {
    expect(
      draw({ size: "large" }).container.querySelector("a.mn-btn")?.getAttribute("data-size"),
    ).toBe("large");
  });
});

describe("addresses it refuses", () => {
  /**
   * The gap this file was written for. Every other Block that turns Author input into an href
   * runs it through `safeHref`; this one interpolated it directly.
   *
   * React refuses `javascript:` on its own, which is why nothing looked wrong. It does not
   * refuse `vbscript:` — the note carousel.test.tsx makes — and it does not refuse a `data:`
   * URL, so the protection was one browser quirk deep and covered one scheme of three.
   */
  it.each([
    "javascript:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
  ])("refuses %s", (bad) => {
    expect(href(draw({ href: bad }).container)).toBe("/");
  });

  it("keeps the ordinary addresses a client actually types", () => {
    for (const good of ["/menu", "https://example.com/book", "mailto:hi@example.com", "#book"]) {
      cleanup();
      expect(href(draw({ href: good }).container)).toBe(good);
    }
  });
});

/**
 * A button that opens a panel instead of going somewhere.
 *
 * The narrow half of "a popover an Author can attach to anything": the case that actually
 * comes up is a button, and a button already renders its own markup, so it needed only the
 * one thing the popovers Block got for free — an id nothing else on the Page shares.
 */
describe("a button with a panel", () => {
  const withPanel = { panelHeading: "What this includes", panelBody: "Two visits a **year**." };

  it("becomes a popover rather than a link", () => {
    const { container } = draw(withPanel);

    expect(container.querySelector("a.mn-btn")).toBeNull();
    expect(container.querySelector("label.mn-btn")).not.toBeNull();
    expect(container.querySelector("input.mn-popover-toggle")).not.toBeNull();
    expect(container.querySelector(".mn-popover-panel")).not.toBeNull();
  });

  it("stays an ordinary link when no panel is written", () => {
    const { container } = draw({ href: "/book" });

    expect(container.querySelector("a.mn-btn")?.getAttribute("href")).toBe("/book");
    expect(container.querySelector("input.mn-popover-toggle")).toBeNull();
  });

  it("opens on either half of a filled-in panel", () => {
    // A heading alone, or text alone, is enough. Requiring both would make an Author who
    // wrote only a paragraph wonder why nothing happened.
    for (const partial of [{ panelHeading: "Just a heading" }, { panelBody: "Just some text" }]) {
      cleanup();
      expect(draw(partial).container.querySelector("input.mn-popover-toggle")).not.toBeNull();
    }
  });

  /**
   * The id comes from the Block's own id, which is why `BlockMeta` was added to `render`.
   * Two identical buttons on one Page — the same label opening the same panel, which is
   * exactly what a repeated call to action looks like — must not share a checkbox.
   */
  it("gives two identical buttons their own panels", () => {
    const first = draw(withPanel).container.querySelector("input.mn-popover-toggle")!.id;
    cleanup();
    const props = buttonBlock.propsSchema.parse({ label: "Learn more", ...withPanel }) as ButtonProps;
    const { container } = render(<>{buttonBlock.render(props, emptyContext(), { id: "blk-two" })}</>);
    const second = container.querySelector("input.mn-popover-toggle")!.id;

    expect(first).not.toBe(second);
  });

  it("renders the panel's Markdown, and never raw HTML", () => {
    const { container } = draw({
      panelBody: "A **senior** partner.<script>alert(1)</script>",
    });

    expect(container.querySelector(".mn-prose strong")?.textContent).toBe("senior");
    expect(container.querySelector("script")).toBeNull();
  });

  /**
   * A button either goes somewhere or opens something. Doing both would follow the link a
   * moment after showing the panel, which reads as a flash rather than a feature.
   */
  it("ignores the link when a panel is written, rather than doing both", () => {
    const { container } = draw({ ...withPanel, href: "https://example.com/book" });

    expect(container.querySelectorAll("a[href]")).toHaveLength(0);
  });
});
