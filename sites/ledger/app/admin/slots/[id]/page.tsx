import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { PageLayout, SlotName } from "@mimnets/core";
import { emptyLayout } from "@mimnets/core";

import { registry } from "../../../../blocks.config";
import { aiConfigured } from "../../../../lib/ai";
import { currentUser } from "../../../../lib/session";
import { renderContext } from "../../../../lib/site";
import { sharedSlotById } from "../../../../lib/slots";
import { storage } from "../../../../lib/storage";
import { listMedia, uploadMedia } from "../../media-actions";
import { saveSharedSlot } from "../../slot-actions";
import { SlotEditorClient } from "./SlotEditorClient";

export const dynamic = "force-dynamic";

/**
 * Editing one shared Header or Footer.
 *
 * The same Editor a Page uses, showing one Slot. There is no draft and no Publish: a shared
 * Slot saves straight through, the way a Menu does, because a Page being published while the
 * Header it renders is not has no sensible answer.
 */
export default async function SharedSlotPage({ params }: { params: Promise<{ id: string }> }) {
  const person = await currentUser();
  if (!person) redirect("/admin/sign-in");
  if (person.role !== "owner") redirect("/admin");

  const { id } = await params;
  const row = await sharedSlotById(id);
  if (!row) notFound();

  const slot = row.slot as SlotName;

  // The Editor works on a whole layout document, so the Slot's sections are wrapped in one.
  // Only this Slot is shown, so the other three stay empty and unused.
  const layout: PageLayout = emptyLayout();
  const parsed = registry.safeParseLayout({
    version: 1,
    slots: { header: [], main: [], sidebar: [], footer: [], [slot]: row.sections },
  });
  layout.slots[slot] = parsed.layout.slots[slot];

  return (
    <SlotEditorClient
      layout={layout}
      slot={slot}
      title={`${row.name} — shared ${slot}`}
      context={await renderContext("/")}
      signedInAs={`${person.name} · ${person.role}`}
      mediaBaseUrl={storage().baseUrl}
      assist={{ enabled: aiConfigured() }}
      onSave={async (next: PageLayout) => {
        "use server";
        await saveSharedSlot(id, next.slots[slot]);
      }}
      onListMedia={listMedia}
      onUploadMedia={uploadMedia}
      nav={
        <>
          <Link href="/admin/slots">Headers &amp; Footers</Link>
          <Link href="/admin">Dashboard</Link>
          <a href="/" target="_blank" rel="noreferrer">
            View Site
          </a>
        </>
      }
    />
  );
}
