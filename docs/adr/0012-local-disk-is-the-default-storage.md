# The local disk is the default storage, and a bucket is the upgrade

Uploads go through a `StorageAdapter` with three methods — `put`, `get`, `delete` — plus the
`baseUrl` that keys are served from. Two implementations ship: the Site's own disk, and any
S3-compatible bucket (R2, S3, MinIO, Backblaze).

A cloned Starter uses the disk. Setting four environment variables moves it to a bucket.

The alternative considered, and rejected for the default, was R2 first. R2 is the better
place for a real Site's files: it survives a container rebuild, works on hosts with a
read-only filesystem, and costs nothing in egress. But it cannot accept a single upload until
somebody has a Cloudflare account, a bucket, and a pair of keys. Making that the default puts
an account signup between cloning the Starter and seeing it work, on the one path that has to
stay short. A default is what someone gets before they have made a decision, and "no upload
works yet" is a bad thing to hand them.

So the disk is the default because it needs nothing, and the bucket is documented as the
thing to switch to before a Site goes anywhere real.

The two implementations are equally supported, not tiered. The S3 adapter signs its own
requests with SigV4 rather than depending on the AWS SDK, which would be tens of megabytes on
every Site to move a byte array into a bucket. That signing is tested against a real
S3-compatible server (`docker compose --profile storage up -d storage`), because a signature
that is subtly wrong fails as an opaque 403 and a mock would accept it happily.

## Consequences

- **A Site on the disk is tied to its machine.** A host with an ephemeral filesystem, or a
  container rebuilt without a mounted volume, loses every upload. This is stated in
  [HOSTING.md](../HOSTING.md) rather than defended: it is the price of the short path, and
  the way out is four environment variables.
- **A layout stores keys, never URLs.** `field.image()` holds a storage key, and a Block
  composes its URL from `context.mediaBaseUrl` at render time. Moving a Site from a disk to a
  bucket, or giving a bucket a CDN domain, therefore changes configuration and no Page.
- **Uploads are served by the Site itself unless a public domain is set.** That keeps a
  bucket private by default, at the cost of proxying reads through the app. A Site that sets
  `S3_PUBLIC_BASE_URL` bypasses the route entirely.
- **Deleting a file does not rewrite the Pages that used it.** They keep the key and render
  nothing for it. Re-uploading is recoverable; rewriting every Page that referenced an image
  is not, so the reference is left alone deliberately.
- **`pnpm seed` writes to the media directory** when a Site is on the disk, and leaves the
  library alone when it is on a bucket. A seed script has no business reaching into a
  client's storage.
