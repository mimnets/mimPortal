"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { assertUploadable, imageDimensions, mediaKey } from "@mimnets/core/storage";
import { createDatabase, media } from "@mimnets/core/db";

import { requireDatabaseUrl } from "../../lib/env";
import { requireOwner, requireUser } from "../../lib/session";
import { storage } from "../../lib/storage";

/**
 * Uploading is a mutation like any other, so it goes through the same boundary: the role is
 * re-checked here, the file is validated here, and nothing the browser claimed about the
 * file is believed.
 */

export interface MediaItem {
  id: string;
  key: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  createdAt: string;
}

function database() {
  return createDatabase(requireDatabaseUrl());
}

function toItem(row: typeof media.$inferSelect): MediaItem {
  return {
    id: row.id,
    key: row.key,
    // Resolved on the way out, never stored: the bucket a Site uses can change.
    url: storage().url(row.key),
    filename: row.filename,
    contentType: row.contentType,
    size: row.size,
    width: row.width,
    height: row.height,
    alt: row.alt,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listMedia(): Promise<MediaItem[]> {
  await requireUser();
  const rows = await database().select().from(media).orderBy(desc(media.createdAt)).limit(200);
  return rows.map(toItem);
}

export async function uploadMedia(form: FormData): Promise<MediaItem> {
  // An Author writes content, and an image is content. Deleting is the Owner's call.
  await requireUser();

  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("No file was uploaded.");

  const declared = file.type;
  const body = new Uint8Array(await file.arrayBuffer());

  // Checked against the bytes that actually arrived, not against what the browser claimed.
  assertUploadable(declared, body.byteLength);

  const key = mediaKey(file.name, declared);
  const size = imageDimensions(body);

  await storage().put(key, body, { contentType: declared });

  const [row] = await database()
    .insert(media)
    .values({
      key,
      filename: file.name,
      contentType: declared,
      size: body.byteLength,
      width: size?.width ?? null,
      height: size?.height ?? null,
    })
    .returning();

  revalidatePath("/admin/media");
  return toItem(row!);
}

/**
 * The alt text offered whenever this file is placed. A Block keeps its own copy — the same
 * photograph is sometimes decorative and sometimes the point — but describing it once here
 * means an Author never starts from an empty box, which is how Sites end up with none.
 */
export async function setMediaAlt(id: string, alt: string): Promise<void> {
  await requireUser();
  await database().update(media).set({ alt: alt.trim() }).where(eq(media.id, id));
  revalidatePath("/admin/media");
}

/**
 * Deleting removes the row and the object. Pages that still point at the key keep their
 * reference and render nothing for it — a broken image is recoverable by re-uploading,
 * whereas rewriting every Page that used it is not.
 */
export async function deleteMedia(id: string): Promise<void> {
  await requireOwner();
  const db = database();

  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  if (!row) return;

  await db.delete(media).where(eq(media.id, id));
  // The row goes first: an orphaned object costs storage, an orphaned row shows an Author a
  // file that is not there.
  await storage().delete(row.key);

  revalidatePath("/admin/media");
}
