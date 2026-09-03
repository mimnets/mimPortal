"use server";

import { count, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createDatabase, formSubmissions } from "@mimnets/core/db";

import { requireDatabaseUrl } from "../../lib/env";
import { requireOwner, requireUser } from "../../lib/session";

/**
 * Reading what the Site's forms have collected.
 *
 * Every enquiry is here whether or not its notification email went out, which is the point:
 * a mail server having a bad afternoon should cost a notification, never a customer.
 */

export interface Enquiry {
  id: string;
  slug: string;
  path: string;
  name: string;
  email: string;
  message: string;
  readAt: string | null;
  deliveryError: string | null;
  createdAt: string;
}

function database() {
  return createDatabase(requireDatabaseUrl());
}

export async function listEnquiries(): Promise<Enquiry[]> {
  await requireUser();
  const rows = await database()
    .select()
    .from(formSubmissions)
    .orderBy(desc(formSubmissions.createdAt))
    .limit(200);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    path: row.path,
    name: row.name,
    email: row.email,
    message: row.message,
    readAt: row.readAt?.toISOString() ?? null,
    deliveryError: row.deliveryError,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function markEnquiryRead(id: string, read: boolean): Promise<void> {
  await requireUser();
  await database()
    .update(formSubmissions)
    .set({ readAt: read ? new Date() : null })
    .where(eq(formSubmissions.id, id));
  revalidatePath("/admin/enquiries");
}

/** Deleting an enquiry destroys the only copy the Site has, so it stays with the Owner. */
export async function deleteEnquiry(id: string): Promise<void> {
  await requireOwner();
  await database().delete(formSubmissions).where(eq(formSubmissions.id, id));
  revalidatePath("/admin/enquiries");
}

export async function unreadEnquiryCount(): Promise<number> {
  await requireUser();
  // isNull, not eq(..., null): SQL's NULL is never equal to anything, so the comparison
  // form returns zero rows and would quietly report no unread enquiries forever.
  const [row] = await database()
    .select({ total: count() })
    .from(formSubmissions)
    .where(isNull(formSubmissions.readAt));
  return row?.total ?? 0;
}
