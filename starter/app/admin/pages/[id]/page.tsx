import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { SlotName } from "@mimnets/core";
import { createDatabase, pages } from "@mimnets/core/db";

import { registry } from "../../../../blocks.config";
import { requireDatabaseUrl } from "../../../../lib/env";
import { currentUser, lockedSlotsFor } from "../../../../lib/session";
import { renderContext } from "../../../../lib/site";
import { aiConfigured } from "../../../../lib/ai";
import { storage } from "../../../../lib/storage";
import { listPages, listVersions, publishPage, restoreVersion, saveDraft } from "../../actions";
import { listMedia, uploadMedia } from "../../media-actions";
import { signOut } from "../../sign-out";
import { EditorClient } from "./EditorClient";
import { PageSwitcher } from "./PageSwitcher";

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
  const allPages = await listPages();

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
      assist={{ enabled: aiConfigured(), pageTitle: page.title }}
      nav={
        <>
          <PageSwitcher
            currentId={page.id}
            pages={allPages.map((row) => ({ id: row.id, title: row.title, path: row.path }))}
          />
          <Link href="/admin">Pages</Link>
          <Link href={`/admin/pages/${page.id}/settings`}>Settings</Link>
          <Link href="/admin/media">Media</Link>
          <Link href="/admin/menus">Menus</Link>
          <Link href="/admin/enquiries">Enquiries</Link>
          <a href={page.path} target="_blank" rel="noreferrer">
            View Page
          </a>
          <a href="/" target="_blank" rel="noreferrer">
            Home
          </a>
        </>
      }
    />
  );
}
