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
import { resolveLayout } from "../../../../lib/slots";
import { storage } from "../../../../lib/storage";
import { listPages, listVersions, publishPage, restoreVersion, saveDraft } from "../../actions";
import { listMedia, uploadMedia } from "../../media-actions";
import { signOut } from "../../sign-out";
import { forgetBlueprint, listBlueprints, saveBlueprint } from "../../blueprint-actions";
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

  // The Editor shows what the Page will actually look like, so a shared Header is rendered
  // in place rather than showing the Page's own unused copy.
  const { layout: shown } = await resolveLayout(layout, {
    headerSlotId: page.headerSlotId,
    footerSlotId: page.footerSlotId,
  });

  const allPages = await listPages();

  /**
   * A shared Slot is not editable from a Page, because editing it here would change every
   * other Page and nothing on this screen would say so. It is marked read-only with the
   * reason, which is also how an Author finds where it *is* edited.
   */
  const slotNotes: Partial<Record<SlotName, string>> = {};
  const lockedByRole = (await lockedSlotsFor(person)) as SlotName[];
  const locked = new Set<SlotName>(lockedByRole);

  if (page.headerSlotId) {
    locked.add("header");
    slotNotes.header = "Shared — edit in Headers & Footers";
  }
  if (page.footerSlotId) {
    locked.add("footer");
    slotNotes.footer = "Shared — edit in Headers & Footers";
  }

  return (
    <EditorClient
      layout={shown}
      pageTitle={`${page.title} — ${page.path}`}
      versions={await listVersions(page.id)}
      lockedSlots={[...locked]}
      slotNotes={slotNotes}
      signedInAs={`${person.name} · ${person.role}`}
      context={await renderContext(page.path)}
      revision={page.revision}
      onSave={saveDraft.bind(null, page.id)}
      onPublish={publishPage.bind(null, page.id)}
      onRestore={restoreVersion.bind(null, page.id)}
      onSignOut={signOut}
      onListMedia={listMedia}
      onUploadMedia={uploadMedia}
      mediaBaseUrl={storage().baseUrl}
      onListBlueprints={listBlueprints}
      onSaveBlueprint={saveBlueprint}
      onForgetBlueprint={forgetBlueprint}
      assist={{ enabled: aiConfigured(), pageTitle: page.title }}
      nav={
        <>
          <PageSwitcher
            currentId={page.id}
            pages={allPages.map((row) => ({ id: row.id, title: row.title, path: row.path }))}
          />
          <Link href="/admin">Dashboard</Link>
          <Link href={`/admin/pages/${page.id}/settings`}>Settings</Link>
          <Link href="/admin/media">Media</Link>
          <Link href="/admin/menus">Menus</Link>
          <Link href="/admin/enquiries">Enquiries</Link>
          <a href={page.path} target="_blank" rel="noreferrer">
            View Page
          </a>
          <a href="/" target="_blank" rel="noreferrer">
            View Site
          </a>
        </>
      }
    />
  );
}
