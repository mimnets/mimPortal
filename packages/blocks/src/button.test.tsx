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
  return render(<>{buttonBlock.render(props, emptyContext())}</>);
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
