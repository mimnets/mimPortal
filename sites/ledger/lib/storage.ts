import { resolve } from "node:path";

import { localDiskStorage, s3Storage, type StorageAdapter } from "@mimnets/core/storage";

/**
 * Which StorageAdapter this Site runs on, decided once from the environment.
 *
 * Local disk is the default so a cloned Starter accepts its first upload with no account
 * anywhere and no configuration (ADR-0012). Setting the four S3 variables moves a Site to a
 * bucket; the keys already in the database keep working, because a key is not a URL.
 */

let cached: StorageAdapter | null = null;

export function mediaDirectory(): string {
  // Outside .next, so a rebuild never deletes a client's uploads.
  //
  // The bundler traces filesystem calls to work out what to deploy, and a path it cannot
  // read statically makes it give up and include the whole project — every source file, and
  // the public folder, shipped as server code. This path is only ever known at runtime, so
  // the tracer is told to leave it alone.
  return resolve(/* turbopackIgnore: true */ process.env.MEDIA_DIR ?? ".media");
}

export function storage(): StorageAdapter {
  if (cached) return cached;

  const bucket = process.env.S3_BUCKET;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (bucket || endpoint || accessKeyId || secretAccessKey) {
    // A half-configured bucket fails here, at boot, rather than on an Author's first upload.
    const missing = Object.entries({
      S3_BUCKET: bucket,
      S3_ENDPOINT: endpoint,
      S3_ACCESS_KEY_ID: accessKeyId,
      S3_SECRET_ACCESS_KEY: secretAccessKey,
    })
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(
        `S3 storage is partly configured. Missing: ${missing.join(", ")}. ` +
          "Set all four, or unset them all to use the local disk.",
      );
    }

    cached = s3Storage({
      bucket: bucket!,
      endpoint: endpoint!,
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
      region: process.env.S3_REGION,
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
    });
    return cached;
  }

  cached = localDiskStorage({ directory: mediaDirectory() });
  return cached;
}
