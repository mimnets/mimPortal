import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { createDatabase, siteSettings } from "@mimnets/core/db";

import { aiProvider, aiProviders, visionConfigured } from "../../../lib/ai";
import { requireDatabaseUrl } from "../../../lib/env";
import { currentUser } from "../../../lib/session";
import { DashboardShell } from "../DashboardShell";
import {
  applyPreset,
  applyPresetTheme,
  generateFromImage,
  generatePresets,
  resetTheme,
} from "../preset-actions";
import { DesignStudio } from "./DesignStudio";

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

  return (
    <DashboardShell current="design" person={person} title="Design">
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
