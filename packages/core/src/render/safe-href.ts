/**
 * Reduces something an Author typed to an address a browser may follow.
 *
 * Every Block with a link puts a value straight into an `href`, and an Author is a client —
 * the same threat model that keeps raw HTML out of Markdown (ADR-0011) and allowlists the
 * video Block's iframe hosts. A `javascript:` URL in an `href` is a stored cross-site
 * scripting bug that needs no exploit beyond a visitor clicking a button.
 *
 * React 19 happens to neutralise `javascript:` hrefs on its own, which is why this was not
 * already on fire. It is not a defence to rely on: it covers exactly one scheme, leaving
 * `vbscript:` and `data:text/html` through, and it is a framework implementation detail
 * rather than a promise. This function is the actual boundary.
 *
 * Returns "" for anything it will not vouch for, so a caller can fall back.
 */

/** Schemes a link may use. Everything else is refused rather than enumerated. */
const ALLOWED = new Set(["http:", "https:", "mailto:", "tel:"]);

export function safeHref(raw: string): string {
  const value = raw.trim();
  if (value === "") return "";

  // Relative paths, query strings and same-document fragments carry no scheme to abuse.
  if (value.startsWith("/") || value.startsWith("#") || value.startsWith("?")) return value;

  try {
    // The URL parser strips tabs and newlines before reading the scheme, which is what
    // defeats "java\nscript:" — the constructed URL's protocol is the real one.
    return ALLOWED.has(new URL(value).protocol) ? value : "";
  } catch {
    // Not a URL at all. A bare relative path — "about", "contact/us" — is still a fine link,
    // but only if it looks like a path rather than an unparsed scheme.
    return /^[\w.\-/]+$/.test(value) ? value : "";
  }
}
