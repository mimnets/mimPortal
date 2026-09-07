// @vitest-environment jsdom

/**
 * The logo Block.
 *
 * Found in the same sweep as the button: its "Links to" field is free text a client edits and
 * became an href with no protocol check. This one is the more exposed of the two, because a
 * logo lives in the Header and a Header is shared — one bad address is on every Page of the
 * Site at once, rather than on the Page somebody put a button on.
 */

import { emptyContext } from "@mimnets/core";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { logoBlock } from "./index";

afterEach(cleanup);

type LogoProps = Parameters<typeof logoBlock.render>[0];

function draw(overrides: Record<string, unknown> = {}) {
  const props = logoBlock.propsSchema.parse({
    text: "Mimnets",
    ...overrides,
  }) as LogoProps;
  return render(<>{logoBlock.render(props, emptyContext())}</>);
}

const href = (c: HTMLElement) => c.querySelector("a.mn-logo")?.getAttribute("href");

describe("what it draws", () => {
  it("links home by default", () => {
    expect(href(draw().container)).toBe("/");
  });

  it("keeps the text logo when there is no image", () => {
    expect(draw().container.querySelector("a.mn-logo")?.textContent).toContain("Mimnets");
  });
});

describe("addresses it refuses", () => {
  it.each([
    "javascript:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
  ])("refuses %s", (bad) => {
    expect(href(draw({ href: bad }).container)).toBe("/");
  });

  it("keeps the ordinary addresses a client actually types", () => {
    for (const good of ["/", "/home", "https://example.com", "#top"]) {
      cleanup();
      expect(href(draw({ href: good }).container)).toBe(good);
    }
  });
});
