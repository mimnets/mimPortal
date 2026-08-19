import { redirect } from "next/navigation";

import { DashboardBar } from "./DashboardBar";
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
      <DashboardBar title="Pages" person={person} />

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
