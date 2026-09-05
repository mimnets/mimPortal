import { findEmptyImages, findEmptySectionBackgrounds, downloadPhoto } from "@mimnets/core/stock";
import type { StockAdapter, StockPhoto } from "@mimnets/core/stock";
import type { BlockRegistry, PageLayout } from "@mimnets/core";
import { createDatabase, media } from "@mimnets/core/db";
import { imageDimensions, mediaKey } from "@mimnets/core/storage";

import { requireDatabaseUrl } from "./env";
import { storage } from "./storage";
import { stock } from "./stock";

/**
 * Fills the photographs a generated Preset asked for.
 *
 * M9 can write a law firm's copy and pick its palette, and then every image is a grey
 * rectangle. This is what closes that gap: each empty image field carries a description of the
 * photograph that belongs there, written by the model into `alt`, and this goes and gets one.
 *
 * Three rules, and all three come from decisions already made.
 *
 * **Downloaded, never hotlinked** (ADR-0012). The bytes land in the Site's own media store and
 * the layout holds a key, so a Page can never point at a third party who may rate-limit it,
 * move it, or take it down.
 *
 * **At apply time, not at generate time.** An Owner is offered three or four Presets and takes
 * one. Fetching photographs for the other three is paying for work nobody asked for, against a
 * rate limit, every time somebody looks at the choices.
 *
 * **A failure is never fatal.** Any image that cannot be found or fetched is left exactly as it
 * was — empty, with its description intact — and the Preset applies around it. A Site with
 * three photographs and one grey rectangle is a Site; a Preset that refused to apply because
 * Unsplash was rate-limited is a bug report.
 */

export interface FillReport {
  /** How many photographs were downloaded and attached. */
  filled: number;
  /** Fields left empty: nothing found, or the fetch failed. Their descriptions survive. */
  left: number;
  /** Why each was left, for the log. Never shown to an Author as an error. */
  problems: string[];
}

/** Nobody wants the same photograph three times on one Page. */
function pickUnused(photos: StockPhoto[], used: Set<string>): StockPhoto | null {
  for (const photo of photos) {
    if (!used.has(photo.id)) return photo;
  }
  return photos[0] ?? null;
}

async function fetchAndStore(
  photo: StockPhoto,
  adapter: StockAdapter,
  alt: string,
): Promise<{ key: string; width: number | null; height: number | null }> {
  const file = await downloadPhoto(photo);

  const extension = file.contentType.split("/")[1] ?? "jpg";
  const key = mediaKey(`${photo.credit.name}-${photo.id}.${extension}`, file.contentType);

  await storage().put(key, file.body, { contentType: file.contentType });

  // Measured rather than trusted: the provider's numbers describe the original, and what was
  // downloaded is whichever rendition its URL served.
  const size = imageDimensions(file.body);

  await createDatabase(requireDatabaseUrl())
    .insert(media)
    .values({
      key,
      filename: `${photo.id}.${extension}`,
      contentType: file.contentType,
      size: file.body.byteLength,
      width: size?.width ?? photo.width,
      height: size?.height ?? photo.height,
      alt,
      // The provenance an Owner needs when handing a Site to a client: which of these
      // photographs did anybody actually choose?
      source: adapter.name.toLowerCase(),
      sourceUrl: photo.sourceUrl,
      credit: photo.credit.name,
      creditUrl: photo.credit.url,
    });

  // Unsplash requires this and fetching the file does not satisfy it. It never throws.
  await adapter.trackUse?.(photo);

  return { key, width: size?.width ?? photo.width, height: size?.height ?? photo.height };
}

export async function fillStockImages(
  layout: PageLayout,
  registry: BlockRegistry,
): Promise<FillReport> {
  const adapter = stock();
  const report: FillReport = { filled: 0, left: 0, problems: [] };

  // An unconfigured Site is not a failure. It applies Presets exactly as it did before stock
  // photography existed, and every description stays where an Author can act on it.
  if (!adapter.configured) return report;

  const used = new Set<string>();

  async function fill(description: string, assign: (photo: StockPhoto, stored: { key: string; width: number | null; height: number | null }) => void) {
    try {
      const photos = await adapter.search(description, { orientation: "landscape", count: 8 });
      const photo = pickUnused(photos, used);
      if (!photo) {
        report.left += 1;
        report.problems.push(`No photograph found for "${description}".`);
        return;
      }

      const stored = await fetchAndStore(photo, adapter, description);
      used.add(photo.id);
      assign(photo, stored);
      report.filled += 1;
    } catch (cause) {
      report.left += 1;
      report.problems.push(
        `Could not fetch a photograph for "${description}": ` +
          (cause instanceof Error ? cause.message : "unknown error"),
      );
    }
  }

  for (const hole of findEmptyImages(registry, layout)) {
    await fill(hole.alt, (_photo, stored) => {
      hole.container[hole.key] = {
        key: stored.key,
        // The description the Preset wrote is the alt text. It was written to describe this
        // photograph, which is exactly what alt text is for.
        alt: hole.alt,
        decorative: false,
        width: stored.width,
        height: stored.height,
      };
    });
  }

  for (const { section, heading } of findEmptySectionBackgrounds(layout)) {
    // A background carries no alt text of its own — it is decorative, and describing it to a
    // screen reader would be noise. The Section's own heading is the search term instead.
    await fill(heading, (_photo, stored) => {
      section.background.key = stored.key;
    });
  }

  if (report.problems.length > 0) {
    console.warn(`[mimnets] Stock images: ${report.problems.join(" ")}`);
  }

  return report;
}
