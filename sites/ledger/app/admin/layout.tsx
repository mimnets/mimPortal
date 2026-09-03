import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import "@mimnets/admin/editor.css";

import { isInstalled } from "../../lib/install";

export const metadata = {
  title: "Mimnets Dashboard",
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // A Site nobody has installed has no account to sign in with, so send people to the
  // installer rather than to a login form that cannot succeed. Signing in is guarded per
  // page, because the sign-in page itself lives under /admin.
  if (!(await isInstalled())) redirect("/install");

  return children;
}
