// @vitest-environment jsdom

/**
 * That every Block Type the standard library ships has its own icon in the picker.
 *
 * Five of twenty-two had one, and the other seventeen shared a generic square — which made
 * the Add Block list a column of identical rows an Author had to read rather than scan. The
 * count is not the point; the drift is. A Block Type is added in `@mimnets/blocks` and the
 * icon map lives here, so nothing fails when the two disagree: the new Block just quietly
 * looks like every other one.
 *
 * This package cannot import `@mimnets/blocks` — it is the other way round — so the list is
 * stated here and this test is the reminder to add an icon when it changes. The same shape as
 * the tone tripwire in core, and for the same reason.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BlockIcon, ICONS_BY_BLOCK } from "./icons";

/** The twenty-four `@mimnets/blocks` ships, in declaration order. */
const STANDARD_BLOCKS = [
  "heading",
  "text",
  "prose",
  "image",
  "logo",
  "menu",
  "contact",
  "eyebrow",
  "button",
  "buttons",
  "features",
  "stats",
  "testimonial",
  "logos",
  "cta",
  "pricing",
  "accordion",
  "gallery",
  "carousel",
  "map",
  "embed",
  "compare",
  "social",
  "popovers",
];

describe("the Block picker's icons", () => {
  it("has one for every Block Type the standard library ships", () => {
    const missing = STANDARD_BLOCKS.filter((name) => !ICONS_BY_BLOCK[name]);

    expect(
      missing,
      `these Block Types would fall back to the generic square: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("draws something for each of them", () => {
    // A key in the map that renders nothing would pass the check above and still leave a
    // blank space in the picker.
    for (const name of STANDARD_BLOCKS) {
      const { container, unmount } = render(<BlockIcon name={name} />);

      expect(container.querySelector("svg"), `${name} drew no icon`).not.toBeNull();
      expect(container.querySelector("svg")?.children.length, `${name} drew an empty icon`)
        .toBeGreaterThan(0);
      unmount();
    }
  });

  it("still falls back for a Block Type this package cannot know about", () => {
    // A Site's own Block, defined in its `blocks/` folder. The generic square is correct
    // there: nothing here can know what somebody else's Block looks like.
    const { container } = render(<BlockIcon name="ledger-deadlines" />);

    expect(container.querySelector("svg")).not.toBeNull();
  });
});
