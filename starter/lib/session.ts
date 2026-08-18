import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { createDatabase, siteSettings, user, type Role } from "@mimnets/core/db";

import { auth } from "./auth";
import { requireDatabaseUrl } from "./env";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/**
 * The server's view of who is asking. Every mutation resolves this itself rather than
 * trusting anything the browser sent: the Editor hiding a button is a courtesy, not a
 * permission.
 */
export async function currentUser(): Promise<CurrentUser | null> {
  const result = await auth().api.getSession({ headers: await headers() });
  if (!result?.user) return null;

  // The role is read from the database rather than from the session payload, so revoking an
  // Owner takes effect on their next request instead of when their session expires.
  const db = createDatabase(requireDatabaseUrl());
  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(eq(user.id, result.user.id))
    .limit(1);

  return row ?? null;
}

export async function requireUser(): Promise<CurrentUser> {
  const person = await currentUser();
  if (!person) throw new Error("You are not signed in.");
  return person;
}

export async function requireOwner(): Promise<CurrentUser> {
  const person = await requireUser();
  if (person.role !== "owner") throw new Error("Only an Owner can do that.");
  return person;
}

/** Slots an Author may not change. Owners are never restricted. */
export async function lockedSlotsFor(person: CurrentUser): Promise<string[]> {
  if (person.role === "owner") return [];

  const db = createDatabase(requireDatabaseUrl());
  const [settings] = await db
    .select({ lockedSlots: siteSettings.lockedSlots })
    .from(siteSettings)
    .where(eq(siteSettings.id, "singleton"))
    .limit(1);

  return settings?.lockedSlots ?? ["header", "footer"];
}
