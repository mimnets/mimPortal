"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { PageLayout } from "@mimnets/core";
import { generatePreset, PRESET_DIRECTIONS, type GeneratedPreset } from "@mimnets/core/ai";
import { createDatabase, pageVersions, pages, siteSettings } from "@mimnets/core/db";

import { registry } from "../../blocks.config";
import { aiProvider, aiProviderNamed, withinRateLimit } from "../../lib/ai";
import { requireDatabaseUrl } from "../../lib/env";
import { requireOwner, requireUser } from "../../lib/session";

/**
 * Generating and applying Presets (ADR-0007).
 *
 * Two audiences with different powers. An Owner scaffolds a whole Site — a Theme and several
 * Pages at once. An Author may regenerate the Page they are on, which writes to that Page's
 * draft and snapshots the previous version first, so a client who preferred what was there
 * before is one click from having it back rather than one support call.
 */

export interface PresetOption {
  name: string;
  description: string;
  theme: GeneratedPreset["theme"];
  pages: { title: string; path: string; sections: number; blocks: number }[];
  /** The whole thing, carried back when one is applied so nothing is generated twice. */
  payload: string;
}

function database() {
  return createDatabase(requireDatabaseUrl());
}

function summarise(preset: GeneratedPreset): PresetOption {
  return {
    name: preset.name,
    description: preset.description,
    theme: preset.theme,
    pages: preset.pages.map((page) => ({
      title: page.title,
      path: page.path,
      sections: page.layout.slots.main.length,
      blocks: page.layout.slots.main.reduce(
        (total, section) =>
          total + section.columns.reduce((sum, column) => sum + column.blocks.length, 0),
        0,
      ),
    })),
    payload: JSON.stringify(preset),
  };
}

/**
 * Offers several designs rather than one.
 *
 * Each is given a different direction, because four runs of the same prompt produce four
 * versions of one idea — which reads as "the AI has a house style" and is the thing that
 * makes generated Sites recognisable as generated.
 */
export async function generatePresets(input: {
  brief: string;
  count?: number;
  /** An Owner's choice of provider. Empty means the whole chain, free models first. */
  provider?: string;
}): Promise<{ options: PresetOption[]; failures: string[] }> {
  const person = await requireOwner();

  const provider = aiProviderNamed(input.provider);
  if (!provider) throw new Error("No AI provider is configured for this Site. See docs/AI.md.");
  if (!withinRateLimit(person.id)) throw new Error("Too many requests at once. Wait a moment.");

  const brief = input.brief.trim();
  if (brief.length < 3) throw new Error("Describe the Site in a few words first.");
  if (brief.length > 500) throw new Error("That description is too long.");

  const count = Math.min(Math.max(input.count ?? 3, 1), PRESET_DIRECTIONS.length);

  // Generated together rather than one after another: four sequential calls to a free model
  // is a minute of somebody watching a spinner.
  const results = await Promise.allSettled(
    PRESET_DIRECTIONS.slice(0, count).map((direction) =>
      generatePreset(provider, { brief, registry, direction }),
    ),
  );

  const options: PresetOption[] = [];
  const failures: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") options.push(summarise(result.value));
    // Some options failing is normal and not worth losing the others over — a free model
    // returning one malformed design should not cost the three that worked.
    else failures.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
  }

  if (options.length === 0) {
    throw new Error(`Nothing could be generated. ${failures[0] ?? ""}`.trim());
  }

  return { options, failures };
}

function parsePayload(payload: string): GeneratedPreset {
  const preset = JSON.parse(payload) as GeneratedPreset;

  // Re-validated on the way in. The payload made a round trip through the browser, and
  // trusting it here would make every schema check upstream decorative.
  return {
    ...preset,
    pages: preset.pages.map((page) => ({
      ...page,
      layout: registry.parseLayout(page.layout),
    })),
  };
}

/**
 * Applies a whole Preset: the Theme, and every Page it generated.
 *
 * Pages are written as drafts, not published. Scaffolding a Site should not put four
 * generated Pages in front of visitors before anybody has read them.
 */
export async function applyPreset(payload: string): Promise<{ pages: number }> {
  await requireOwner();
  const preset = parsePayload(payload);
  const db = database();

  await db
    .update(siteSettings)
    .set({ theme: preset.theme })
    .where(eq(siteSettings.id, "singleton"));

  for (const page of preset.pages) {
    const [existing] = await db
      .select({ id: pages.id, published: pages.publishedLayout })
      .from(pages)
      .where(and(eq(pages.path, page.path), eq(pages.locale, "en")))
      .limit(1);

    if (existing) {
      // A Page that already exists keeps its published version and its history; only the
      // draft is replaced, so applying a Preset over a live Site changes nothing a visitor
      // sees until somebody publishes it.
      if (existing.published) {
        await db.insert(pageVersions).values({ pageId: existing.id, layout: existing.published });
      }
      await db
        .update(pages)
        .set({ title: page.title, draftLayout: page.layout, updatedAt: new Date() })
        .where(eq(pages.id, existing.id));
    } else {
      await db.insert(pages).values({
        path: page.path,
        title: page.title,
        locale: "en",
        draftLayout: page.layout,
      });
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin");
  return { pages: preset.pages.length };
}

/** Applies only the Theme, for an Owner who liked the palette and not the layouts. */
export async function applyPresetTheme(payload: string): Promise<void> {
  await requireOwner();
  const preset = parsePayload(payload);

  await database()
    .update(siteSettings)
    .set({ theme: preset.theme })
    .where(eq(siteSettings.id, "singleton"));

  revalidatePath("/", "layout");
  revalidatePath("/admin/design");
}

/** Back to `theme.ts`. Applying a Preset is never destructive, and this is why. */
export async function resetTheme(): Promise<void> {
  await requireOwner();
  await database().update(siteSettings).set({ theme: null }).where(eq(siteSettings.id, "singleton"));
  revalidatePath("/", "layout");
  revalidatePath("/admin/design");
}

/**
 * Regenerates one Page, which an Author may do (ADR-0007).
 *
 * It writes to the draft and snapshots what was published first. That snapshot is the whole
 * reason an Author is allowed to do this at all: regenerating a Page a client liked better
 * before is an undo in History, not an incident.
 */
export async function generatePageLayout(input: {
  pageId: string;
  brief: string;
}): Promise<PageLayout> {
  const person = await requireUser();

  const provider = aiProvider();
  if (!provider) throw new Error("No AI provider is configured for this Site. See docs/AI.md.");
  if (!withinRateLimit(person.id)) throw new Error("Too many requests at once. Wait a moment.");

  const db = database();
  const [page] = await db.select().from(pages).where(eq(pages.id, input.pageId)).limit(1);
  if (!page) throw new Error("That Page no longer exists.");

  const preset = await generatePreset(provider, {
    brief: `${input.brief.trim()}\n\nGenerate exactly one page, titled "${page.title}", at path "${page.path}".`,
    registry,
  });

  const generated = preset.pages[0];
  if (!generated) throw new Error("Nothing was generated for that Page.");

  // Snapshot before overwriting, so History has the version that was there.
  if (page.publishedLayout) {
    await db.insert(pageVersions).values({ pageId: page.id, layout: page.publishedLayout });
  }

  // Only Main is replaced. The Header and Footer are the Site's, usually shared, and
  // regenerating one Page has no business changing them.
  const next: PageLayout = registry.parseLayout({
    ...registry.safeParseLayout(page.draftLayout ?? page.publishedLayout).layout,
    slots: {
      ...registry.safeParseLayout(page.draftLayout ?? page.publishedLayout).layout.slots,
      main: generated.layout.slots.main,
    },
  });

  await db
    .update(pages)
    .set({ draftLayout: next, updatedAt: new Date() })
    .where(eq(pages.id, page.id));

  revalidatePath("/admin");
  return next;
}
