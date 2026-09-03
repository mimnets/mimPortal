import { asc, eq, isNotNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { DashboardShell } from "../DashboardShell";import { menuItemsSchema } from "@mimnets/core";
import { createDatabase, menus, pages } from "@mimnets/core/db";

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

  /**
   * The Site's Pages, so a link can be chosen rather than typed.
   *
   * Whether a Page is published is asked of the database as a boolean rather than by
   * selecting `publishedLayout` and testing it here — a Site with fifty Pages would
   * otherwise ship fifty layout documents to this screen to answer fifty yes/no questions.
   */
  const sitePages = await db
    .select({
      id: pages.id,
      path: pages.path,
      title: pages.title,
      published: sql<boolean>`${isNotNull(pages.publishedLayout)}`,
    })
    .from(pages)
    .orderBy(asc(pages.path));

  return (
    <DashboardShell current="menus" person={person} title="Menus">

      <MenuEditor
        slug={MAIN_MENU}
        items={parsed.success ? parsed.data : []}
        pages={sitePages}
        canEdit={person.role === "owner"}
        onSave={saveMenu.bind(null, MAIN_MENU)}
      />
    </DashboardShell>
  );
}
