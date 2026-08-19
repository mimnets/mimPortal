import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import {
  MAX_UPLOAD_BYTES,
  assertSafeKey,
  assertUploadable,
  contentTypeForKey,
  mediaKey,
} from "./adapter";
import { localDiskStorage } from "./local";
import { canonicalUri, signRequest } from "./sigv4";

const directories: string[] = [];

async function scratch() {
  const dir = await mkdtemp(join(tmpdir(), "mimnets-storage-"));
  directories.push(dir);
  return dir;
}

afterAll(async () => {
  await Promise.all(directories.map((dir) => rm(dir, { recursive: true, force: true })));
});

const bytes = (text: string) => new TextEncoder().encode(text);

describe("media keys", () => {
  it("slugs a filename and keeps it under a dated prefix", () => {
    const key = mediaKey("My Holiday Photo!.JPG", "image/jpeg", new Date("2026-08-19T00:00:00Z"));
    expect(key).toMatch(/^2026\/08\/my-holiday-photo-[a-z0-9]{6}\.jpg$/);
  });

  it("gives two uploads of the same filename different keys", () => {
    const a = mediaKey("photo.png", "image/png");
    const b = mediaKey("photo.png", "image/png");
    // Replacing an image must not silently change every Page that already used it.
    expect(a).not.toBe(b);
  });

  it("takes the extension from the content type, not from the filename", () => {
    // A .png that is really a WebP would otherwise be served with the wrong type.
    expect(mediaKey("photo.png", "image/webp")).toMatch(/\.webp$/);
  });

  it("survives a filename with nothing usable in it", () => {
    expect(mediaKey("...", "image/png")).toMatch(/^\d{4}\/\d{2}\/file-[a-z0-9]{6}\.png$/);
  });
});

describe("key safety", () => {
  const unsafe = [
    "../secrets.env",
    "2026/../../etc/passwd",
    "/absolute/path",
    "2026//08/x.png",
    "",
    "2026/08/x.png\0.txt",
  ];

  it.each(unsafe)("refuses %j", (key) => {
    expect(() => assertSafeKey(key)).toThrow(/unsafe storage key/);
  });

  it("accepts a key it generated itself", () => {
    expect(() => assertSafeKey(mediaKey("a.png", "image/png"))).not.toThrow();
  });
});

describe("local disk storage", () => {
  it("round-trips a file", async () => {
    const storage = localDiskStorage({ directory: await scratch() });
    const key = mediaKey("hello.png", "image/png");

    await storage.put(key, bytes("pretend png"), { contentType: "image/png" });
    const found = await storage.get(key);

    expect(new TextDecoder().decode(found?.body)).toBe("pretend png");
    expect(found?.contentType).toBe("image/png");
  });

  it("returns null for a key that was never written", async () => {
    const storage = localDiskStorage({ directory: await scratch() });
    // A key can outlive the object it points at; that is a 404, not a crash.
    expect(await storage.get("2026/08/missing-abc123.png")).toBeNull();
  });

  it("deletes, and deleting twice is not an error", async () => {
    const storage = localDiskStorage({ directory: await scratch() });
    const key = mediaKey("gone.png", "image/png");

    await storage.put(key, bytes("x"), { contentType: "image/png" });
    await storage.delete(key);
    await expect(storage.delete(key)).resolves.toBeUndefined();
    expect(await storage.get(key)).toBeNull();
  });

  it("writes inside its own directory and nowhere else", async () => {
    const directory = await scratch();
    const storage = localDiskStorage({ directory });
    const key = mediaKey("nested.png", "image/png");

    await storage.put(key, bytes("x"), { contentType: "image/png" });
    // The dated prefix has to become real directories, not a flat file with slashes in it.
    await expect(readFile(join(directory, key))).resolves.toBeTruthy();
  });

  it("refuses to climb out of its directory", async () => {
    const storage = localDiskStorage({ directory: await scratch() });
    await expect(storage.get("../../../etc/passwd")).rejects.toThrow(/unsafe storage key/);
    await expect(storage.put("../escape.png", bytes("x"), { contentType: "image/png" })).rejects.toThrow(
      /unsafe storage key/,
    );
  });

  it("serves from the public path the route handler owns", async () => {
    const storage = localDiskStorage({ directory: await scratch() });
    expect(storage.url("2026/08/a-abc123.png")).toBe("/media/2026/08/a-abc123.png");
  });
});

describe("content types", () => {
  it("reads the type back out of a key", () => {
    expect(contentTypeForKey("2026/08/a-abc123.webp")).toBe("image/webp");
    expect(contentTypeForKey("2026/08/a-abc123.svg")).toBe("image/svg+xml");
  });

  it("does not guess at a type it does not know", () => {
    expect(contentTypeForKey("2026/08/a-abc123.exe")).toBe("application/octet-stream");
  });
});

describe("sigv4", () => {
  const credentials = { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "SECRETKEY" };
  const at = new Date("2026-08-19T10:30:45Z");

  const sign = (url: string, method = "GET", body?: Uint8Array) =>
    signRequest({ method, url: new URL(url), region: "auto", service: "s3", credentials, body, now: at });

  it("signs deterministically for the same request and moment", () => {
    const a = sign("https://bucket.example.com/site/2026/08/a.png");
    const b = sign("https://bucket.example.com/site/2026/08/a.png");
    expect(a.authorization).toBe(b.authorization);
  });

  it("covers the payload, so the same URL with different bytes signs differently", () => {
    const a = sign("https://x.example.com/b/k.png", "PUT", bytes("one"));
    const b = sign("https://x.example.com/b/k.png", "PUT", bytes("two"));
    expect(a.authorization).not.toBe(b.authorization);
    expect(a["x-amz-content-sha256"]).not.toBe(b["x-amz-content-sha256"]);
  });

  it("hashes an empty body as the empty string, not as nothing", () => {
    // The well-known SHA-256 of "" that S3 expects on a bodyless request.
    expect(sign("https://x.example.com/b/k")["x-amz-content-sha256"]).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("names every header it signed", () => {
    const headers = sign("https://x.example.com/b/k");
    expect(headers.authorization).toContain(
      "SignedHeaders=host;x-amz-content-sha256;x-amz-date",
    );
    expect(headers.authorization).toContain("Credential=AKIDEXAMPLE/20260819/auto/s3/aws4_request");
  });

  it("stamps the date in the two formats SigV4 accepts", () => {
    expect(sign("https://x.example.com/b/k")["x-amz-date"]).toBe("20260819T103045Z");
  });

  it("encodes a path without double-encoding the separators", () => {
    expect(canonicalUri("/bucket/2026/08/a file.png")).toBe("/bucket/2026/08/a%20file.png");
  });
});

describe("what a Site will accept as an upload", () => {
  it("accepts the image types the Starter ships with", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]) {
      expect(() => assertUploadable(type, 1024)).not.toThrow();
    }
  });

  it("refuses anything that is not an image", () => {
    // The obvious attack is a .png that is really a script, so the type is checked rather
    // than the extension the browser happened to send.
    expect(() => assertUploadable("application/x-msdownload", 1024)).toThrow(/not an image/);
    expect(() => assertUploadable("text/html", 1024)).toThrow(/not an image/);
    expect(() => assertUploadable("application/pdf", 1024)).toThrow(/not an image/);
  });

  it("refuses a file with no type at all", () => {
    expect(() => assertUploadable("", 1024)).toThrow(/not an image/);
  });

  it("refuses an empty file", () => {
    expect(() => assertUploadable("image/png", 0)).toThrow(/empty/);
  });

  it("refuses a file over the limit, and says what the limit is", () => {
    expect(() => assertUploadable("image/png", MAX_UPLOAD_BYTES + 1)).toThrow(/The limit is 8 MB/);
  });

  it("accepts a file exactly on the limit", () => {
    // An off-by-one here rejects a file the Dashboard told the Author was fine.
    expect(() => assertUploadable("image/png", MAX_UPLOAD_BYTES)).not.toThrow();
  });
});
