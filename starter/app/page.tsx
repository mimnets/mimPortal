import { and, eq } from "drizzle-orm";
import { SlotView } from "@mimnets/core";
import { createDatabase, pages } from "@mimnets/core/db";

import { registry } from "../blocks.config";

// Pages are rendered from data on request (ADR-0002). Caching arrives with M5's routing;
// until then every request reads the Page it renders.
export const dynamic = "force-dynamic";

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Run `pnpm setup`.");
  return url;
}

export default async function HomePage() {
  const db = createDatabase(requireDatabaseUrl());

  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.path, "/"), eq(pages.locale, "en")))
    .limit(1);

  if (!page) {
    return (
      <main className="mn-section">
        <p>
          No Page exists at <code>/</code> yet. Run <code>pnpm seed</code> to insert one.
        </p>
      </main>
    );
  }

  // A Page that fails validation renders empty rather than throwing: one bad document must
  // not take down a Site. The Editor is where the error gets surfaced (M2).
  const { layout, error } = registry.safeParseLayout(page.publishedLayout);

  return (
    <>
      <SlotView layout={layout} slot="header" registry={registry} />
      <main>
        <SlotView layout={layout} slot="main" registry={registry} />
        <SlotView layout={layout} slot="sidebar" registry={registry} />
      </main>
      <SlotView layout={layout} slot="footer" registry={registry} />
      {error ? (
        <pre className="mn-section" style={{ color: "#b00", whiteSpace: "pre-wrap" }}>
          {error}
        </pre>
      ) : null}
    </>
  );
}
