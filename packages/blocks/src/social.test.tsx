// @vitest-environment jsdom

/**
 * The social links Block.
 *
 * Its address field is a free-text box on a Page that a client edits, and whatever goes in it
 * becomes an href. That makes this Block a place where `javascript:` can be typed by hand, so
 * most of what follows is about what it refuses rather than what it renders.
 */

import { emptyContext } from "@mimnets/core";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { socialBlock } from "./design";

afterEach(cleanup);

type SocialProps = Parameters<typeof socialBlock.render>[0];

function draw(items: { network: string; href: string; label?: string }[], rest = {}) {
  const props = socialBlock.propsSchema.parse({
    items,
    ...rest,
  }) as SocialProps;
  return render(<>{socialBlock.render(props, emptyContext(), { id: "blk-test" })}</>);
}

const hrefs = (c: HTMLElement) =>
  Array.from(c.querySelectorAll("a")).map((a) => a.getAttribute("href"));

describe("addresses it accepts", () => {
  it("keeps a web address as it is", () => {
    const { container } = draw([{ network: "instagram", href: "https://instagram.com/mimnets" }]);

    expect(hrefs(container)).toEqual(["https://instagram.com/mimnets"]);
  });

  it("turns an email address into a mailto: link", () => {
    const { container } = draw([{ network: "email", href: "hello@example.com" }]);

    expect(hrefs(container)).toEqual(["mailto:hello@example.com"]);
  });

  it("turns a phone number into a tel: link with the punctuation removed", () => {
    const { container } = draw([{ network: "phone", href: "+44 (0)1422 123 456" }]);

    // A dialler wants digits; the Author wants to write it the way it is printed.
    expect(hrefs(container)).toEqual(["tel:+4401422123456"]);
  });

  it("leaves an address alone that already has its scheme", () => {
    const { container } = draw([{ network: "email", href: "mailto:hello@example.com" }]);

    expect(hrefs(container)).toEqual(["mailto:hello@example.com"]);
  });
});

describe("addresses it refuses", () => {
  it.each([
    ["website", "javascript:alert(1)"],
    ["website", "data:text/html,<script>alert(1)</script>"],
    ["website", "file:///etc/passwd"],
    ["instagram", "vbscript:msgbox(1)"],
  ])("drops a %s link to %s", (network, href) => {
    const { container } = draw([{ network, href }]);

    // Dropped entirely — rendering it as text would still be fine, but rendering it as an
    // href would not, and there is nothing useful to show.
    expect(container.innerHTML).toBe("");
  });

  it("drops an email address that is not one", () => {
    const { container } = draw([{ network: "email", href: "javascript:alert(1)" }]);

    expect(container.innerHTML).toBe("");
  });

  it("drops a phone number with a script in it", () => {
    const { container } = draw([{ network: "phone", href: "javascript:alert(1)" }]);

    expect(container.innerHTML).toBe("");
  });

  it("drops a row the Author left blank", () => {
    const { container } = draw([
      { network: "instagram", href: "https://instagram.com/mimnets" },
      { network: "facebook", href: "" },
    ]);

    expect(container.querySelectorAll("a")).toHaveLength(1);
  });

  it("renders nothing at all when no row has a usable address", () => {
    expect(draw([{ network: "facebook", href: "" }]).container.innerHTML).toBe("");
    expect(draw([]).container.innerHTML).toBe("");
  });
});

describe("how the links read", () => {
  it("names a link after its network rather than its address", () => {
    const { container } = draw([
      { network: "linkedin", href: "https://linkedin.com/company/mimnets" },
    ]);

    // "LinkedIn" in a list of links beats a URL read out character by character.
    expect(container.querySelector("a")!.textContent).toBe("LinkedIn");
  });

  it("lets an Author name one themselves", () => {
    const { container } = draw([
      { network: "instagram", href: "https://instagram.com/mimnets", label: "Our photos" },
    ]);

    expect(container.querySelector("a")!.textContent).toBe("Our photos");
  });

  it("carries the network as data so a Theme can add its own glyph", () => {
    const { container } = draw([{ network: "youtube", href: "https://youtube.com/@mimnets" }]);

    // No logo ships with the Block; this is the hook that lets a Site supply one.
    expect(container.querySelector("a")!.getAttribute("data-network")).toBe("youtube");
  });

  it("sends an off-site link out safely and marks it as this Site's own profile", () => {
    const { container } = draw([{ network: "github", href: "https://github.com/mimnets" }]);

    const link = container.querySelector("a")!;
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("me noreferrer");
  });

  it("does not open a mailto: or tel: link in a new tab", () => {
    const { container } = draw([
      { network: "email", href: "hello@example.com" },
      { network: "phone", href: "01422123456" },
    ]);

    for (const link of Array.from(container.querySelectorAll("a"))) {
      // A blank tab that opens the mail client and then sits there empty is a bug.
      expect(link.getAttribute("target")).toBeNull();
    }
  });
});
