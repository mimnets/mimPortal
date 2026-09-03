import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DashboardShell } from "../../../DashboardShell";import { createDatabase, pages } from "@mimnets/core/db";

import { requireDatabaseUrl } from "../../../../../lib/env";
import { currentUser } from "../../../../../lib/session";
import { storage } from "../../../../../lib/storage";
import { copyPageStructure, listPages, renamePage, savePageSeo } from "../../../actions";
import { listMedia, uploadMedia } from "../../../media-actions";
import { applySlotsToAllPages, setPageSlots } from "../../../slot-actions";
import { generatePageLayout } from "../../../preset-actions";
import { aiConfigured } from "../../../../../lib/ai";
import { listSharedSlots } from "../../../../../lib/slots";
import { PageSettings } from "./PageSettings";

export const dynamic = "force-dynamic";

export default async function PageSettingsRoute({ params }: { params: Promise<{ id: string }> }) {
  const person = await currentUser();
  if (!person) redirect("/admin/sign-in");

  const { id } = await params;
  const db = createDatabase(requireDatabaseUrl());
  const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  if (!page) notFound();

  const [sharedSlots, allPages] = await Promise.all([listSharedSlots(), listPages()]);

  return (
    <DashboardShell
      current="pages"
      person={person}
      title={page.title}
      actions={
        <>
          {/* Settings and the Editor are two views of one Page, so each has to reach the
              other. Moving this screen into the shell dropped that link for a while. */}
          <Link className="mn-button mn-button-primary" href={`/admin/pages/${page.id}`}>
            Open Editor
          </Link>
          <a className="mn-button" href={page.path} target="_blank" rel="noreferrer">
            View Page
          </a>
        </>
      }
    >

      <PageSettings
        pageId={page.id}
        title={page.title}
        path={page.path}
        seoTitle={page.seoTitle ?? ""}
        seoDescription={page.seoDescription ?? ""}
        seoImageKey={page.seoImageKey ?? ""}
        // Moving a Page changes every link to it, so it stays with the Owner.
        canRename={person.role === "owner"}
        mediaBaseUrl={storage().baseUrl}
        onSaveSeo={savePageSeo}
        onRename={renamePage}
        onListMedia={listMedia}
        onUploadMedia={uploadMedia}
        headerSlotId={page.headerSlotId}
        footerSlotId={page.footerSlotId}
        sharedSlots={sharedSlots.map((slot) => ({
          id: slot.id,
          name: slot.name,
          slot: slot.slot,
        }))}
        otherPages={allPages
          .filter((row) => row.id !== page.id)
          .map((row) => ({ id: row.id, title: row.title, path: row.path }))}
        onSetSlots={setPageSlots}
        onApplyToAll={applySlotsToAllPages}
        onCopyStructure={copyPageStructure}
        aiEnabled={aiConfigured()}
        onGeneratePage={generatePageLayout}
      />
    </DashboardShell>
  );
}
