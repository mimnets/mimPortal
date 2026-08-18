import { and, eq } from "drizzle-orm";
import { createDatabase, pages } from "@mimnets/core/db";
import { EditorClient } from "./EditorClient";

import { registry } from "../../blocks.config";
import { saveDraft } from "./actions";

export const dynamic = "force-dynamic";

export default async function EditorPage() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Run `pnpm setup`.");

  const db = createDatabase(url);
  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.path, "/"), eq(pages.locale, "en")))
    .limit(1);

  if (!page) {
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <p>
          No Page exists at <code>/</code> yet. Run <code>pnpm seed</code>.
        </p>
      </main>
    );
  }

  // An unparseable draft opens as an empty Page rather than a crash; the Author can rebuild
  // it. M3 adds the version history that makes that recoverable rather than merely survivable.
  const { layout } = registry.safeParseLayout(page.draftLayout ?? page.publishedLayout);

  return <EditorClient layout={layout} pageTitle={page.title} onSave={saveDraft} />;
}
