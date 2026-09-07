// @vitest-environment jsdom

/**
 * The location map Block.
 *
 * The assertions worth having are about which host the visitor's browser is asked to contact
 * and what the frame is allowed to do once it gets there. Both are privacy and security
 * properties that look identical on screen whichever way they are set, so a browser is no
 * help in checking them.
 */

import { emptyContext } from "@mimnets/core";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { mapBlock } from "./design";

afterEach(cleanup);

type MapProps = Parameters<typeof mapBlock.render>[0];

/** The Piece Hall, Halifax. */
function props(overrides: Record<string, unknown> = {}): MapProps {
  return mapBlock.propsSchema.parse({
    label: "The Piece Hall",
    latitude: 53.7213,
    longitude: -1.8574,
    ...overrides,
  }) as MapProps;
}

function draw(value: MapProps) {
  return render(<>{mapBlock.render(value, emptyContext(), { id: "blk-test" })}</>);
}

const frame = (c: HTMLElement) => c.querySelector<HTMLIFrameElement>(".mn-map-frame")!;

describe("the location map Block", () => {
  it("draws nothing until someone has set a location", () => {
    const { container } = draw(props({ latitude: 0, longitude: 0 }));

    // 0,0 is the schema default, not a place anybody chose.
    expect(container.innerHTML).toBe("");
  });

  it("uses OpenStreetMap without being asked", () => {
    const { container } = draw(props());

    // The default is the privacy decision: no key, no account, no third-party cookies.
    expect(frame(container).getAttribute("src")).toContain("openstreetmap.org");
  });

  it("puts a marker at the given point", () => {
    const { container } = draw(props());

    expect(frame(container).getAttribute("src")).toContain("marker=53.7213,-1.8574");
  });

  it("frames a smaller area at street zoom than at city zoom", () => {
    const bboxOf = (value: MapProps) => {
      const { container } = draw(value);
      const src = new URL(frame(container).getAttribute("src")!);
      const [minLon, , maxLon] = src.searchParams.get("bbox")!.split(",").map(Number);
      return maxLon! - minLon!;
    };

    expect(bboxOf(props({ zoom: "street" }))).toBeLessThan(bboxOf(props({ zoom: "city" })));
  });

  it("stays on OpenStreetMap when Google is chosen but no key was given", () => {
    const { container } = draw(props({ provider: "google", googleKey: "" }));

    // Falling back beats rendering a Google frame that answers with an error image.
    expect(frame(container).getAttribute("src")).toContain("openstreetmap.org");
  });

  it("uses Google only when a key is actually present", () => {
    const { container } = draw(props({ provider: "google", googleKey: "test-key" }));

    const src = frame(container).getAttribute("src")!;
    expect(src).toContain("google.com/maps/embed");
    expect(src).toContain("key=test-key");
  });

  it("escapes the key rather than pasting it into a URL", () => {
    const { container } = draw(props({ provider: "google", googleKey: "a b&c" }));

    const src = frame(container).getAttribute("src")!;
    expect(src).toContain("key=a%20b%26c");
    // An unescaped ampersand would end the key parameter and start a new one.
    expect(src).not.toContain("key=a b&c");
  });

  it("sandboxes the frame and never grants it same-origin", () => {
    const { container } = draw(props());

    const sandbox = frame(container).getAttribute("sandbox")!;
    // allow-same-origin next to allow-scripts hands the frame the keys to this Site.
    expect(sandbox).not.toContain("allow-same-origin");
    expect(sandbox).toContain("allow-scripts");
  });

  it("describes the frame by the place it shows", () => {
    const { container } = draw(props());

    // "Map showing The Piece Hall" beats an unnamed frame announced as "map".
    expect(frame(container).getAttribute("title")).toBe("Map showing The Piece Hall");
  });

  it("still titles the frame when nobody named the place", () => {
    const { container } = draw(props({ label: "" }));

    expect(frame(container).getAttribute("title")).toBe("Map");
  });

  it("always offers a link out, for when the frame does not load", () => {
    const { container } = draw(props());

    // A proxy, a content blocker or a printer can all drop the iframe; the address survives.
    const link = container.querySelector<HTMLAnchorElement>(".mn-map-caption a")!;
    expect(link.getAttribute("href")).toContain("openstreetmap.org");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("defers loading the frame until it is near the viewport", () => {
    const { container } = draw(props());

    expect(frame(container).getAttribute("loading")).toBe("lazy");
  });
});
