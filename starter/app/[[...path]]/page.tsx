import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SlotView } from "@mimnets/core";
import { createDatabase, pages } from "@mimnets/core/db";

import { registry } from "../../blocks.config";
import { baseUrl, requireDatabaseUrl } from "../../lib/env";
import { renderContext } from "../../lib/site";
import { storage } from "../../lib/storage";

// Pages are rendered from data on request (ADR-0002). Caching arrives with the first Site
// that needs it; correctness first.
export const dynamic = "force-dynamic";

function pathFrom(segments: string[] | undefined): string {
  return segments && segments.length > 0 ? `/${segments.join("/")}` : "/";
}

export async function generateMetadata({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const currentPath = pathFrom(path);

  const db = createDatabase(requireDatabaseUrl());
  const [page] = await db
    .select({
      title: pages.title,
      seoTitle: pages.seoTitle,
      seoDescription: pages.seoDescription,
      seoImageKey: pages.seoImageKey,
      published: pages.publishedLayout,
    })
    .from(pages)
    .where(and(eq(pages.path, currentPath), eq(pages.locale, "en")))
    .limit(1);

  // An unpublished Page is a 404 to a visitor, and a 404 describes nothing.
  if (!page?.published) return {};

  // The Page title is the fallback rather than a value copied into seoTitle when it was
  // left empty, so renaming a Page updates its search result too.
  const title = page.seoTitle || page.title;
  const description = page.seoDescription ?? undefined;

  // Social previews need an absolute URL; a share image is fetched by a server that has no
  // idea what this Site's origin is.
  const image = page.seoImageKey
    ? new URL(storage().url(page.seoImageKey), baseUrl()).toString()
    : undefined;

  return {
    title,
    description,
    alternates: { canonical: new URL(currentPath, baseUrl()).toString() },
    openGraph: {
      title,
      description,
      url: new URL(currentPath, baseUrl()).toString(),
      type: "website",
      images: image ? [image] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
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
