/**
 * Where a Site's uploaded files live.
 *
 * A Site picks one implementation at boot and nothing above this interface knows which:
 * the media library, the upload action and the image Block all deal in keys, never in
 * paths or bucket names. Moving a Site from a disk to a bucket is a change to one env var.
 */

export interface StorageAdapter {
  /** Names the implementation, so the Dashboard can say where a file went. */
  readonly name: string;
  /**
   * The prefix `url()` composes keys onto. It is a plain string rather than only a method
   * because a Block renders in the browser, where a function cannot reach: the server sends
   * this once in the RenderContext and Blocks build their own URLs from a key.
   */
  readonly baseUrl: string;
  put(key: string, body: Uint8Array, options: { contentType: string }): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
  /** The URL a browser fetches this object from. */
  url(key: string): string;
}

/** The image types a Site accepts. Anything else is rejected before it is written. */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * A key is `2026/08/a-slugged-name-3f9c1d.jpg`.
 *
 * Dated prefixes keep a bucket listable after a few thousand uploads, and the random suffix
 * means uploading `photo.jpg` twice never overwrites the first one — an Author replacing an
 * image should not silently change it everywhere it was already used.
 */
export function mediaKey(filename: string, contentType: string, now = new Date()): string {
  const extension = ALLOWED_IMAGE_TYPES[contentType] ?? "bin";
  const base =
    filename
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "file";

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 8);

  return `${year}/${month}/${base}-${suffix}.${extension}`;
}

/**
 * Keys come from the database, but a key that escaped its prefix would let a request read
 * anything the server can. Every adapter validates before it touches a filesystem or signs
 * a URL, rather than trusting the caller.
 */
export function assertSafeKey(key: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(key) || key.includes("..") || key.includes("//")) {
    throw new Error(`Refusing to handle an unsafe storage key: ${JSON.stringify(key)}`);
  }
}

/** Content type from a key's extension, for adapters that store bytes and nothing else. */
export function contentTypeForKey(key: string): string {
  const extension = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  const found = Object.entries(ALLOWED_IMAGE_TYPES).find(([, ext]) => ext === extension);
  return found ? found[0] : "application/octet-stream";
}

/**
 * Whether a Site will accept these bytes, independent of who is uploading them.
 *
 * This is separate from the server action so it can be tested without a session, and so the
 * rules read as rules rather than as three throws buried in a mutation. The action keeps the
 * role check; this keeps the file check.
 *
 * The length is the number of bytes that actually arrived, never a Content-Length header —
 * that is a claim by the client, and the whole point is not to believe the client.
 */
export function assertUploadable(contentType: string, byteLength: number): void {
  if (!ALLOWED_IMAGE_TYPES[contentType]) {
    throw new Error(
      `${contentType || "That file"} is not an image this Site accepts. ` +
        `Allowed: ${Object.keys(ALLOWED_IMAGE_TYPES).join(", ")}.`,
    );
  }
  if (byteLength === 0) throw new Error("That file is empty.");
  if (byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(
      `That file is ${(byteLength / 1024 / 1024).toFixed(1)} MB. The limit is ` +
        `${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    );
  }
}
