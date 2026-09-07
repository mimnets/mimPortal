// @vitest-environment jsdom

/**
 * The button row Block, M10.5's third.
 *
 * Two things are worth testing here and they pull in opposite directions. The row exists so
 * that two buttons can differ -- one solid, one outline -- which means the style is per item
 * rather than a variant on the Block, and that is the assertion the whole feature rests on.
 * And its address field is a free-text box a client edits, so whatever goes in it becomes an
 * href, exactly as in the social Block.
 */

import { emptyContext } from "@mimnets/core";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buttonRowBlock } from "./design";

afterEach(cleanup);

type RowProps = Parameters<typeof buttonRowBlock.render>[0];

function draw(items: { label: string; href?: string; style?: string }[], rest = {}) {
  const props = buttonRowBlock.propsSchema.parse({ items, ...rest }) as RowProps;
  return render(<>{buttonRowBlock.render(props, emptyContext())}</>);
}

const buttons = (c: HTMLElement) => Array.from(c.querySelectorAll("a.mn-btn"));

describe("what it draws", () => {
  it("puts every button in one row", () => {
    const { container } = draw([
      { label: "Book a table" },
      { label: "See the menu" },
    ]);

    expect(container.querySelector(".mn-buttons")).not.toBeNull();
    expect(buttons(container).map((a) => a.textContent)).toEqual(["Book a table", "See the menu"]);
  });

  /**
   * The reason this Block exists rather than a Column property. A hero wants one solid button
   * and one outline beside it; if the style were a variant on the Block, both would be the
   * same and the pair would read as a mistake.
   */
  it("lets each button carry its own style", () => {
    const { container } = draw([
      { label: "Book a table", style: "primary" },
      { label: "See the menu", style: "outline" },
    ]);

    expect(buttons(container).map((a) => a.getAttribute("data-style"))).toEqual([
      "primary",
      "outline",
    ]);
  });

  it("draws nothing at all rather than an empty row", () => {
    // An Author who adds a row and changes their mind leaves items with no label behind.
    const { container } = draw([]);
    expect(container.querySelector(".mn-buttons")).toBeNull();

    const { container: blank } = draw([{ label: "" }, { label: "" }]);
    expect(blank.querySelector(".mn-buttons")).toBeNull();
  });

  it("drops the unlabelled button and keeps the rest", () => {
    const { container } = draw([{ label: "Book a table" }, { label: "" }]);
    expect(buttons(container)).toHaveLength(1);
  });

  it("carries the alignment and the size the Author chose", () => {
    const { container } = draw([{ label: "Book" }], { align: "center", size: "large" });

    expect(container.querySelector(".mn-buttons")?.getAttribute("data-align")).toBe("center");
    expect(buttons(container)[0]?.getAttribute("data-size")).toBe("large");
  });
});

describe("addresses it refuses", () => {
  /**
   * React refuses `javascript:` on its own and does not refuse `vbscript:`, which is the note
   * carousel.test.tsx makes and the reason every Block with an Author-supplied link runs it
   * through `safeHref` rather than trusting the framework.
   */
  it.each([
    "javascript:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
  ])("refuses %s", (href) => {
    const { container } = draw([{ label: "Book a table", href }]);

    expect(buttons(container)[0]?.getAttribute("href")).toBe("/");
  });

  it("keeps the ordinary addresses a client actually types", () => {
    for (const href of ["/menu", "https://example.com/book", "mailto:hi@example.com", "#book"]) {
      cleanup();
      const { container } = draw([{ label: "Book", href }]);
      expect(buttons(container)[0]?.getAttribute("href")).toBe(href);
    }
  });
});
