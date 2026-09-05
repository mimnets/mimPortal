/**
 * What a storage key is allowed to look like.
 *
 * This is the predicate on its own, with no filesystem and no `node:crypto` behind it, so it
 * can be used where a layout is validated as well as where a file is fetched. The storage
 * adapters live behind `@mimnets/core/storage` precisely because they cannot cross the
 * server/client boundary; this rule has to, because the same key is validated in a Zod schema
 * the Editor parses and in an adapter that signs a URL.
 *
 * The rule is the one `assertSafeKey` has always applied, moved here rather than copied —
 * two definitions of "safe key" that drift apart is a worse outcome than either of them.
 *
 * ADR-0012 says an image field holds a key and never a URL. Until this was enforced that was
 * a convention rather than a constraint, and `key` was a bare `z.string()` in two schemas. A
 * Section's background key is interpolated into a CSS `url("…")` in an inline style, so a key
 * containing a quote and a semicolon could append its own declarations — not script, but
 * `position: fixed; inset: 0` on a Section is enough to cover the whole page, and a
 * `background-image` pointing at another origin is a request every visitor makes.
 */
export function isSafeStorageKey(key: string): boolean {
  return (
    /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(key) && !key.includes("..") && !key.includes("//")
  );
}

/** The message used wherever an unsafe key is rejected, so it reads the same everywhere. */
export const UNSAFE_KEY_MESSAGE =
  "A stored file is identified by a key, not a URL — letters, digits, dots, dashes and slashes only.";
