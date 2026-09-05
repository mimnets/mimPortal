/**
 * Where a Site gets photographs it does not own.
 *
 * The same shape as the StorageAdapter and the EmailAdapter, and for the same reason: a Site
 * picks one implementation from its environment and nothing above this interface knows which.
 *
 * This exists because a generated Preset is only as convincing as its pictures. M9 can write
 * a law firm's copy and choose its palette, and then every image field is empty and the Site
 * looks like a wireframe. Filling those fields is the difference between "a plausible layout"
 * and "a page you could show a client".
 *
 * Two rules shape the whole design and both come from ADR-0012.
 *
 * **Photographs are downloaded into the Site's own media store, never hotlinked.** A layout
 * holds a storage key, not a URL, so a Preset cannot leave a Page pointing at a third party
 * who may rate-limit it, move it, or take it down. The Site owns its pictures the moment it
 * owns the Page.
 *
 * **Nothing is fetched until a Preset is applied.** M9 offers three or four Presets and an
 * Owner takes one; downloading pictures for the other three would be paying for work nobody
 * asked for, against a rate limit, every time somebody looks.
 */

/** One photograph a provider offered, before anything has been downloaded. */
export interface StockPhoto {
  /** The provider's own id. Recorded so a photo can be traced back to where it came from. */
  id: string;
  /**
   * What the photograph shows, in the provider's words.
   *
   * Used as alt text when nothing better is available. It is usually worse than what an
   * Author would write and much better than nothing, which is the trade every generated
   * image makes.
   */
  description: string;
  /** Where the bytes are. */
  url: string;
  width: number | null;
  height: number | null;
  /**
   * Who took it, and their page.
   *
   * Not optional, and not decoration: both providers' licences require the photographer to
   * be credited. A field nobody can leave empty is the only kind that survives contact with
   * a deadline.
   */
  credit: { name: string; url: string };
  /** The photo's page on the provider, which is the other half of the attribution. */
  sourceUrl: string;
}

export interface StockSearch {
  /** Landscape for a hero, portrait for a person. Providers that cannot filter ignore it. */
  orientation?: "landscape" | "portrait" | "square";
  /** How many to offer. A caller picking one still benefits from a few to choose between. */
  count?: number;
  signal?: AbortSignal;
}

export interface StockAdapter {
  /** Names the implementation, so the Dashboard can say where a picture came from. */
  readonly name: string;
  /** True when the Site is actually configured to search. */
  readonly configured: boolean;

  search(query: string, options?: StockSearch): Promise<StockPhoto[]>;

  /**
   * Tell the provider a photograph was used, where its terms ask for that.
   *
   * Unsplash requires it — a download is only counted when the API is told, and their
   * guidelines are explicit that fetching the file is not enough. It is optional on the
   * interface because most providers have no such endpoint, and it never blocks: a Site that
   * has the picture should not lose it because an analytics call timed out.
   */
  trackUse?(photo: StockPhoto): Promise<void>;
}

/**
 * The adapter a Site has before anybody configures a provider.
 *
 * It finds nothing, quietly. Applying a Preset on an unconfigured Site leaves the image
 * fields empty and everything else works — which is exactly what happens today, so an
 * unconfigured Site is no worse off than before this existed.
 */
export function unconfiguredStock(): StockAdapter {
  return {
    name: "not configured",
    configured: false,
    async search() {
      return [];
    },
  };
}

/** How long a provider gets before a Preset gives up on it and leaves the field empty. */
const SEARCH_TIMEOUT_MS = 8_000;
const DOWNLOAD_TIMEOUT_MS = 20_000;

/**
 * A signal that gives up after `ms`, combined with whatever the caller passed.
 *
 * Every network call in this module has one. A Preset that hangs is worse than a Preset with
 * grey rectangles, because the Owner is watching a spinner rather than reading a page.
 */
export function withTimeout(ms: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export const STOCK_TIMEOUTS = {
  search: SEARCH_TIMEOUT_MS,
  download: DOWNLOAD_TIMEOUT_MS,
} as const;

/** Image types a Site will store. The same set the upload path accepts. */
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export interface DownloadedPhoto {
  body: Uint8Array;
  contentType: string;
}

/**
 * Fetches a photograph's bytes.
 *
 * Provider-independent, so it is a function rather than a method: every implementation
 * returns a URL and the fetching is the same afterwards. It validates the content type it
 * actually received rather than trusting the URL, because a redirect to an HTML error page
 * is a far more common failure than a hostile one, and both end with a Site storing
 * something that is not an image.
 */
export async function downloadPhoto(
  photo: StockPhoto,
  signal?: AbortSignal,
): Promise<DownloadedPhoto> {
  const response = await fetch(photo.url, {
    signal: withTimeout(DOWNLOAD_TIMEOUT_MS, signal),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Could not download the photograph: ${response.status}`);
  }

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim();
  if (!ACCEPTED.has(contentType)) {
    throw new Error(`That address returned ${contentType || "no content type"}, not an image.`);
  }

  return { body: new Uint8Array(await response.arrayBuffer()), contentType };
}
