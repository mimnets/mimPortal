import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { SlotName } from "@mimnets/core";
import { createDatabase, pages } from "@mimnets/core/db";

import { registry } from "../../blocks.config";
import { requireDatabaseUrl } from "../../lib/env";
import { currentUser, lockedSlotsFor } from "../../lib/session";
import { listVersions, publishPage, restoreVersion, saveDraft } from "./actions";
import { EditorClient } from "./EditorClient";
import { signOut } from "./sign-out";

export const dynamic = "force-dynamic";

export default async function EditorPage() {
  const person = await currentUser();
  if (!person) redirect("/admin/sign-in");

  const db = createDatabase(requireDatabaseUrl());
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

  return (
    <EditorClient
      layout={layout}
      pageTitle={page.title}
      versions={await listVersions(page.id)}
      lockedSlots={(await lockedSlotsFor(person)) as SlotName[]}
      signedInAs={`${person.name} · ${person.role}`}
      onSave={saveDraft}
      onPublish={publishPage}
      onRestore={restoreVersion}
      onSignOut={signOut}
    />
  );
}
