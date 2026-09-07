import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SlotView } from "@mimnets/core";
import { createDatabase, pages } from "@mimnets/core/db";

import { registry } from "../../blocks.config";
import { baseUrl, requireDatabaseUrl } from "../../lib/env";
import { renderContext } from "../../lib/site";
import { resolveLayout } from "../../lib/slots";
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

export default async function PublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path } = await params;
  const currentPath = pathFrom(path);

  // A form Block reads this to know whether to say thank you, which is how a result
  // survives the redirect after a submission without any JavaScript having loaded.
  const rawQuery = await searchParams;
  const query = Object.fromEntries(
    Object.entries(rawQuery).map(([key, value]) => [key, Array.isArray(value) ? (value[0] ?? "") : (value ?? "")]),
  );

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

  // The Page holds Main and Sidebar; its Header and Footer usually come from a shared Slot,
  // which is what makes editing one change every Page that uses it.
  const { layout: resolved, headerSticky } = await resolveLayout(layout, {
    headerSlotId: page.headerSlotId,
    footerSlotId: page.footerSlotId,
  });

  const context = await renderContext(currentPath, query);

  return (
    <>
      {/* First in the document and hidden until focused, so the first Tab on any Page offers
          a way past the Header. With a Shared Header the same Menu appears on every Page,
          and without this a keyboard user tabs the whole of it every time. */}
      <a className="mn-skip" href="#main">
        Skip to content
      </a>

      <SlotView
        layout={resolved}
        slot="header"
        registry={registry}
        context={context}
        sticky={headerSticky}
      />
      <main id="main">
        <SlotView layout={resolved} slot="main" registry={registry} context={context} />
        <SlotView layout={resolved} slot="sidebar" registry={registry} context={context} />
      </main>
      <SlotView layout={resolved} slot="footer" registry={registry} context={context} />
    </>
  );
}
