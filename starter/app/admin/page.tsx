import { and, eq } from "drizzle-orm";
import { createDatabase, pages } from "@mimnets/core/db";

import { registry } from "../../blocks.config";
import { listVersions, publishPage, restoreVersion, saveDraft } from "./actions";
import { EditorClient } from "./EditorClient";

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

  // An unparseable draft opens as an empty Page rather than a crash, and History is where
  // the Author recovers from it.
  const { layout } = registry.safeParseLayout(page.draftLayout ?? page.publishedLayout);
  const versions = await listVersions(page.id);

  return (
    <EditorClient
      layout={layout}
      pageTitle={page.title}
      versions={versions}
      onSave={saveDraft}
      onPublish={publishPage}
      onRestore={restoreVersion}
    />
  );
}
