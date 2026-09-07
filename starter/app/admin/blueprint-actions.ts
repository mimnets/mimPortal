"use server";

import { eq } from "drizzle-orm";
import type { SectionNode } from "@mimnets/core";
import { blueprints, createDatabase } from "@mimnets/core/db";

import { registry } from "../../blocks.config";
import { requireDatabaseUrl } from "../../lib/env";
import { requireUser } from "../../lib/session";

/**
 * Blueprints: a Section saved by name, dropped into a Page as a copy.
 *
 * Available to an Author as well as an Owner, unlike Shared Slots. The reasoning is the
 * difference between the two: changing a Shared Slot changes every Page using it at once,
 * which is the most structural edit in the product; inserting a Blueprint changes exactly
 * one Page, and is a copy that stops being related to its source. An Author who may add a
 * Section may add this one.
 */

function database() {
  return createDatabase(requireDatabaseUrl());
}

export interface BlueprintSummary {
  id: string;
  name: string;
  section: SectionNode;
}

/**
 * A stored Section is validated on the way *out* as well as in.
 *
 * The way in is obvious. The way out matters because a Blueprint outlives the registry it
 * was saved against: a Site can remove a Block Type, and a Blueprint saved last month may
 * name it. Parsing here means such a Blueprint comes back with the unknown Block dropped
 * rather than being handed to the Editor, which would then write it into a Page.
 */
function parseSection(value: unknown): SectionNode | null {
  const { layout, error } = registry.safeParseLayout({
    version: 1,
    slots: { header: [], main: [value], sidebar: [], footer: [] },
  });

  if (error) return null;
  return layout.slots.main[0] ?? null;
}

export async function listBlueprints(): Promise<BlueprintSummary[]> {
  await requireUser();

  const rows = await database().select().from(blueprints).orderBy(blueprints.name);

  return rows.flatMap((row) => {
    const section = parseSection(row.section);
    if (!section) {
      console.error(`[mimnets] Blueprint "${row.name}" (${row.id}) failed validation and was hidden`);
      return [];
    }
    return [{ id: row.id, name: row.name, section }];
  });
}

/**
 * Validated before it is written, exactly as a Page's layout is.
 *
 * This is what the roadmap means by inheriting the Preset guarantee without new machinery:
 * the same `safeParseLayout` the Editor writes through decides what a Blueprint may contain,
 * so a Blueprint cannot introduce a Block Type this Site does not register.
 */
export async function saveBlueprint(name: string, section: unknown): Promise<BlueprintSummary> {
  await requireUser();

  const parsed = parseSection(section);
  if (!parsed) throw new Error("That Section could not be saved as a Blueprint.");

  const trimmed = name.trim().slice(0, 120) || "Untitled Section";

  const [row] = await database()
    .insert(blueprints)
    .values({ name: trimmed, section: parsed })
    .returning({ id: blueprints.id, name: blueprints.name });

  if (!row) throw new Error("That Blueprint could not be saved.");
  return { id: row.id, name: row.name, section: parsed };
}

/**
 * Forgetting a Blueprint changes no Page.
 *
 * Worth stating because deleting a Shared Slot does change Pages -- they fall back to their
 * own Header. Nothing here is referenced by anything, because every insertion was a copy.
 */
export async function forgetBlueprint(id: string): Promise<void> {
  await requireUser();
  await database().delete(blueprints).where(eq(blueprints.id, id));
}
