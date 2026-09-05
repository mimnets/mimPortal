/**
 * The StockAdapter and its two implementations.
 *
 * Against a stubbed `fetch` rather than the real APIs. Both providers need a key nobody has
 * in CI, both rate-limit, and what is worth asserting here is not that Unsplash is up — it is
 * that a Site credits the photographer, refuses anything that is not an image, and treats a
 * provider having a bad day as "no photographs" rather than as a failed Preset.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadPhoto, unconfiguredStock, type StockPhoto } from "./adapter";
import { unsplashStock } from "./unsplash";
import { pexelsStock } from "./pexels";

const real = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = real;
  vi.restoreAllMocks();
});

/** Replies with `body` as JSON, and records what was asked for. */
function replyingWith(body: unknown, init: { status?: number } = {}) {
  const calls: URL[] = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    calls.push(new URL(String(input)));
    return new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

const unsplashResult = {
  results: [
    {
      id: "abc123",
      description: "A caption written for a gallery",
      alt_description: "A slate roof under a grey sky",
      width: 4000,
      height: 3000,
      urls: { regular: "https://images.unsplash.example/abc123" },
      links: {
        html: "https://unsplash.example/photos/abc123",
        download_location: "https://api.unsplash.example/photos/abc123/download",
      },
      user: { name: "A Photographer", links: { html: "https://unsplash.example/@someone" } },
    },
  ],
};

const pexelsResult = {
  photos: [
    {
      id: 987,
      alt: "An oak beam",
      width: 5000,
      height: 3333,
      url: "https://pexels.example/photo/987",
      photographer: "Another Photographer",
      photographer_url: "https://pexels.example/@another",
      src: { large2x: "https://images.pexels.example/987-large2x" },
    },
  ],
};

describe("an unconfigured Site", () => {
  it("finds nothing, without failing", async () => {
    const stock = unconfiguredStock();

    expect(stock.configured).toBe(false);
    // Applying a Preset here leaves the image fields empty and everything else works, which
    // is exactly what happened before stock photography existed.
    await expect(stock.search("a restaurant interior")).resolves.toEqual([]);
  });
});

describe("Unsplash", () => {
  it("carries the photographer through, because the licence requires it", async () => {
    replyingWith(unsplashResult);

    const [photo] = await unsplashStock("key").search("a slate roof");

    expect(photo!.credit).toEqual({
      name: "A Photographer",
      url: "https://unsplash.example/@someone",
    });
    expect(photo!.sourceUrl).toBe("https://unsplash.example/photos/abc123");
  });

  it("prefers the description written to be alt text", async () => {
    replyingWith(unsplashResult);

    const [photo] = await unsplashStock("key").search("a slate roof");

    // `alt_description` is written for this; `description` is a caption for a gallery page.
    expect(photo!.description).toBe("A slate roof under a grey sky");
  });

  it("asks for photographs rather than illustrations", async () => {
    const calls = replyingWith(unsplashResult);

    await unsplashStock("key").search("a slate roof", { orientation: "landscape", count: 3 });

    const query = calls[0]!.searchParams;
    expect(query.get("query")).toBe("a slate roof");
    expect(query.get("orientation")).toBe("landscape");
    expect(query.get("per_page")).toBe("3");
    expect(query.get("content_filter")).toBe("high");
  });

  it("treats a rate limit as an error the caller can survive", async () => {
    replyingWith({}, { status: 403 });

    await expect(unsplashStock("key").search("anything")).rejects.toThrow("403");
  });

  it("drops a result with no photographer rather than crediting nobody", async () => {
    replyingWith({ results: [{ ...unsplashResult.results[0], user: {} }] });

    expect(await unsplashStock("key").search("a slate roof")).toEqual([]);
  });

  it("reports a use, because fetching the file does not count", async () => {
    replyingWith(unsplashResult);
    const stock = unsplashStock("key");
    const [photo] = await stock.search("a slate roof");

    const calls = replyingWith({});
    await stock.trackUse!(photo!);

    // Their guidelines are explicit that downloading the image is not a reported download,
    // and a client that never reports is one they can revoke.
    expect(calls[0]!.toString()).toBe("https://api.unsplash.example/photos/abc123/download");
  });

  it("does not lose a photograph because the analytics call failed", async () => {
    replyingWith(unsplashResult);
    const stock = unsplashStock("key");
    const [photo] = await stock.search("a slate roof");

    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as typeof fetch;

    await expect(stock.trackUse!(photo!)).resolves.toBeUndefined();
  });
});

describe("Pexels", () => {
  it("carries the photographer through", async () => {
    replyingWith(pexelsResult);

    const [photo] = await pexelsStock("key").search("an oak beam");

    expect(photo!.credit).toEqual({
      name: "Another Photographer",
      url: "https://pexels.example/@another",
    });
  });

  it("takes a size a Site would actually store", async () => {
    replyingWith(pexelsResult);

    const [photo] = await pexelsStock("key").search("an oak beam");

    // large2x is about 1880px wide — a hero on a large screen, not a 6000px original.
    expect(photo!.url).toBe("https://images.pexels.example/987-large2x");
  });

  it("has no use to report, and says so by not offering one", async () => {
    // Absent rather than an empty method: the interface should not imply every provider has
    // an endpoint that only one of them does.
    expect(pexelsStock("key").trackUse).toBeUndefined();
  });
});

describe("downloading a photograph", () => {
  const photo: StockPhoto = {
    id: "1",
    description: "",
    url: "https://images.example/one",
    width: null,
    height: null,
    credit: { name: "Someone", url: "https://example.com" },
    sourceUrl: "https://example.com/one",
  };

  function respondingWith(contentType: string, status = 200) {
    globalThis.fetch = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), { status, headers: { "content-type": contentType } }),
    ) as typeof fetch;
  }

  it("returns the bytes and the type", async () => {
    respondingWith("image/jpeg");

    const file = await downloadPhoto(photo);

    expect(file.contentType).toBe("image/jpeg");
    expect(file.body).toHaveLength(3);
  });

  it("ignores parameters on the content type", async () => {
    respondingWith("image/jpeg; charset=binary");

    expect((await downloadPhoto(photo)).contentType).toBe("image/jpeg");
  });

  it("refuses anything that is not an image", async () => {
    // A redirect to an HTML error page is far more common than anything hostile, and both
    // end with a Site storing something that is not a photograph.
    respondingWith("text/html");

    await expect(downloadPhoto(photo)).rejects.toThrow("not an image");
  });

  it("refuses a response with no content type at all", async () => {
    respondingWith("");

    await expect(downloadPhoto(photo)).rejects.toThrow("no content type");
  });

  it("refuses a failed request", async () => {
    respondingWith("image/jpeg", 404);

    await expect(downloadPhoto(photo)).rejects.toThrow("404");
  });
});
