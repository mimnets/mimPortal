import {
  STOCK_TIMEOUTS,
  withTimeout,
  type StockAdapter,
  type StockPhoto,
  type StockSearch,
} from "./adapter";

/**
 * Unsplash.
 *
 * Free for this, with a demo key that allows fifty requests an hour — enough for applying
 * Presets and nowhere near enough for a Site that searched on every page view, which is the
 * other reason downloads happen once at apply time and never again.
 *
 * Two obligations from their API terms are honoured here rather than left to a caller who
 * would not know about them. The photographer and Unsplash are both credited, which is why
 * `credit` is not optional on the interface. And a use is reported to `download_location`:
 * their guidelines are explicit that fetching the image file does not count, and a client
 * that never reports is one they can revoke.
 */

interface UnsplashPhoto {
  id: string;
  description: string | null;
  alt_description: string | null;
  width: number | null;
  height: number | null;
  urls: { regular?: string; full?: string; raw?: string };
  links: { html?: string; download_location?: string };
  user: { name?: string; links?: { html?: string } };
}

export function unsplashStock(accessKey: string): StockAdapter {
  const headers = {
    Authorization: `Client-ID ${accessKey}`,
    "Accept-Version": "v1",
  };

  return {
    name: "Unsplash",
    configured: accessKey !== "",

    async search(query, options: StockSearch = {}) {
      const url = new URL("https://api.unsplash.com/search/photos");
      url.searchParams.set("query", query);
      url.searchParams.set("per_page", String(Math.min(options.count ?? 5, 30)));
      // Photographs, not illustrations or vectors: a brochure Site wants a photograph.
      url.searchParams.set("content_filter", "high");
      if (options.orientation) url.searchParams.set("orientation", options.orientation);

      const response = await fetch(url, {
        headers,
        signal: withTimeout(STOCK_TIMEOUTS.search, options.signal),
      });

      if (!response.ok) {
        // Rate limits are the common case and are not exceptional: a Preset that cannot find
        // a photograph leaves the field empty and carries on, so this reads as "none found".
        throw new Error(`Unsplash answered ${response.status}`);
      }

      const body = (await response.json()) as { results?: UnsplashPhoto[] };
      return (body.results ?? []).flatMap((photo) => toPhoto(photo) ?? []);
    },

    async trackUse(photo) {
      // The id doubles as the download_location, stashed by `toPhoto`. Failure is ignored on
      // purpose: the Site already has the picture, and losing it over an analytics call
      // would be the wrong trade in every direction.
      const location = downloadLocations.get(photo.id);
      if (!location) return;

      try {
        await fetch(location, { headers, signal: withTimeout(STOCK_TIMEOUTS.search) });
      } catch {
        // Reported in the caller's log if it matters; never fatal.
      }
    },
  };
}

/**
 * Where to report a use, per photo id.
 *
 * Kept beside the adapter rather than on `StockPhoto`, because it is Unsplash's requirement
 * and not a fact about photographs — putting it on the shared type would make every other
 * provider carry a field that means nothing to it.
 */
const downloadLocations = new Map<string, string>();

function toPhoto(photo: UnsplashPhoto): StockPhoto | null {
  const url = photo.urls.regular ?? photo.urls.full ?? photo.urls.raw;
  const name = photo.user.name;
  if (!url || !name) return null;

  if (photo.links.download_location) {
    downloadLocations.set(photo.id, photo.links.download_location);
  }

  return {
    id: photo.id,
    // `alt_description` is written to be alt text; `description` is a caption. Prefer the one
    // that was written for the job.
    description: photo.alt_description ?? photo.description ?? "",
    url,
    width: photo.width ?? null,
    height: photo.height ?? null,
    credit: { name, url: photo.user.links?.html ?? "https://unsplash.com" },
    sourceUrl: photo.links.html ?? "https://unsplash.com",
  };
}
