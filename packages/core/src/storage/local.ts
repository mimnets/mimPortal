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

    async put(key, body) {
      const full = pathFor(key);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, body);
    },

    async get(key) {
      try {
        const body = await readFile(pathFor(key));
        return { body: new Uint8Array(body), contentType: contentTypeForKey(key) };
      } catch (error) {
        // A missing file is a 404, not a crash: a key can outlive the object it points at.
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },

    async delete(key) {
      await rm(pathFor(key), { force: true });
    },

    url(key) {
      assertSafeKey(key);
      return `${publicPath}/${key}`;
    },
  };
}
