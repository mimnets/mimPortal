import Link from "next/link";
import { redirect } from "next/navigation";

import { currentUser } from "../../lib/session";
import { listPages } from "./actions";
import { PageList } from "./PageList";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const person = await currentUser();
  if (!person) redirect("/admin/sign-in");

  const rows = await listPages();

  return (
    <main className="mn-dash">
      <header className="mn-dash-bar">
        <strong>Pages</strong>
        <nav className="mn-dash-nav">
          <Link href="/admin/menus">Menus</Link>
          <Link href="/admin/media">Media</Link>
          <Link href="/admin/enquiries">Enquiries</Link>
          <Link href="/">View Site</Link>
        </nav>
        <span className="mn-ed-who">
          {person.name} · {person.role}
        </span>
      </header>

      <PageList
        canManage={person.role === "owner"}
        pages={rows.map((row) => ({
          id: row.id,
          path: row.path,
          title: row.title,
          isPublished: row.published !== null,
          updatedAt: row.updatedAt.toISOString(),
        }))}
      />
    </main>
  );
}
