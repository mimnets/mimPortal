// @vitest-environment jsdom

/**
 * The image gallery Block.
 *
 * The lightbox is `:target` and nothing else, so almost everything worth asserting is about
 * the links: that every thumbnail points at an overlay that exists, that two galleries on one
 * Page cannot target each other's images, and that the ends of the sequence do not offer a
 * Previous or a Next that goes nowhere. None of that is visible from looking at one gallery.
 */

import { emptyContext } from "@mimnets/core";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { galleryBlock } from "./design";

afterEach(cleanup);

type GalleryProps = Parameters<typeof galleryBlock.render>[0];

function image(key: string, alt: string) {
  return { key, alt, decorative: false, width: 1200, height: 900 };
}

function props(overrides: Record<string, unknown> = {}): GalleryProps {
  return galleryBlock.propsSchema.parse({
    title: "Recent work",
    items: [
      { image: image("uploads/roof.jpg", "A slate roof"), caption: "Slate, Hebden Bridge" },
      { image: image("uploads/beam.jpg", "An oak beam"), caption: "" },
      { image: image("uploads/door.jpg", "A painted door"), caption: "" },
    ],
    ...overrides,
  }) as GalleryProps;
}

function draw(value: GalleryProps) {
  return render(<>{galleryBlock.render(value, emptyContext(), { id: "blk-test" })}</>);
}

describe("the image gallery Block", () => {
  it("renders nothing when no image has been chosen", () => {
    const { container } = draw(props({ items: [] }));
    expect(container.innerHTML).toBe("");
  });

  it("ignores rows an Author added but never filled in", () => {
    const { container } = draw(
      props({
        items: [
          { image: image("uploads/roof.jpg", "A slate roof"), caption: "" },
          { image: { key: "", alt: "", decorative: false, width: null, height: null }, caption: "" },
        ],
      }),
    );

    // An empty repeater row is a half-finished thought, not a broken image on the Site.
    expect(container.querySelectorAll(".mn-gallery-cell")).toHaveLength(1);
  });

  it("builds image URLs from the media base rather than storing them", () => {
    const { container } = draw(props());

    // ADR-0012: a layout holds a key, and the URL is built at render time.
    const first = container.querySelector<HTMLImageElement>(".mn-gallery-figure img")!;
    expect(first.getAttribute("src")).toBe("/media/uploads/roof.jpg");
  });

  it("points every thumbnail at an overlay that exists", () => {
    const { container } = draw(props());

    const targets = Array.from(container.querySelectorAll<HTMLAnchorElement>(".mn-gallery-open"))
      .map((a) => a.getAttribute("href")!.slice(1));

    expect(targets).toHaveLength(3);
    for (const id of targets) {
      expect(container.querySelector(`#${CSS.escape(id)}`)).toBeTruthy();
    }
  });

  it("does not let two galleries on one Page target each other's images", () => {
    const first = draw(props());
    const second = draw(
      props({
        items: [{ image: image("uploads/other.jpg", "Something else"), caption: "" }],
      }),
    );

    const idOf = (r: ReturnType<typeof draw>) =>
      r.container.querySelector(".mn-gallery-full")!.getAttribute("id");

    expect(idOf(first)).not.toBe(idOf(second));
  });

  it("offers no Previous on the first image and no Next on the last", () => {
    const { container } = draw(props());

    const overlays = Array.from(container.querySelectorAll(".mn-gallery-full"));
    const links = overlays.map((o) =>
      Array.from(o.querySelectorAll(".mn-gallery-step a")).map((a) => a.getAttribute("rel")),
    );

    expect(links).toEqual([["next"], ["prev", "next"], ["prev"]]);
  });

  it("gives every overlay a way back out", () => {
    const { container } = draw(props());

    const closes = container.querySelectorAll(".mn-gallery-close");
    expect(closes).toHaveLength(3);
    // Back to the gallery itself, not to the top of the Page.
    expect(closes[0]!.getAttribute("href")).toBe(
      `#${container.querySelector(".mn-gallery")!.getAttribute("id")}`,
    );
  });

  it("drops the overlays entirely when enlarging is switched off", () => {
    const { container } = draw(props({ enlarge: false }));

    expect(container.querySelectorAll(".mn-gallery-full")).toHaveLength(0);
    expect(container.querySelectorAll(".mn-gallery-open")).toHaveLength(0);
    // The photographs are still there — only the links are gone.
    expect(container.querySelectorAll(".mn-gallery-figure img")).toHaveLength(3);
  });

  it("leaves a decorative image's alt empty rather than inventing one", () => {
    const { container } = draw(
      props({
        items: [
          {
            image: { ...image("uploads/texture.jpg", "ignored"), decorative: true },
            caption: "",
          },
        ],
      }),
    );

    expect(container.querySelector(".mn-gallery-figure img")!.getAttribute("alt")).toBe("");
  });

  it("names the enlarge link after the image, not after its position", () => {
    const { container } = draw(props());

    // "Enlarge: A slate roof" tells a screen reader user which photograph they are opening.
    expect(container.querySelector(".mn-gallery-open")!.getAttribute("aria-label")).toBe(
      "Enlarge: A slate roof",
    );
  });
});
