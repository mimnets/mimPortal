import { assertSafeKey, type StorageAdapter } from "./adapter";
import { signRequest } from "./sigv4";

/**
 * Any S3-compatible bucket: Cloudflare R2, Amazon S3, MinIO, Backblaze B2.
 *
 * R2 is the one this is written for — it has no egress fees and works from any host — but
 * nothing here is R2-specific, because a Site that is already on AWS should not be made to
 * open a second account.
 */
export function s3Storage(options: {
  bucket: string;
  /** `https://<account>.r2.cloudflarestorage.com` for R2, or a MinIO address. */
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** R2 ignores region but still signs with one; `auto` is what R2 documents. */
  region?: string;
  /**
   * The public origin objects are served from — an R2 custom domain, or a CDN. Without one
   * the bucket is private and files are only reachable through the Site's own /media route.
   */
  publicBaseUrl?: string;
}): StorageAdapter {
  const region = options.region ?? "auto";
  const endpoint = options.endpoint.replace(/\/+$/, "");
  const publicBaseUrl = options.publicBaseUrl?.replace(/\/+$/, "");

  /** Path-style addressing, which MinIO needs and R2 accepts. */
  function urlFor(key: string): URL {
    assertSafeKey(key);
    return new URL(`${endpoint}/${options.bucket}/${key}`);
  }

  async function send(
    method: string,
    key: string,
    body?: Uint8Array,
    headers?: Record<string, string>,
  ): Promise<Response> {
    const url = urlFor(key);
    const signed = signRequest({
      method,
      url,
      region,
      service: "s3",
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      body,
      headers,
    });

    return fetch(url, {
      method,
      headers: signed,
      body: body ? (body as unknown as BodyInit) : undefined,
    });
  }

  return {
    name: "S3-compatible bucket",
    // Without a public domain the bucket stays private and the Site proxies reads itself.
    baseUrl: publicBaseUrl ?? "/media",

    async put(key, body, { contentType }) {
      const response = await send("PUT", key, body, { "content-type": contentType });
      if (!response.ok) {
        // The body carries S3's error code; a bare status leaves nobody able to fix it.
        throw new Error(`Upload failed (${response.status}): ${await response.text()}`);
      }
    },

    async get(key) {
      const response = await send("GET", key);
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`Read failed (${response.status}): ${await response.text()}`);
      }
      return {
        body: new Uint8Array(await response.arrayBuffer()),
        contentType: response.headers.get("content-type") ?? "application/octet-stream",
      };
    },

    async delete(key) {
      const response = await send("DELETE", key);
      // S3 reports deleting something that was never there as success, and so do we.
      if (!response.ok && response.status !== 404) {
        throw new Error(`Delete failed (${response.status}): ${await response.text()}`);
      }
    },

    url(key) {
      assertSafeKey(key);
      // Without a public domain the bucket stays private and the Site proxies reads itself.
      return publicBaseUrl ? `${publicBaseUrl}/${key}` : `/media/${key}`;
    },
  };
}
