// @vitest-environment jsdom

/**
 * The prose Block.
 *
 * The rendering itself is core's and tested there; what is left here is the Block's own
 * behaviour — that an empty one draws nothing, and that the line-length choice reaches the
 * element the stylesheet reads.
 */

import { emptyContext } from "@mimnets/core";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { proseBlock } from "./index";

afterEach(cleanup);

type ProseProps = Parameters<typeof proseBlock.render>[0];

function draw(overrides: Record<string, unknown> = {}) {
  const props = proseBlock.propsSchema.parse({
    body: "## Our terms\n\nPayment is due within **30 days**.",
    ...overrides,
  }) as ProseProps;
  return render(<>{proseBlock.render(props, emptyContext())}</>);
}

describe("the prose Block", () => {
  it("renders nothing when nobody has written anything", () => {
    const { container } = draw({ body: "" });

    // An empty wrapper still takes vertical space and still gets a margin.
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for whitespace alone", () => {
    const { container } = draw({ body: "\n\n   \n" });

    expect(container.innerHTML).toBe("");
  });

  it("renders the Markdown", () => {
    const { container } = draw();

    expect(container.querySelector("h2")!.textContent).toBe("Our terms");
    expect(container.querySelector("strong")!.textContent).toBe("30 days");
  });

  it("carries the line-length choice onto the element", () => {
    expect(draw().container.querySelector(".mn-prose")!.getAttribute("data-width")).toBe(
      "readable",
    );
    expect(
      draw({ width: "full" }).container.querySelector(".mn-prose")!.getAttribute("data-width"),
    ).toBe("full");
  });

  it("does not let an Author paste working markup into a Page", () => {
    const { container } = draw({ body: "Before <script>alert(1)</script> after" });

    // Asserted at the Block as well as in core: this is the boundary a client types into.
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>");
  });
});
