import Link from "next/link";
import { redirect } from "next/navigation";

import { currentUser } from "../../../lib/session";
import { storage } from "../../../lib/storage";
import { deleteMedia, listMedia, setMediaAlt, uploadMedia } from "../media-actions";
import { MediaLibrary } from "./MediaLibrary";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const person = await currentUser();
  if (!person) redirect("/admin/sign-in");

  return (
    <main className="mn-dash">
      <header className="mn-dash-bar">
        <strong>Media</strong>
        <nav className="mn-dash-nav">
          <Link href="/admin">Pages</Link>
          <Link href="/admin/menus">Menus</Link>
          <Link href="/">View Site</Link>
        </nav>
        <span className="mn-ed-who">
          {person.name} · {person.role}
        </span>
      </header>

      <MediaLibrary
        items={await listMedia()}
        // Deleting a file can break a Page that already uses it, so it stays with the Owner.
        canDelete={person.role === "owner"}
        storageName={storage().name}
        onUpload={uploadMedia}
        onSetAlt={setMediaAlt}
        onDelete={deleteMedia}
      />
    </main>
  );
}
