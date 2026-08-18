import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { menuItemsSchema } from "@mimnets/core";
import { createDatabase, menus } from "@mimnets/core/db";

import { requireDatabaseUrl } from "../../../lib/env";
import { currentUser } from "../../../lib/session";
import { saveMenu } from "../actions";
import { MenuEditor } from "./MenuEditor";

export const dynamic = "force-dynamic";

const MAIN_MENU = "main";

export default async function MenusPage() {
  const person = await currentUser();
  if (!person) redirect("/admin/sign-in");

  const db = createDatabase(requireDatabaseUrl());
  const [row] = await db.select().from(menus).where(eq(menus.slug, MAIN_MENU)).limit(1);
  const parsed = menuItemsSchema.safeParse(row?.items ?? []);

  return (
    <main className="mn-dash">
      <header className="mn-dash-bar">
        <strong>Menus</strong>
        <nav className="mn-dash-nav">
          <Link href="/admin">Pages</Link>
          <Link href="/">View Site</Link>
        </nav>
        <span className="mn-ed-who">
          {person.name} · {person.role}
        </span>
      </header>

      <MenuEditor
        slug={MAIN_MENU}
        items={parsed.success ? parsed.data : []}
        canEdit={person.role === "owner"}
        onSave={saveMenu.bind(null, MAIN_MENU)}
      />
    </main>
  );
}
