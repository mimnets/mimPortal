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

  // A configured database that cannot be reached is an outage, not a Site waiting to be set
  // up. Offering the provisioning form here is what let an outage re-open the installer.
  if (mode === "unavailable") {
    return (
      <main className="mn-install">
        <h1>This Site is not available</h1>
        <p>
          Its database cannot be reached. Nothing is wrong with the Site itself, and the
          installer stays closed until the database answers again.
        </p>
      </main>
    );
  }

  // Generating the token here means it is in the server log before anyone can use the form.
  if (mode === "onboarding") await ensureInstallToken();

  return <InstallForm mode={mode} />;
}
