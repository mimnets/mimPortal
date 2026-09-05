// @vitest-environment jsdom

/**
 * The carousel Block.
 *
 * Nothing here moves without a browser, so the assertions are about the contract that makes
 * it operable when one arrives: the track is a labelled scroll region that can take focus,
 * every dot points at a slide that exists, and two carousels on a Page address their own
 * slides rather than each other's.
 */

import { emptyContext } from "@mimnets/core";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { carouselBlock } from "./design";

afterEach(cleanup);

type CarouselProps = Parameters<typeof carouselBlock.render>[0];

function image(key: string, alt: string) {
  return { key, alt, decorative: false, width: 1600, height: 900 };
}

function props(overrides: Record<string, unknown> = {}): CarouselProps {
  return carouselBlock.propsSchema.parse({
    title: "What we build",
    items: [
      { image: image("uploads/a.jpg", "A kitchen"), heading: "Kitchens", text: "Fitted." },
      { image: image("uploads/b.jpg", "A loft"), heading: "Lofts", text: "Converted." },
    ],
    ...overrides,
  }) as CarouselProps;
}

function draw(value: CarouselProps) {
  return render(<>{carouselBlock.render(value, emptyContext())}</>);
}

describe("the carousel Block", () => {
  it("renders nothing without slides", () => {
    const { container } = draw(props({ items: [] }));
    expect(container.innerHTML).toBe("");
  });

  it("makes the track a scroll region a keyboard can reach", () => {
    const { container } = draw(props());
    const track = container.querySelector(".mn-carousel-track")!;

    // All three together are the contract. A scrollable box with no tabindex cannot be
    // scrolled by keyboard at all, and one with no label is an unnamed region.
    expect(track.getAttribute("role")).toBe("region");
    expect(track.getAttribute("aria-label")).toBe("What we build");
    expect(track.getAttribute("tabindex")).toBe("0");
  });

  it("falls back to a generic label when the Author gave no title", () => {
    const { container } = draw(props({ title: "" }));

    expect(container.querySelector(".mn-carousel-track")!.getAttribute("aria-label")).toBe(
      "Carousel",
    );
  });

  it("points every dot at a slide that exists", () => {
    const { container } = draw(props());

    const dots = Array.from(container.querySelectorAll<HTMLAnchorElement>(".mn-carousel-dots a"));
    expect(dots).toHaveLength(2);

    for (const dot of dots) {
      const id = dot.getAttribute("href")!.slice(1);
      expect(container.querySelector(`#${CSS.escape(id)}`)).toBeTruthy();
    }
  });

  it("names each dot after its slide rather than by number", () => {
    const { container } = draw(props());

    const labels = Array.from(container.querySelectorAll(".mn-carousel-dots a")).map((a) =>
      a.getAttribute("aria-label"),
    );
    expect(labels).toEqual(["Kitchens", "Lofts"]);
  });

  it("numbers a dot only when its slide has no heading to use", () => {
    const { container } = draw(
      props({
        items: [
          { image: image("uploads/a.jpg", "One"), heading: "", text: "" },
          { image: image("uploads/b.jpg", "Two"), heading: "", text: "" },
        ],
      }),
    );

    const labels = Array.from(container.querySelectorAll(".mn-carousel-dots a")).map((a) =>
      a.getAttribute("aria-label"),
    );
    expect(labels).toEqual(["Slide 1", "Slide 2"]);
  });

  it("omits the dots when there is only one slide", () => {
    const { container } = draw(
      props({ items: [{ image: image("uploads/a.jpg", "Only"), heading: "Only", text: "" }] }),
    );

    // One dot for one slide is a control that does nothing.
    expect(container.querySelector(".mn-carousel-dots")).toBeNull();
  });

  it("does not let two carousels address each other's slides", () => {
    const first = draw(props());
    const second = draw(
      props({
        items: [{ image: image("uploads/z.jpg", "Other"), heading: "Something else", text: "" }],
      }),
    );

    const idOf = (r: ReturnType<typeof draw>) =>
      r.container.querySelector(".mn-carousel-slide")!.getAttribute("id");

    expect(idOf(first)).not.toBe(idOf(second));
  });

  it("loads the first slide eagerly and the rest lazily", () => {
    const { container } = draw(props());

    const loading = Array.from(container.querySelectorAll("img")).map((img) =>
      img.getAttribute("loading"),
    );
    // The first slide is visible on arrival, so deferring it would delay what a visitor sees.
    expect(loading).toEqual([null, "lazy"]);
  });

  it("opens a slide's link in a new tab only when asked, and safely", () => {
    const { container } = draw(
      props({
        items: [
          {
            image: image("uploads/a.jpg", "A kitchen"),
            heading: "Kitchens",
            text: "",
            link: { label: "See more", href: "https://example.com", newTab: true },
          },
        ],
      }),
    );

    const link = container.querySelector(".mn-carousel-link")!;
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("leaves out the body entirely when a slide is only a photograph", () => {
    const { container } = draw(
      props({
        items: [{ image: image("uploads/a.jpg", "Just a picture"), heading: "", text: "" }],
      }),
    );

    expect(container.querySelector(".mn-carousel-body")).toBeNull();
    expect(container.querySelector("img")).toBeTruthy();
  });
});
