/**
 * `safeHref` — the boundary between what an Author types and what a browser will follow.
 *
 * React 19 neutralises `javascript:` hrefs on its own, which is why the gap this closes was
 * not already causing incidents. That is not a defence worth resting on: it covers one scheme
 * and lets `vbscript:` and `data:text/html` through, and it is a framework implementation
 * detail rather than a guarantee. These assertions are what actually holds the line, so they
 * are written against the schemes rather than against React's behaviour.
 */

import { describe, expect, it } from "vitest";

import { safeHref } from "./safe-href";

describe("addresses it allows", () => {
  it.each([
    "/about",
    "/services/roofing?ref=footer",
    "#main",
    "?page=2",
    "https://example.com/work",
    "http://example.com",
    "mailto:hello@example.com",
    "tel:+441422123456",
    "about",
    "contact/us",
    "../up-one",
  ])("keeps %s", (href) => {
    expect(safeHref(href)).toBe(href);
  });

  it("trims surrounding whitespace", () => {
    expect(safeHref("  /about  ")).toBe("/about");
  });
});

describe("addresses it refuses", () => {
  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)  ",
    "vbscript:msgbox(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "blob:https://example.com/uuid",
  ])("drops %s", (href) => {
    expect(safeHref(href)).toBe("");
  });

  it("is not fooled by a scheme split across a newline", () => {
    // The URL parser strips tabs and newlines before reading the scheme, so this parses as
    // javascript: and is refused on the protocol rather than surviving as an odd-looking path.
    expect(safeHref("java\nscript:alert(1)")).toBe("");
    expect(safeHref("java\tscript:alert(1)")).toBe("");
  });

  it("returns empty for an empty or blank value", () => {
    expect(safeHref("")).toBe("");
    expect(safeHref("   ")).toBe("");
  });
});
