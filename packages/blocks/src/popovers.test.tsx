// @vitest-environment jsdom

/**
 * The popovers Block, M10.5's fourth.
 *
 * Two properties are worth holding onto and neither is visible in a browser by looking at one
 * popover. The fragment ids must be unique per Block, or two popover Blocks on one Page open
 * each other's panels — the bug the gallery's `scope` was written to prevent. And the panel's
 * body goes through the same Markdown renderer as the prose Block, so raw HTML is never
 * parsed, because an Author is a client (ADR-0011).
 */

import { emptyContext } from "@mimnets/core";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { popoversBlock } from "./design";

afterEach(cleanup);

type PopoverProps = Parameters<typeof popoversBlock.render>[0];

function draw(
  items: { trigger: string; heading?: string; body?: string }[],
  rest: Record<string, unknown> = {},
) {
  const props = popoversBlock.propsSchema.parse({ items, ...rest }) as PopoverProps;
  return render(<>{popoversBlock.render(props, emptyContext())}</>);
}

const TEAM = [
  { trigger: "Dr Amara Osei", heading: "Dr Amara Osei", body: "Twenty years in tax." },
  { trigger: "Rowan Blake", heading: "Rowan Blake", body: "Audit and assurance." },
];

describe("what it draws", () => {
  it("gives every panel a trigger that points at it", () => {
    const { container } = draw(TEAM);

    const triggers = Array.from(container.querySelectorAll("a.mn-popover-open"));
    const panels = Array.from(container.querySelectorAll(".mn-popover"));

    expect(triggers).toHaveLength(2);
    expect(panels).toHaveLength(2);

    // The link and the panel it opens have to agree, which is the whole mechanism.
    for (const [index, trigger] of triggers.entries()) {
      expect(trigger.getAttribute("href")).toBe(`#${panels[index]?.id}`);
    }
  });

  it("renders the panel's text whether or not it is open", () => {
    // `display: none` hides it; the words are still in the document, so in-page search finds
    // them and a crawler sees them. A JavaScript panel has neither property before its
    // script arrives.
    const { container } = draw(TEAM);
    expect(container.textContent).toContain("Twenty years in tax.");
  });

  it("closes back to the Block rather than to the top of the Page", () => {
    const { container } = draw(TEAM);
    const block = container.querySelector(".mn-popovers");
    const close = container.querySelector("a.mn-popover-close");

    expect(close?.getAttribute("href")).toBe(`#${block?.id}`);
  });

  it("drops an item with nothing to click on", () => {
    const { container } = draw([{ trigger: "Kept" }, { trigger: "" }]);
    expect(container.querySelectorAll("a.mn-popover-open")).toHaveLength(1);
  });

  it("draws nothing rather than an empty list", () => {
    expect(draw([]).container.querySelector(".mn-popovers")).toBeNull();
  });
});

describe("two of them on one Page", () => {
  /**
   * The bug the gallery's `stableName` scope exists to prevent, and the reason this Block
   * derives its ids from its own content rather than from the index alone. Two popover
   * Blocks whose panels were `#mn-pop-0` and `#mn-pop-0` would open each other's.
   */
  it("do not share fragment ids", () => {
    const first = draw(TEAM).container.querySelector(".mn-popovers")?.id;
    cleanup();
    const second = draw([{ trigger: "Our approach", heading: "Our approach", body: "Careful." }])
      .container.querySelector(".mn-popovers")?.id;

    expect(first).not.toBe(second);
  });

  it("give the same content the same id, so a shared link keeps working", () => {
    const once = draw(TEAM).container.querySelector(".mn-popovers")?.id;
    cleanup();
    const again = draw(TEAM).container.querySelector(".mn-popovers")?.id;

    expect(once).toBe(again);
  });
});

describe("what an Author may put in a panel", () => {
  it("renders Markdown rather than leaving it as text", () => {
    const { container } = draw([{ trigger: "Bio", body: "A **senior** partner." }]);

    expect(container.querySelector(".mn-prose strong")?.textContent).toBe("senior");
  });

  /**
   * ADR-0011: an Author is a client and raw HTML is never parsed. The same renderer the prose
   * Block uses, so this Block cannot become the one place a script tag gets through.
   */
  it("does not parse raw HTML", () => {
    const { container } = draw([
      { trigger: "Bio", body: "<img src=x onerror=alert(1)><script>alert(2)</script>" },
    ]);

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img[onerror]")).toBeNull();
  });
});
