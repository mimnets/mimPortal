import { redirect } from "next/navigation";

import { DashboardShell } from "../DashboardShell";
import { currentUser } from "../../../lib/session";
import { storage } from "../../../lib/storage";
import { deleteMedia, listMedia, mediaUsage, setMediaAlt, uploadMedia } from "../media-actions";
import { MediaLibrary } from "./MediaLibrary";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const person = await currentUser();
  if (!person) redirect("/admin/sign-in");

  return (
    <DashboardShell current="media" person={person} title="Media">

      <MediaLibrary
        items={await listMedia()}
        // Read once for the whole screen rather than per file: one pass over the Pages
        // answers every row, and a query per image would be hundreds of round trips.
        usage={await mediaUsage()}
        // Deleting a file can break a Page that already uses it, so it stays with the Owner.
        canDelete={person.role === "owner"}
        storageName={storage().name}
        onUpload={uploadMedia}
        onSetAlt={setMediaAlt}
        onDelete={deleteMedia}
      />
    </DashboardShell>
  );
}
