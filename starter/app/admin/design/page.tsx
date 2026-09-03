import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { completeTheme } from "@mimnets/core";
import { createDatabase, siteSettings } from "@mimnets/core/db";

import { aiProvider, aiProviders, visionConfigured } from "../../../lib/ai";
import { requireDatabaseUrl } from "../../../lib/env";
import { currentUser } from "../../../lib/session";
import { DashboardShell } from "../DashboardShell";
import {
  applyBuiltInPreset,
  applyPreset,
  applyPresetTheme,
  generateFromImage,
  generatePresets,
  listBuiltInPresets,
  resetTheme,
  saveTheme,
} from "../preset-actions";
import { theme as fileTheme } from "../../../theme";
import { DesignStudio } from "./DesignStudio";
import { ReadyMade } from "./ReadyMade";
import { ThemeEditor } from "./ThemeEditor";

export const dynamic = "force-dynamic";

/**
 * Where a Site's design is generated.
 *
 * A Preset is a Theme and a set of Pages made together, because generated apart they are
 * incoherent — a considered palette on a generic layout (ADR-0007).
 */
export default async function DesignPage() {
  const person = await currentUser();
  if (!person) redirect("/admin/sign-in");
  // Scaffolding a whole Site is structural. An Author regenerates a single Page, from that
  // Page's own screen.
  if (person.role !== "owner") redirect("/admin");

  const db = createDatabase(requireDatabaseUrl());
  const [settings] = await db
    .select({ theme: siteSettings.theme, siteName: siteSettings.siteName })
    .from(siteSettings)
    .where(eq(siteSettings.id, "singleton"))
    .limit(1);

  const provider = aiProvider();

  // What the Site is wearing right now: the stored Theme if a design has been applied,
  // otherwise the one in theme.ts.
  const stored = settings?.theme;
  const active = stored
    ? completeTheme(stored as Parameters<typeof completeTheme>[0])
    : fileTheme;

  return (
    <DashboardShell current="design" person={person} title="Design">
      <ReadyMade presets={await listBuiltInPresets()} onApply={applyBuiltInPreset} />

      <ThemeEditor
        theme={{
          colors: { ...active.colors },
          fonts: { body: active.fonts.body, heading: active.fonts.heading },
          radius: { base: active.radius.base },
          spacing: { section: active.spacing.section, gutter: active.spacing.gutter },
          measure: active.measure,
        }}
        onSave={saveTheme}
      />

      <DesignStudio
        enabled={provider !== null}
        providerName={provider?.name ?? null}
        providers={aiProviders().map((one) => ({
          name: one.name,
          model: one.model,
          free: one.free,
        }))}
        siteName={settings?.siteName ?? ""}
        usingGeneratedTheme={settings?.theme != null}
        onGenerate={generatePresets}
        onApply={applyPreset}
        onApplyTheme={applyPresetTheme}
        onReset={resetTheme}
        visionEnabled={visionConfigured()}
        onGenerateFromImage={generateFromImage}
      />
    </DashboardShell>
  );
}
