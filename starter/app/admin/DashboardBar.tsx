import Link from "next/link";
import type { ReactNode } from "react";

import type { CurrentUser } from "../../lib/session";
import { signOut } from "./sign-out";

/**
 * The bar across the top of every Dashboard screen.
 *
 * One component rather than the same nav pasted into five pages: the links drifted the
 * moment a sixth screen was added, and signing out was missing from all of them because
 * there was no single place it belonged.
 *
 * Sign-out is a form posting to a server action, not a button with an onClick. Ending a
 * session is a mutation, and it should work on a Dashboard whose JavaScript has not loaded.
 */
export function DashboardBar({
  title,
  person,
  extra,
}: {
  title: string;
  person: CurrentUser;
  /** Links that belong to one screen only, such as the Editor from a Page settings screen. */
  extra?: ReactNode;
}) {
  return (
    <header className="mn-dash-bar">
      <strong>{title}</strong>

      <nav className="mn-dash-nav">
        {extra}
        <Link href="/admin">Pages</Link>
        <Link href="/admin/menus">Menus</Link>
        <Link href="/admin/media">Media</Link>
        <Link href="/admin/enquiries">Enquiries</Link>
        <Link href="/">View Site</Link>
      </nav>

      <span className="mn-ed-who">
        {person.name} · {person.role}
      </span>

      <form action={signOut}>
        <button type="submit" className="mn-button">
          Sign out
        </button>
      </form>
    </header>
  );
}
