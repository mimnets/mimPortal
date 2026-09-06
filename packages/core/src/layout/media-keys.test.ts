/**
 * Finding every picture a layout uses.
 *
 * The point of it is a question an Author could not previously ask: "is anything using this
 * file?" Getting it wrong in one direction shows a scary warning about a file nobody uses;
 * getting it wrong in the other tells somebody a picture is safe to delete and then breaks a
 * Page. The second is the one these tests are mostly about.
 */

import { describe, expect, it } from "vitest";

import { mediaKeysIn, usesMediaKey } from "./media-keys";

const image = (key: string) => ({ key, alt: "A chef plating a dish", width: 800, height: 600 });

describe("the keys a layout refers to", () => {
  it("finds a picture in a Block's props", () => {
    expect(mediaKeysIn({ type: "image", props: { image: image("m/a.jpg") } })).toEqual(["m/a.jpg"]);
  });

  it("finds a Section's background photograph, which has no alt text", () => {
    // A different shape from an image field: `{ key, overlay }`. Missing it would report a
    // hero image as unused.
    expect(mediaKeysIn({ background: { key: "m/hero.jpg", overlay: 0.45 } })).toEqual([
      "m/hero.jpg",
    ]);
  });

  it("finds pictures inside a repeater, however deep", () => {
    // A carousel's slides and a testimonial's portraits are arrays of objects inside props,
    // which is where most of the images on a real Page actually live.
    const layout = {
      slots: {
        main: [
          {
            columns: [
              {
                blocks: [
                  { type: "carousel", props: { slides: [{ image: image("m/1.jpg") }, { image: image("m/2.jpg") }] } },
                  { type: "quotes", props: { items: [{ portrait: image("m/3.jpg") }] } },
                ],
              },
            ],
          },
        ],
      },
    };

    expect(mediaKeysIn(layout).sort()).toEqual(["m/1.jpg", "m/2.jpg", "m/3.jpg"]);
  });

  it("finds a picture in a Block this Site can no longer render", () => {
    // The reason this walks the document rather than asking the registry. A Page can hold a
    // Block whose type was removed from `blocks.config.ts`; it still holds the picture, and a
    // check that could not see it would call the file unused.
    expect(mediaKeysIn({ type: "retired-gallery", props: { image: image("m/old.jpg") } })).toEqual([
      "m/old.jpg",
    ]);
  });

  it("counts a picture used twice only once", () => {
    const twice = { a: { image: image("m/same.jpg") }, b: { image: image("m/same.jpg") } };

    expect(mediaKeysIn(twice)).toEqual(["m/same.jpg"]);
  });

  it("ignores an empty key, which is what an unset image field holds", () => {
    expect(mediaKeysIn({ props: { image: { key: "", alt: "", width: null, height: null } } })).toEqual(
      [],
    );
  });

  it("does not mistake an unrelated `key` for a picture", () => {
    // Ids, layout names and anything else called `key` without an image's companion field.
    expect(mediaKeysIn({ key: "sec-1" })).toEqual([]);
    expect(mediaKeysIn({ id: "blk-1", key: "1-1", columns: [] })).toEqual([]);
  });

  it("survives the shapes a stored document can actually be in", () => {
    for (const odd of [null, undefined, 0, "", "a string", [], {}, [null, undefined]]) {
      expect(() => mediaKeysIn(odd)).not.toThrow();
    }
  });

  it("answers the question the media library asks", () => {
    const page = { background: { key: "m/hero.jpg", overlay: 0.45 } };

    expect(usesMediaKey(page, "m/hero.jpg")).toBe(true);
    expect(usesMediaKey(page, "m/unused.jpg")).toBe(false);
  });
});
