/**
 * What a storage key may contain, and why anyone should care.
 *
 * ADR-0012 says an image field holds a key and never a URL. That was a convention for a long
 * time: `key` was a bare `z.string()` in both the Section background and every image field.
 *
 * A Section's background key is interpolated into a CSS `url("…")` inside an inline `style`,
 * so a key carrying a quote and a semicolon can close the url token and append declarations
 * of its own. React escapes the attribute, but the browser un-escapes it before the CSS
 * parser reads it, so escaping is not the thing that saves you. It does not reach script —
 * an inline style is a declaration list with no selectors and no at-rules — but
 * `position: fixed; inset: 0; z-index: …` on one Section covers the entire page, Header
 * included, which is defacement and a clickjacking surface; and a `background-image` on
 * another origin is a request every visitor to the Site makes.
 */

import { describe, expect, it } from "vitest";

import { defineBlock } from "../blocks/define";
import { field } from "../blocks/fields";
import { createRegistry } from "../blocks/registry";
import { isSafeStorageKey } from "./storage-key";

describe("keys the product actually produces", () => {
  it.each([
    "2026/09/my-holiday-photo-a1b2c3.jpg",
    "2026/12/file-x9y8z7.png",
    "2026/01/a-very-long-name-that-was-truncated-to-sixty-characters-ab12cd.webp",
    "logo.svg",
    "2026/09/declared.bin",
  ])("accepts %s", (key) => {
    expect(isSafeStorageKey(key)).toBe(true);
  });
});

describe("keys it refuses", () => {
  it("refuses the CSS escape that closes the url() token", () => {
    // The reviewer's proof of concept, kept verbatim because a paraphrase would not be a test.
    const attack =
      'x.png"); background-color: rgb(255 0 0); background-image: url("https://attacker.example/leak.png';

    expect(isSafeStorageKey(attack)).toBe(false);
  });

  it.each([
    ["a quote", 'x.png"'],
    ["a semicolon", "x.png;y"],
    ["a bracket", "x.png)"],
    ["a space", "my photo.png"],
    ["a backslash", "x\\y.png"],
    ["a full URL", "https://attacker.example/leak.png"],
    ["a protocol-relative URL", "//attacker.example/x.png"],
    ["parent traversal", "2026/../../etc/passwd"],
    ["a doubled slash", "2026//09/x.png"],
    ["a leading slash", "/etc/passwd"],
    ["a leading dot", ".env"],
    ["a newline", "x.png\nbackground: red"],
  ])("refuses %s", (_name, key) => {
    expect(isSafeStorageKey(key)).toBe(false);
  });
});

// A registry needs at least one Block Type; this one exists only so a layout can be parsed.
const registry = createRegistry([
  defineBlock({
    name: "spacer",
    label: "Spacer",
    fields: { note: field.text({ label: "Note", default: "" }) },
    render: () => null,
  }),
]);

describe("the layout schema enforces it", () => {
  function layoutWithBackground(key: string) {
    return {
      version: 1,
      slots: {
        header: [],
        main: [
          {
            id: "sec-1",
            layout: "1",
            tone: "default",
            padding: "normal",
            background: { key, overlay: 0.45 },
            columns: [{ id: "col-1", blocks: [] }],
          },
        ],
        sidebar: [],
        footer: [],
      },
    };
  }

  it("accepts a Section background that is a real key", () => {
    const parsed = registry.safeParseLayout(layoutWithBackground("2026/09/roof-a1b2c3.jpg"));
    expect(parsed.error).toBeNull();
  });

  it("rejects a Section background carrying CSS", () => {
    const parsed = registry.safeParseLayout(
      layoutWithBackground('x.png"); position: fixed; inset: 0; z-index: 2147483647; background: url("y'),
    );

    // Refused at parse time, where safeParseLayout can report it to the Author, rather than
    // reaching an inline style and covering their Site.
    expect(parsed.error).not.toBeNull();
  });

  it("still accepts a Section with no background at all", () => {
    expect(registry.safeParseLayout(layoutWithBackground("")).error).toBeNull();
  });
});
