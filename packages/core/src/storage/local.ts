import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

import { assertSafeKey, contentTypeForKey, type StorageAdapter } from "./adapter";

/**
 * Files on the Site's own disk. This is the default a cloned Starter runs with, so a Site
 * can accept its first upload before anyone has opened a Cloudflare account
 * (ADR-0012).
 *
 * The cost is honest and worth stating: the directory is part of the Site. A host with an
 * ephemeral filesystem, or a container rebuilt without a mounted volume, loses it. A Site
 * that outgrows that moves to `s3Storage` by setting four env vars, and the keys already in
 * the database keep working.
 */
export function localDiskStorage(options: {
  /** Absolute path to the upload directory. Created on first write. */
  directory: string;
  /** URL prefix the route handler serves these files from. */
  publicPath?: string;
}): StorageAdapter {
  const root = resolve(options.directory);
  const publicPath = (options.publicPath ?? "/media").replace(/\/+$/, "");

  /** Resolves a key inside the root, and refuses anything that climbs out of it. */
  function pathFor(key: string): string {
    assertSafeKey(key);
    const full = resolve(join(root, key));
    if (full !== root && !full.startsWith(root + sep)) {
      throw new Error(`Refusing to handle an unsafe storage key: ${JSON.stringify(key)}`);
    }
    return full;
  }

  return {
    name: "local disk",
    baseUrl: publicPath,

    async put(key, body, options) {
      const full = pathFor(key);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, body);
      // The type the caller declared, kept beside the object.
      //
      // It used to be discarded, and `get` guessed from the extension instead — which is
      // right for the images this Site uploads and wrong for anything else, returning
      // application/octet-stream for a type it had actually been told. The S3 adapter stores
      // it, so the two disagreed, and a Site moving from the disk to a bucket changed
      // behaviour for reasons nobody could see.
      await writeFile(`${full}.type`, options.contentType, "utf8");
    },

    async get(key) {
      try {
        const full = pathFor(key);
        const body = await readFile(full);
        // The declared type when there is one; the extension for objects written before
        // this adapter kept it, which is exactly what those used to return anyway.
        const declared = await readFile(`${full}.type`, "utf8").catch(() => null);
        return {
          body: new Uint8Array(body),
          contentType: declared?.trim() || contentTypeForKey(key),
        };
      } catch (error) {
        // A missing file is a 404, not a crash: a key can outlive the object it points at.
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },

    async delete(key) {
      const full = pathFor(key);
      await rm(full, { force: true });
      // Otherwise the sidecar outlives the object and a re-used key inherits a stale type.
      await rm(`${full}.type`, { force: true });
    },

    url(key) {
      assertSafeKey(key);
      return `${publicPath}/${key}`;
    },
  };
}
