/**
 * Finding the photographs a Preset asked for.
 *
 * A generated layout leaves every `key` empty and writes what the picture should be into
 * `alt`. This walker finds those, and the case it exists for is the repeater: the gallery, the
 * carousel and the testimonial strip keep all of their images inside one, so a walker that
 * only looked at top-level fields would find nothing on a Preset's most photographic Blocks
 * and nobody would notice, because the result — grey rectangles — is what it looked like
 * before.
 */

import { describe, expect, it } from "vitest";

import { defineBlock } from "../blocks/define";
import { field } from "../blocks/fields";
import { createRegistry } from "../blocks/registry";
import { emptyLayout, type PageLayout } from "../layout/schema";
import { findEmptyImages, findEmptySectionBackgrounds } from "./images";

const banner = defineBlock({
  name: "banner",
  label: "Banner",
  fields: { heading: field.text({ label: "Heading" }), picture: field.image({ label: "Picture" }) },
  render: () => null,
});

const strip = defineBlock({
  name: "strip",
  label: "Strip",
  fields: {
    items: field.repeater({
      label: "Items",
      fields: { photo: field.image({ label: "Photo" }), caption: field.text({ label: "Caption" }) },
    }),
  },
  render: () => null,
});

const registry = createRegistry([banner, strip]);

function image(alt: string, key = "") {
  return { key, alt, decorative: false, width: null, height: null };
}

function pageWith(blocks: { type: string; props: Record<string, unknown> }[]): PageLayout {
  const layout = emptyLayout();
  layout.slots.main.push({
    id: "sec-1",
    layout: "1",
    tone: "default",
    padding: "normal",
    background: { key: "", overlay: 0.45 },
    columns: [
      {
        id: "col-1",
        blocks: blocks.map((block, index) => ({
          id: `blk-${index}`,
          type: block.type,
          props: block.props,
          style: {},
        })),
      },
    ],
  } as never);
  return layout;
}

describe("finding described but empty images", () => {
  it("finds one on a Block's own field", () => {
    const layout = pageWith([
      { type: "banner", props: { heading: "Kitchens", picture: image("a fitted oak kitchen") } },
    ]);

    const holes = findEmptyImages(registry, layout);

    expect(holes).toHaveLength(1);
    expect(holes[0]!.alt).toBe("a fitted oak kitchen");
    expect(holes[0]!.key).toBe("picture");
  });

  it("descends into a repeater", () => {
    const layout = pageWith([
      {
        type: "strip",
        props: {
          items: [
            { photo: image("a slate roof"), caption: "" },
            { photo: image("an oak beam"), caption: "" },
          ],
        },
      },
    ]);

    // The whole reason this walker is not three lines.
    expect(findEmptyImages(registry, layout).map((hole) => hole.alt)).toEqual([
      "a slate roof",
      "an oak beam",
    ]);
  });

  it("leaves a field that already has a photograph alone", () => {
    const layout = pageWith([
      {
        type: "banner",
        props: { heading: "", picture: image("chosen by somebody", "2026/09/roof-a1b2c3.jpg") },
      },
    ]);

    // Applying a Preset over a Site that already has pictures must not replace them.
    expect(findEmptyImages(registry, layout)).toEqual([]);
  });

  it("ignores an empty field nobody described", () => {
    const layout = pageWith([{ type: "banner", props: { heading: "", picture: image("") } }]);

    // A hole with no description is one nobody said how to fill; searching for "" would
    // return whatever the provider felt like.
    expect(findEmptyImages(registry, layout)).toEqual([]);
  });

  it("ignores whitespace as a description", () => {
    const layout = pageWith([{ type: "banner", props: { heading: "", picture: image("   ") } }]);

    expect(findEmptyImages(registry, layout)).toEqual([]);
  });

  it("skips a Block Type this Site does not register", () => {
    const layout = pageWith([
      { type: "not-installed", props: { picture: image("something") } },
    ]);

    // The same reasoning as the renderer: an unknown Block is not a crash.
    expect(findEmptyImages(registry, layout)).toEqual([]);
  });

  it("hands back a reference the caller can fill in place", () => {
    const layout = pageWith([
      { type: "banner", props: { heading: "", picture: image("a slate roof") } },
    ]);

    const [hole] = findEmptyImages(registry, layout);
    hole!.container[hole!.key] = image("a slate roof", "2026/09/filled.jpg");

    const block = layout.slots.main[0]!.columns[0]!.blocks[0]!;
    expect((block.props as { picture: { key: string } }).picture.key).toBe("2026/09/filled.jpg");
  });
});

describe("finding Section backgrounds", () => {
  it("uses the Section's first heading as the description", () => {
    const layout = pageWith([
      { type: "banner", props: { heading: "Cooked over fire", picture: image("", "x.jpg") } },
    ]);

    // A background is decorative and carries no alt of its own, so there is nothing for a
    // Preset to have described. The heading is the nearest true thing.
    const found = findEmptySectionBackgrounds(layout);
    expect(found).toHaveLength(1);
    expect(found[0]!.heading).toBe("Cooked over fire");
  });

  it("leaves a Section that already has a background alone", () => {
    const layout = pageWith([{ type: "banner", props: { heading: "A heading", picture: image("") } }]);
    layout.slots.main[0]!.background = { key: "2026/09/band.jpg", overlay: 0.45 };

    expect(findEmptySectionBackgrounds(layout)).toEqual([]);
  });

  it("skips a Section with nothing to describe it", () => {
    const layout = pageWith([{ type: "banner", props: { heading: "", picture: image("") } }]);

    // Rather than searching for an empty string, which returns whatever is popular today.
    expect(findEmptySectionBackgrounds(layout)).toEqual([]);
  });
});
