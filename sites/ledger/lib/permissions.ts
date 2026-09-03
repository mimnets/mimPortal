import { eq } from "drizzle-orm";
import type { SlotName } from "@mimnets/core";
import { createDatabase, siteSettings, type Role } from "@mimnets/core/db";

/**
 * Which Slots a role may not change.
 *
 * Deliberately free of any framework import, so it can be tested against a real database
 * without a request in flight. `session.ts` supplies the role; this decides the consequence.
 */
export async function lockedSlotsForRole(role: Role, databaseUrl: string): Promise<SlotName[]> {
  if (role === "owner") return [];

  const db = createDatabase(databaseUrl);
  const [settings] = await db
    .select({ lockedSlots: siteSettings.lockedSlots })
    .from(siteSettings)
    .where(eq(siteSettings.id, "singleton"))
    .limit(1);

  // A Site with no settings row is not a Site with nothing locked: fall back to the safe
  // default rather than handing an Author the Header.
  return (settings?.lockedSlots ?? ["header", "footer"]) as SlotName[];
}
