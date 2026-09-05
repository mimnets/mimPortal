import {
  STOCK_TIMEOUTS,
  withTimeout,
  type StockAdapter,
  type StockPhoto,
  type StockSearch,
} from "./adapter";

/**
 * Pexels.
 *
 * The second implementation, and the reason the interface is worth having. Storage ships
 * local disk and S3, email ships SMTP and Resend, and each pair is what turns an interface
 * from a promise into a demonstrated fact — ADR-0001's own complaint about abstractions with
 * one implementation.
 *
 * Its licence asks for a credit rather than requiring one, and it has no endpoint to report a
 * use, so `trackUse` is absent rather than empty. The credit is recorded either way: a Site
 * that stores where a photograph came from can decide later, and one that did not cannot.
 */

interface PexelsPhoto {
  id: number;
  alt: string | null;
  width: number | null;
  height: number | null;
  url: string;
  photographer: string;
  photographer_url: string;
  src: { large2x?: string; large?: string; original?: string };
}

export function pexelsStock(apiKey: string): StockAdapter {
  return {
    name: "Pexels",
    configured: apiKey !== "",

    async search(query, options: StockSearch = {}) {
      const url = new URL("https://api.pexels.com/v1/search");
      url.searchParams.set("query", query);
      url.searchParams.set("per_page", String(Math.min(options.count ?? 5, 80)));
      if (options.orientation) url.searchParams.set("orientation", options.orientation);

      const response = await fetch(url, {
        headers: { Authorization: apiKey },
        signal: withTimeout(STOCK_TIMEOUTS.search, options.signal),
      });

      if (!response.ok) {
        throw new Error(`Pexels answered ${response.status}`);
      }

      const body = (await response.json()) as { photos?: PexelsPhoto[] };
      return (body.photos ?? []).flatMap((photo) => toPhoto(photo) ?? []);
    },
  };
}

function toPhoto(photo: PexelsPhoto): StockPhoto | null {
  // large2x is around 1880px wide, which is a hero on a large screen and not a 6000px
  // original nobody asked a Site to store.
  const url = photo.src.large2x ?? photo.src.large ?? photo.src.original;
  if (!url || !photo.photographer) return null;

  return {
    id: String(photo.id),
    description: photo.alt ?? "",
    url,
    width: photo.width ?? null,
    height: photo.height ?? null,
    credit: { name: photo.photographer, url: photo.photographer_url },
    sourceUrl: photo.url,
  };
}
