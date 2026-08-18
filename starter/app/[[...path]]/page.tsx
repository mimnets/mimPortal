import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SlotView } from "@mimnets/core";
import { createDatabase, pages } from "@mimnets/core/db";

import { registry } from "../../blocks.config";
import { requireDatabaseUrl } from "../../lib/env";
import { renderContext } from "../../lib/site";

// Pages are rendered from data on request (ADR-0002). Caching arrives with the first Site
// that needs it; correctness first.
export const dynamic = "force-dynamic";

function pathFrom(segments: string[] | undefined): string {
  return segments && segments.length > 0 ? `/${segments.join("/")}` : "/";
}

export async function generateMetadata({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const db = createDatabase(requireDatabaseUrl());
  const [page] = await db
    .select({ title: pages.title })
    .from(pages)
    .where(and(eq(pages.path, pathFrom(path)), eq(pages.locale, "en")))
    .limit(1);

  return { title: page?.title };
}

export default async function PublicPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const currentPath = pathFrom(path);

  const db = createDatabase(requireDatabaseUrl());
  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.path, currentPath), eq(pages.locale, "en")))
    .limit(1);

  // A Page that exists but has never been published is not public yet, which is the same
  // thing to a visitor as a Page that does not exist.
  if (!page?.publishedLayout) notFound();

  const { layout } = registry.safeParseLayout(page.publishedLayout);
  const context = await renderContext(currentPath);

  return (
    <>
      <SlotView layout={layout} slot="header" registry={registry} context={context} />
      <main>
        <SlotView layout={layout} slot="main" registry={registry} context={context} />
        <SlotView layout={layout} slot="sidebar" registry={registry} context={context} />
      </main>
      <SlotView layout={layout} slot="footer" registry={registry} context={context} />
    </>
  );
}
