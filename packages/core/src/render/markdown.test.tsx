// @vitest-environment jsdom

/**
 * The shared Markdown renderer (ADR-0011).
 *
 * Two things are being asserted, and only one of them is about Markdown. The first is that it
 * renders prose correctly. The second, and the reason this file is longer than it looks like
 * it should be, is that an Author is a client: everything they type is untrusted input that
 * ends up inside a React tree. Every escape below is a thing that would be a stored
 * cross-site-scripting bug if it stopped holding, and none of them are visible on a page that
 * looks right.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { markdownToText, renderMarkdown } from "./markdown";

afterEach(cleanup);

function draw(source: string) {
  return render(<>{renderMarkdown(source)}</>);
}

describe("rendering prose", () => {
  it("returns nothing for empty source", () => {
    expect(renderMarkdown("")).toEqual([]);
    expect(renderMarkdown("   \n  ")).toEqual([]);
  });

  it("renders paragraphs, headings and emphasis", () => {
    const { container } = draw("# Terms\n\nWe are **clear** about _this_.");

    expect(container.querySelector("h1")!.textContent).toBe("Terms");
    expect(container.querySelector("strong")!.textContent).toBe("clear");
    expect(container.querySelector("em")!.textContent).toBe("this");
  });

  it("renders nested lists", () => {
    const { container } = draw("- one\n  - inner\n- two");

    // The token stream is flat; nesting is the part a naive walk gets wrong.
    const outer = container.querySelector("ul")!;
    expect(outer.querySelectorAll("li")).toHaveLength(3);
    expect(outer.querySelector("ul")).toBeTruthy();
  });

  it("keeps an ordered list's starting number", () => {
    const { container } = draw("4. four\n5. five");

    expect(container.querySelector("ol")!.getAttribute("start")).toBe("4");
  });

  it("renders a fenced code block without treating it as Markdown", () => {
    const { container } = draw("```\n# not a heading\n```");

    expect(container.querySelector("pre code")!.textContent).toBe("# not a heading\n");
    expect(container.querySelector("h1")).toBeNull();
  });

  it("renders a blockquote", () => {
    const { container } = draw("> Said the client.");

    expect(container.querySelector("blockquote")!.textContent).toContain("Said the client.");
  });
});

describe("refusing to be an HTML editor", () => {
  it("shows a pasted script tag as words on the page", () => {
    const { container } = draw("Hello <script>alert(1)</script> there");

    // Not sanitised — never parsed. The text is the text.
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("does not build an image with an onerror handler", () => {
    const { container } = draw('<img src=x onerror="alert(1)">');

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img");
  });

  it("does not build an iframe", () => {
    const { container } = draw('<iframe src="https://evil.example"></iframe>');

    expect(container.querySelector("iframe")).toBeNull();
  });

  it("escapes an HTML entity rather than resolving it into markup", () => {
    const { container } = draw("&lt;script&gt;alert(1)&lt;/script&gt;");

    expect(container.querySelector("script")).toBeNull();
  });
});

describe("links", () => {
  it("refuses a javascript: URL in Markdown link syntax", () => {
    const { container } = draw("[click me](javascript:alert(1))");

    // markdown-it's own link validation. Asserted here because it is load-bearing, and a
    // future option change could switch it off without anything else noticing.
    const link = container.querySelector("a");
    expect(link?.getAttribute("href") ?? "").not.toContain("javascript:");
  });

  it("refuses a data: URL in Markdown link syntax", () => {
    const { container } = draw("[click me](data:text/html,<script>alert(1)</script>)");

    const link = container.querySelector("a");
    expect(link?.getAttribute("href") ?? "").not.toContain("data:text/html");
  });

  it("sends an off-site link out safely", () => {
    const { container } = draw("[our supplier](https://example.com)");

    const link = container.querySelector("a")!;
    expect(link.getAttribute("target")).toBe("_blank");
    // Without noreferrer the destination is handed both the referrer and window.opener.
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("leaves an internal link alone", () => {
    const { container } = draw("[our services](/services)");

    const link = container.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("/services");
    // Opening the Site's own pages in a new tab is a nuisance, not a safety measure.
    expect(link.getAttribute("target")).toBeNull();
  });

  it("linkifies a bare address and still sends it out safely", () => {
    const { container } = draw("Read more at https://example.com today.");

    const link = container.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("drops attributes nobody asked for", () => {
    const { container } = draw('[titled](https://example.com "A title")');

    const link = container.querySelector("a")!;
    expect(link.getAttribute("title")).toBe("A title");
    // The allowlist is per tag; anything not on it never reaches the element.
    expect(link.getAttribute("onclick")).toBeNull();
  });
});

describe("markdownToText", () => {
  it("strips the structural punctuation and keeps the words", () => {
    expect(markdownToText("# Heading\n\nSome **bold** and [a link](/x).")).toBe(
      "Heading Some bold and a link.",
    );
  });

  it("drops code blocks rather than indexing their contents", () => {
    expect(markdownToText("Before\n\n```\nconst x = 1;\n```\n\nAfter")).toBe("Before After");
  });

  it("drops an image but keeps a link's text", () => {
    expect(markdownToText("![a roof](/img.png) and [our work](/work)")).toBe("and our work");
  });
});
