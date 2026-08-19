import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DashboardBar } from "../../../DashboardBar";import { createDatabase, pages } from "@mimnets/core/db";

import { requireDatabaseUrl } from "../../../../../lib/env";
import { currentUser } from "../../../../../lib/session";
import { storage } from "../../../../../lib/storage";
import { renamePage, savePageSeo } from "../../../actions";
import { listMedia, uploadMedia } from "../../../media-actions";
import { PageSettings } from "./PageSettings";

export const dynamic = "force-dynamic";

export default async function PageSettingsRoute({ params }: { params: Promise<{ id: string }> }) {
  const person = await currentUser();
  if (!person) redirect("/admin/sign-in");

  const { id } = await params;
  const db = createDatabase(requireDatabaseUrl());
  const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  if (!page) notFound();

  return (
    <main className="mn-dash">
      <DashboardBar
        title={page.title}
        person={person}
        extra={<Link href={`/admin/pages/${page.id}`}>Editor</Link>}
      />

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
      />
    </main>
  );
}
