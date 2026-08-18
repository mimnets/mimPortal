import { redirect } from "next/navigation";

import "@mimnets/admin/editor.css";

import { ensureInstallToken, installMode } from "../../lib/install";
import { InstallForm } from "./InstallForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Install" };

export default async function InstallPage() {
  const mode = await installMode();

  // The installer disappears for good once the Site is installed.
  if (mode === "installed") redirect("/admin");

  // Generating the token here means it is in the server log before anyone can use the form.
  if (mode === "onboarding") await ensureInstallToken();

  return <InstallForm mode={mode} />;
}
