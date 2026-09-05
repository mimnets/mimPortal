// @vitest-environment jsdom

/**
 * The video Block.
 *
 * This is the Block where a test is not optional. Its whole job is deciding which origin is
 * allowed to run code in a frame on the Site, from a string an Author pasted, and every wrong
 * answer looks exactly like a video that did not load. The allowlist is asserted from both
 * sides: the addresses that must produce a player, and the ones that must never produce a
 * frame at all.
 */

import { emptyContext } from "@mimnets/core";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { embedBlock } from "./design";

afterEach(cleanup);

type EmbedProps = Parameters<typeof embedBlock.render>[0];

function props(url: string, overrides: Record<string, unknown> = {}): EmbedProps {
  return embedBlock.propsSchema.parse({
    url,
    title: "How we lay a slate roof",
    ...overrides,
  }) as EmbedProps;
}

function draw(url: string, overrides: Record<string, unknown> = {}) {
  return render(<>{embedBlock.render(props(url, overrides), emptyContext())}</>);
}

const frameSrc = (c: HTMLElement) =>
  c.querySelector<HTMLIFrameElement>(".mn-embed-frame")?.getAttribute("src") ?? null;

describe("recognising a video address", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("turns %s into a no-cookie player", (url, id) => {
    const { container } = draw(url);

    // youtube-nocookie is the same player without the tracking cookie set on arrival.
    expect(frameSrc(container)).toBe(`https://www.youtube-nocookie.com/embed/${id}`);
  });

  it.each([
    ["https://vimeo.com/76979871", "76979871"],
    ["https://player.vimeo.com/video/76979871", "76979871"],
  ])("turns %s into a Vimeo player", (url, id) => {
    const { container } = draw(url);

    expect(frameSrc(container)).toBe(`https://player.vimeo.com/video/${id}`);
  });
});

describe("refusing an address it does not recognise", () => {
  it("shows a link instead of framing an unknown host", () => {
    const { container } = draw("https://example.com/video.mp4");

    // Wrong, possibly. Dangerous, no.
    expect(container.querySelector(".mn-embed-frame")).toBeNull();
    expect(container.querySelector(".mn-embed-fallback a")!.getAttribute("href")).toBe(
      "https://example.com/video.mp4",
    );
  });

  it.each([
    // Beats `host.endsWith("youtube.com")`.
    "https://evil-youtube.com/watch?v=dQw4w9WgXcQ",
    // Beats `host.startsWith("youtube.com")` and `host.includes("youtube.com")`.
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    // Beats a check that looks at the path instead of the host.
    "https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ",
  ])("never frames %s", (url) => {
    const { container } = draw(url);

    // Each of these is a host that passes one of the obvious shortcuts for "is this
    // YouTube?". Only an equality check on the hostname refuses all three.
    expect(container.querySelector(".mn-embed-frame")).toBeNull();
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
  ])("renders nothing at all for %s", (url) => {
    const { container } = draw(url);

    // Not even as a link — an href is enough to run a javascript: URL.
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing while the Author is still typing", () => {
    const { container } = draw("https:/");

    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when the field is empty", () => {
    const { container } = draw("");

    expect(container.innerHTML).toBe("");
  });
});

describe("the frame itself", () => {
  it("is sandboxed without same-origin", () => {
    const { container } = draw("https://youtu.be/dQw4w9WgXcQ");

    const sandbox = container
      .querySelector(".mn-embed-frame")!
      .getAttribute("sandbox")!;
    expect(sandbox).not.toContain("allow-same-origin");
    expect(sandbox).toContain("allow-scripts");
  });

  it("is described by what the video is", () => {
    const { container } = draw("https://youtu.be/dQw4w9WgXcQ");

    expect(container.querySelector(".mn-embed-frame")!.getAttribute("title")).toBe(
      "How we lay a slate roof",
    );
  });

  it("still has a title when the Author left the description empty", () => {
    const { container } = draw("https://youtu.be/dQw4w9WgXcQ", { title: "" });

    // An untitled frame is announced as "frame" and nothing else.
    expect(container.querySelector(".mn-embed-frame")!.getAttribute("title")).toBe("Video");
  });

  it("tolerates an address pasted with whitespace around it", () => {
    const { container } = draw("  https://youtu.be/dQw4w9WgXcQ  ");

    expect(frameSrc(container)).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });
});
