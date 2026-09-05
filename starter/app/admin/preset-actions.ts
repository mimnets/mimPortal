"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { PageLayout } from "@mimnets/core";
import { generatePreset, PRESET_DIRECTIONS, type GeneratedPreset } from "@mimnets/core/ai";
import { completeTheme, themeSchema } from "@mimnets/core";
import { createDatabase, pageVersions, pages, siteSettings } from "@mimnets/core/db";

import { registry } from "../../blocks.config";
import { fillStockImages } from "../../lib/stock-fill";
import { BUILT_IN_PRESETS, presetBySlug } from "../../presets";
import { aiProvider, aiProviderNamed, visionProvider, withinRateLimit } from "../../lib/ai";
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
  //
  // That included the Theme, which used to pass through untouched while the layouts beside
  // it were checked. A Theme is compiled into CSS custom properties inside a <style> tag on
  // every page of the Site, so an unchecked one is a stored injection with a Site-wide reach
  // — and the schema that would have caught it was already being applied by saveTheme two
  // hundred lines below. Same schema here, same completion of the derived values.
  return {
    ...preset,
    theme: completeTheme(themeSchema.parse(preset.theme)),
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
    // The photographs, before the layout is written. A Preset that has just been chosen is
    // the only moment worth fetching them: the other three nobody picked cost nothing, and
    // an Author opening the Editor afterwards finds a Page rather than a wireframe.
    //
    // Failures here are already absorbed — an image that cannot be fetched stays empty with
    // its description intact, so this cannot stop a Preset applying.
    await fillStockImages(page.layout, registry);

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
        .set({
          title: page.title,
          draftLayout: page.layout,
          revision: sql`${pages.revision} + 1`,
          updatedAt: new Date(),
        })
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

  await fillStockImages(next, registry);

  await db
    .update(pages)
    // The draft is being replaced wholesale, so any Editor holding this Page is now looking
    // at something that no longer exists. Bumping `revision` is what makes its next Save fail
    // the `atRevision` check and say STALE, instead of silently overwriting this.
    .set({ draftLayout: next, revision: sql`${pages.revision} + 1`, updatedAt: new Date() })
    .where(eq(pages.id, page.id));

  revalidatePath("/admin");
  return next;
}

/**
 * Designs a Site from a picture of one.
 *
 * The division of labour is the whole point. The palette arrives already read from the
 * image's pixels in the browser — exact, and not a model's description of a colour. The
 * model is asked only for the thing pixels cannot answer: how the page is arranged.
 *
 * A Figma frame works by exporting it as a PNG. A Figma *link* cannot be read: the URL is a
 * JavaScript application, and fetching it returns markup with no design in it.
 */
export async function generateFromImage(input: {
  /** A downscaled data URL, produced in the browser. */
  dataUrl: string;
  /** Colours read from the same image, which override anything the model says. */
  palette: Record<string, string>;
  brief: string;
}): Promise<{ options: PresetOption[]; failures: string[] }> {
  const person = await requireOwner();

  const provider = visionProvider();
  if (!provider) {
    throw new Error(
      "None of this Site's configured models can read an image. Add a vision-capable one — " +
        "see docs/AI.md.",
    );
  }
  if (!withinRateLimit(person.id)) throw new Error("Too many requests at once. Wait a moment.");

  if (!input.dataUrl.startsWith("data:image/")) throw new Error("That is not an image.");
  // Roughly 4 MB of base64. A model cannot use more detail than this carries, and a larger
  // body is a slower request for no gain.
  if (input.dataUrl.length > 5_500_000) throw new Error("That image is too large. Under 4 MB.");

  const results = await Promise.allSettled([
    generatePreset(provider, {
      brief: input.brief,
      registry,
      image: input.dataUrl,
      palette: input.palette,
    }),
  ]);

  const options: PresetOption[] = [];
  const failures: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") options.push(summarise(result.value));
    else failures.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
  }

  if (options.length === 0) {
    throw new Error(`That design could not be read. ${failures[0] ?? ""}`.trim());
  }

  return { options, failures };
}

/* ---- The designs that ship with the Starter ------------------------------- */

export interface BuiltInSummary {
  slug: string;
  name: string;
  category: string;
  description: string;
  theme: GeneratedPreset["theme"];
  pages: { title: string; path: string; sections: number }[];
}

/** Ids are assigned here, exactly as they are for a generated Preset. */
function withIds(sections: unknown[]): unknown[] {
  const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

  return sections.map((section) => {
    const node = section as { columns?: { blocks?: unknown[] }[] };
    return {
      ...(section as object),
      id: id("sec"),
      columns: (node.columns ?? []).map((column) => ({
        ...column,
        id: id("col"),
        blocks: (column.blocks ?? []).map((block) => ({ ...(block as object), id: id("blk") })),
      })),
    };
  });
}

/** Every ready-made design, for the gallery. Cheap: it is data in the bundle. */
export async function listBuiltInPresets(): Promise<BuiltInSummary[]> {
  await requireOwner();

  return BUILT_IN_PRESETS.map((preset) => ({
    slug: preset.slug,
    name: preset.name,
    category: preset.category,
    description: preset.description,
    theme: completeTheme(preset.theme),
    pages: preset.pages.map((page) => ({
      title: page.title,
      path: page.path,
      sections: page.sections.length,
    })),
  }));
}

/**
 * Applies a ready-made design.
 *
 * Built server-side from the slug rather than from anything the browser sent, and then run
 * through the same `applyPreset` an AI-generated one uses — so a built-in gets no more
 * trust than model output does, and there is one code path for "a design was applied".
 */
export async function applyBuiltInPreset(slug: string): Promise<{ pages: number }> {
  await requireOwner();

  const preset = presetBySlug(slug);
  if (!preset) throw new Error("That design is not one this Site ships with.");

  const payload: GeneratedPreset = {
    name: preset.name,
    description: preset.description,
    theme: completeTheme(preset.theme),
    pages: preset.pages.map((page) => ({
      title: page.title,
      path: page.path,
      layout: registry.parseLayout({
        version: 1,
        slots: { header: [], main: withIds(page.sections), sidebar: [], footer: [] },
      }),
    })),
  };

  return applyPreset(JSON.stringify(payload));
}

/**
 * Saves a Theme edited by hand.
 *
 * The "customisable" half of a ready-made design: apply one, then change the six colours
 * that matter without regenerating anything. Validated like any other Theme, because it
 * arrives from a form and is compiled straight into CSS custom properties.
 */
export async function saveTheme(input: Record<string, unknown>): Promise<void> {
  await requireOwner();

  const parsed = themeSchema.parse(input);

  await database()
    .update(siteSettings)
    .set({ theme: completeTheme(parsed) })
    .where(eq(siteSettings.id, "singleton"));

  revalidatePath("/", "layout");
  revalidatePath("/admin/design");
}
