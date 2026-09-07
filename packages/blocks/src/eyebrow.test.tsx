// @vitest-environment jsdom

/**
 * The eyebrow, which is the first Block to offer a Theme colour instead of owning one.
 *
 * Worth testing against the real Block rather than a stand-in for the reason the variant
 * migration was: the mechanism is in core and is covered there, but the *declaration* lives
 * here, and deleting the field or changing its default is a one-line edit that no test in
 * core would notice. What it would do is repaint the eyebrow on every Page of every Site.
 */

import { emptyContext } from "@mimnets/core";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { eyebrowBlock } from "./design";

afterEach(cleanup);

type EyebrowProps = Parameters<typeof eyebrowBlock.render>[0];

function draw(overrides: Record<string, unknown> = {}) {
  const props = eyebrowBlock.propsSchema.parse({ text: "Open Wednesday to Sunday", ...overrides });
  const { container } = render(<>{eyebrowBlock.render(props as EyebrowProps, emptyContext(), { id: "blk-test" })}</>);
  return container.querySelector(".mn-eyebrow");
}

describe("the eyebrow's colour", () => {
  it("is the accent for an eyebrow nobody has changed", () => {
    // Every eyebrow on every Site predates this field. They must all still be accent, which
    // is what the rule about a Block keeping its existing look means in practice.
    expect(draw()?.getAttribute("data-colour")).toBe("accent");
  });

  it("reaches the page as the token name, never as a colour", () => {
    for (const colour of ["primary", "accentText", "primaryText"]) {
      expect(draw({ colour })?.getAttribute("data-colour")).toBe(colour);
    }
  });

  it("offers only tokens that read at its size", () => {
    // Small, bold, uppercase text. `muted` and `text` are deliberately not offered: an
    // eyebrow set in body-text grey stops being the hierarchy it exists to provide.
    expect(eyebrowBlock.fields.colour.options).toEqual([
      "accent",
      "primary",
      "accentText",
      "primaryText",
    ]);
  });

  it("still renders nothing when it has no text", () => {
    expect(draw({ text: "" })).toBeNull();
  });
});
