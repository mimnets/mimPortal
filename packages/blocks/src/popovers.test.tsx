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
  id = "blk-test",
) {
  const props = popoversBlock.propsSchema.parse({ items, ...rest }) as PopoverProps;
  return render(<>{popoversBlock.render(props, emptyContext(), { id })}</>);
}

const TEAM = [
  { trigger: "Dr Amara Osei", heading: "Dr Amara Osei", body: "Twenty years in tax." },
  { trigger: "Rowan Blake", heading: "Rowan Blake", body: "Audit and assurance." },
];

describe("what it draws", () => {
  it("gives every panel a checkbox, and a trigger that toggles it", () => {
    const { container } = draw(TEAM);

    const toggles = Array.from(container.querySelectorAll("input.mn-popover-toggle"));
    const triggers = Array.from(container.querySelectorAll("label.mn-popover-open"));
    const panels = Array.from(container.querySelectorAll(".mn-popover"));

    expect(toggles).toHaveLength(2);
    expect(panels).toHaveLength(2);

    // The label and the box it toggles have to agree, which is the whole mechanism.
    for (const [index, trigger] of triggers.entries()) {
      expect(trigger.getAttribute("for")).toBe(toggles[index]!.id);
      expect(toggles[index]!.id).not.toBe("");
    }
  });

  /**
   * Reported from a real Page, and it was a real bug: closing threw the reader somewhere
   * else. This is the assertion that the cause is gone rather than reduced.
   *
   * The first build used `:target`, which makes opening and closing a *navigation* — so the
   * browser scrolls to whatever the fragment names. Pointing the close link at the Block
   * jumped to the top of the list; pointing it at the trigger instead still jumped, measured
   * at 445px in Chrome, because scrolling is what following a fragment means. There is no
   * href that does not scroll.
   *
   * A checkbox does not navigate. Nothing here may be an anchor, and that is the property
   * worth pinning: an `<a href>` creeping back in is the bug returning.
   */
  it("closes without navigating, so nothing can scroll", () => {
    const { container } = draw(TEAM);

    const close = container.querySelector(".mn-popover-close")!;
    const backdrop = container.querySelector(".mn-popover-backdrop")!;
    const toggleId = container.querySelector("input.mn-popover-toggle")!.id;

    // Both close controls are labels for the same checkbox, not links.
    expect(close.tagName).toBe("LABEL");
    expect(backdrop.tagName).toBe("LABEL");
    expect(close.getAttribute("for")).toBe(toggleId);
    expect(backdrop.getAttribute("for")).toBe(toggleId);

    // Nothing in the whole Block navigates.
    expect(container.querySelectorAll("a[href]")).toHaveLength(0);
  });

  /**
   * Clicking away closes it, which is what everybody expects of a panel like this. The
   * backdrop is a label the size of the dim area, so a click outside the panel unchecks the
   * same box the button does.
   */
  it("closes when the backdrop is clicked", () => {
    const { container } = draw(TEAM);
    const toggle = container.querySelector<HTMLInputElement>("input.mn-popover-toggle")!;
    const backdrop = container.querySelector<HTMLLabelElement>(".mn-popover-backdrop")!;

    toggle.checked = true;
    expect(toggle.checked).toBe(true);

    backdrop.click();
    expect(toggle.checked).toBe(false);
  });

  it("closes when the close button is clicked", () => {
    const { container } = draw(TEAM);
    const toggle = container.querySelector<HTMLInputElement>("input.mn-popover-toggle")!;
    const close = container.querySelector<HTMLLabelElement>(".mn-popover-close")!;

    toggle.checked = true;
    close.click();
    expect(toggle.checked).toBe(false);
  });

  /**
   * The checkbox is the control, so it carries the name and stays reachable by keyboard.
   * The label and the two close controls are decoration a thumb hits, and announcing all
   * three would put "Close" in the tab order twice.
   */
  it("keeps the checkbox reachable and the decoration out of the way", () => {
    const { container } = draw(TEAM);
    const toggle = container.querySelector("input.mn-popover-toggle")!;

    expect(toggle.getAttribute("aria-label")).toContain("Dr Amara Osei");
    // Never display:none -- that would take it out of the focus order and leave a keyboard
    // user with no way to open the panel at all.
    expect(toggle.getAttribute("hidden")).toBeNull();

    for (const cls of [".mn-popover-open", ".mn-popover-backdrop", ".mn-popover-close"]) {
      expect(container.querySelector(cls)!.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("renders the panel's text whether or not it is open", () => {
    // `display: none` hides it; the words are still in the document, so in-page search finds
    // them and a crawler sees them.
    expect(draw(TEAM).container.textContent).toContain("Twenty years in tax.");
  });

  it("drops an item with nothing to click on", () => {
    const { container } = draw([{ trigger: "Kept" }, { trigger: "" }]);
    expect(container.querySelectorAll("label.mn-popover-open")).toHaveLength(1);
  });

  it("draws nothing rather than an empty list", () => {
    expect(draw([]).container.querySelector(".mn-popovers")).toBeNull();
  });
});

describe("two of them on one Page", () => {
  /**
   * The ids come from the Block's own id now, not from a hash of its content.
   *
   * The hash was unique in practice and not in principle: two popover Blocks holding the
   * same three people — a team page and a "meet the team" band on the home page, say —
   * minted identical ids, and one Block's trigger opened the other's panel. A Block id is
   * unique within a Page by construction, which is why `BlockMeta` was added.
   */
  it("do not share ids, even holding exactly the same people", () => {
    const first = draw(TEAM, {}, "blk-aaa").container.querySelector("input.mn-popover-toggle")!.id;
    cleanup();
    const second = draw(TEAM, {}, "blk-bbb").container.querySelector("input.mn-popover-toggle")!.id;

    expect(first).not.toBe(second);
  });

  it("give each panel in one Block its own id", () => {
    const { container } = draw(TEAM);
    const ids = Array.from(container.querySelectorAll("input.mn-popover-toggle")).map((el) => el.id);

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
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
