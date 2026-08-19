import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import type { SlotName } from "@mimnets/core";
import { createDatabase, pages } from "@mimnets/core/db";

import { registry } from "../../../../blocks.config";
import { requireDatabaseUrl } from "../../../../lib/env";
import { currentUser, lockedSlotsFor } from "../../../../lib/session";
import { renderContext } from "../../../../lib/site";
import { storage } from "../../../../lib/storage";
import { listVersions, publishPage, restoreVersion, saveDraft } from "../../actions";
import { listMedia, uploadMedia } from "../../media-actions";
import { signOut } from "../../sign-out";
import { EditorClient } from "./EditorClient";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const person = await currentUser();
  if (!person) redirect("/admin/sign-in");

  const { id } = await params;
  const db = createDatabase(requireDatabaseUrl());
  const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  if (!page) notFound();

  // An unparseable draft opens as an empty Page rather than a crash, and History is where
  // the Author recovers from it.
  const { layout } = registry.safeParseLayout(page.draftLayout ?? page.publishedLayout);

  return (
    <EditorClient
      layout={layout}
      pageTitle={`${page.title} — ${page.path}`}
      versions={await listVersions(page.id)}
      lockedSlots={(await lockedSlotsFor(person)) as SlotName[]}
      signedInAs={`${person.name} · ${person.role}`}
      context={await renderContext(page.path)}
      onSave={saveDraft.bind(null, page.id)}
      onPublish={publishPage.bind(null, page.id)}
      onRestore={restoreVersion.bind(null, page.id)}
      onSignOut={signOut}
      onListMedia={listMedia}
      onUploadMedia={uploadMedia}
      mediaBaseUrl={storage().baseUrl}
    />
  );
}
