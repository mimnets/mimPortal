import type { BlockRegistry } from "../blocks/registry";
import type { Field, FieldsShape } from "../blocks/fields";
import type { PageLayout } from "../layout/schema";

/**
 * Every image field in a layout that is empty but described.
 *
 * A generated Preset leaves `key` empty — it cannot reference a file that does not exist — and
 * writes what the photograph should be into `alt`. This finds those, so the apply step can go
 * and get them.
 *
 * It returns direct references into the object it was given rather than paths to be resolved
 * again later. The caller works on a layout it has already cloned, fills each `container[key]`
 * in place, and saves the result; resolving a path twice is how the Editor's stale-selection
 * bugs happened, and there is no reason to repeat it here.
 *
 * Repeaters are descended into, which is not an optional refinement: the gallery, the carousel
 * and the testimonial strip keep every one of their images inside one, so a walker that only
 * looked at top-level fields would find none of the images on a Preset's most photographic
 * Blocks.
 */

export interface ImageHole {
  /** The object holding the image value — a Block's props, or one repeater item. */
  container: Record<string, unknown>;
  /** The field name within that object. */
  key: string;
  /** What the photograph should show, as the Preset described it. */
  alt: string;
}

interface ImageValue {
  key?: unknown;
  alt?: unknown;
}

function isImageValue(value: unknown): value is ImageValue {
  return typeof value === "object" && value !== null;
}

function walkFields(
  fields: FieldsShape,
  values: Record<string, unknown>,
  found: ImageHole[],
): void {
  for (const [name, field] of Object.entries(fields) as [string, Field][]) {
    const value = values[name];

    if (field.kind === "image") {
      if (!isImageValue(value)) continue;
      const alt = typeof value.alt === "string" ? value.alt.trim() : "";
      const key = typeof value.key === "string" ? value.key : "";
      // Described and empty. A field with a key already has a photograph somebody chose, and
      // one with no description is a hole nobody said how to fill.
      if (key === "" && alt !== "") found.push({ container: values, key: name, alt });
      continue;
    }

    if (field.kind === "repeater" && Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "object" && item !== null) {
          walkFields(field.fields ?? {}, item as Record<string, unknown>, found);
        }
      }
    }
  }
}

export function findEmptyImages(registry: BlockRegistry, layout: PageLayout): ImageHole[] {
  const found: ImageHole[] = [];

  for (const sections of Object.values(layout.slots)) {
    for (const section of sections) {
      for (const column of section.columns) {
        for (const block of column.blocks) {
          const blockType = registry.get(block.type);
          if (!blockType) continue;
          walkFields(blockType.fields, block.props as Record<string, unknown>, found);
        }
      }
    }
  }

  return found;
}

/**
 * A Section's background is an image too, and it is not a Block field.
 *
 * It lives on the Section itself (ADR-0013 — the band is the Section's job), so the walker
 * above cannot see it. It carries no alt text of its own, which is correct: a background is
 * decorative and an alt attribute on it would be noise to a screen reader. That also means a
 * Preset cannot describe one, so these are reported separately and the caller decides — the
 * fill uses the Section's first heading as the search term rather than inventing one.
 */
export function findEmptySectionBackgrounds(
  layout: PageLayout,
): { section: { background: { key: string } }; heading: string }[] {
  const found: { section: { background: { key: string } }; heading: string }[] = [];

  for (const sections of Object.values(layout.slots)) {
    for (const section of sections) {
      if (section.background?.key !== "") continue;

      // The nearest thing to a description the Section has.
      let heading = "";
      for (const column of section.columns) {
        for (const block of column.blocks) {
          const text = (block.props as { text?: unknown; heading?: unknown }).text;
          const other = (block.props as { heading?: unknown }).heading;
          const candidate = typeof text === "string" ? text : typeof other === "string" ? other : "";
          if (candidate.trim() !== "") {
            heading = candidate.trim();
            break;
          }
        }
        if (heading) break;
      }

      if (heading) found.push({ section: section as never, heading });
    }
  }

  return found;
}
