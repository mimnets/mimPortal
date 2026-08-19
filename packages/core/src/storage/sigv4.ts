import { createHash, createHmac } from "node:crypto";

/**
 * AWS Signature Version 4, by hand.
 *
 * The AWS SDK is tens of megabytes and brings a client, a paginator and a credential chain
 * to do one thing: put a byte array in a bucket. Every S3-compatible host — R2, S3, MinIO,
 * Backblaze — speaks the same signed HTTP, so signing it ourselves keeps a Site's install
 * small and its dependency list readable.
 *
 * This is the only cryptography in Mimnets. It is written to the specification and pinned by
 * tests against a real S3-compatible server, because a signature that is subtly wrong fails
 * as an opaque 403.
 */

export interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface SignInput {
  method: string;
  url: URL;
  region: string;
  service: string;
  credentials: Credentials;
  /** The exact bytes of the body — an empty request still hashes the empty string. */
  body?: Uint8Array;
  headers?: Record<string, string>;
  /** Injected by tests; production always signs with the current clock. */
  now?: Date;
}

const ALGORITHM = "AWS4-HMAC-SHA256";

function sha256Hex(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Uint8Array | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/** `20260819T103045Z` and `20260819`, the only two date formats SigV4 accepts. */
function stamps(now: Date): { amzDate: string; dateStamp: string } {
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

/**
 * S3 signs the path already-encoded and must not encode it a second time, unlike every
 * other AWS service. `/` stays a separator; everything outside the unreserved set is
 * percent-encoded uppercase.
 */
function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function canonicalUri(pathname: string): string {
  if (pathname === "") return "/";
  return pathname.split("/").map(encodeSegment).join("/");
}

function canonicalQuery(url: URL): string {
  const pairs: [string, string][] = [];
  url.searchParams.forEach((value, key) => pairs.push([key, value]));
  pairs.sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : 1) : a < b ? -1 : 1));
  return pairs.map(([k, v]) => `${encodeSegment(k)}=${encodeSegment(v)}`).join("&");
}

/**
 * Returns the headers to send, including Authorization. The caller passes them straight to
 * `fetch` — the signature covers exactly the headers returned here and no others.
 */
export function signRequest(input: SignInput): Record<string, string> {
  const { method, url, region, service, credentials, body, now = new Date() } = input;
  const { amzDate, dateStamp } = stamps(now);
  const payloadHash = sha256Hex(body ?? new Uint8Array());

  const headers: Record<string, string> = {
    ...(input.headers ?? {}),
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  // Header names lowercase, sorted; values trimmed. The signed list must match exactly.
  const canonicalHeaderEntries = Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, " ")] as const)
    .sort(([a], [b]) => (a < b ? -1 : 1));

  const signedHeaders = canonicalHeaderEntries.map(([name]) => name).join(";");
  const canonicalHeaders = canonicalHeaderEntries.map(([n, v]) => `${n}:${v}\n`).join("");

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri(url.pathname),
    canonicalQuery(url),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join("\n");

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, dateStamp), region), service),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  return {
    ...headers,
    authorization:
      `${ALGORITHM} Credential=${credentials.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

/** Exported for the tests: the two strings worth pinning are the ones nobody can eyeball. */
export const __testing = { sha256Hex, stamps, canonicalQuery };
