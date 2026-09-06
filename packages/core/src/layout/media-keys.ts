/**
 * Every storage key a layout document refers to.
 *
 * Deleting a picture leaves any Page using it pointing at nothing — deliberate, and argued in
 * ADR-0012, because a key is not a foreign key and the alternative is a media library that
 * refuses to let go of a file somebody stopped using two years ago. What was never deliberate
 * is that there was no way to *check* first. This is that check.
 *
 * It walks the document structurally rather than consulting the registry, which is the less
 * obvious choice and the right one. A Block Type declares its fields, so the registry could
 * say exactly where the images are — but only for Block Types this Site still registers. A
 * Page holding a Block whose type was removed from `blocks.config.ts` still holds that
 * Block's picture, and a usage check that cannot see it would report a file as unused and
 * invite somebody to delete it. Walking the shape finds those too, and needs no change when
 * a new Block Type with a new image field is added.
 *
 * What it looks for is the shape of the two things that carry a key: an image field, which is
 * `{ key, alt, ... }`, and a Section's background, which is `{ key, overlay }`. Requiring the
 * companion property is what stops it collecting every unrelated `key` in the document —
 * `columnTemplate` names, React keys and Block ids are all called something else, but the
 * check is cheap insurance against the day one is not.
 */

/** Storage keys referenced anywhere inside a layout, a Slot's sections, or any fragment. */
export function mediaKeysIn(value: unknown): string[] {
  const found = new Set<string>();

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    if (!node || typeof node !== "object") return;

    const object = node as Record<string, unknown>;
    const key = object.key;

    if (typeof key === "string" && key !== "" && ("alt" in object || "overlay" in object)) {
      found.add(key);
    }

    for (const child of Object.values(object)) visit(child);
  };

  visit(value);
  return [...found];
}

/** Whether a layout document refers to a given storage key. */
export function usesMediaKey(value: unknown, key: string): boolean {
  return mediaKeysIn(value).includes(key);
}
