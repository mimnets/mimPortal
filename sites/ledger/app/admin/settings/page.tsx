import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createDatabase, siteSettings } from "@mimnets/core/db";

import { aiProvider } from "../../../lib/ai";
import { email } from "../../../lib/email";
import { requireDatabaseUrl } from "../../../lib/env";
import { currentUser } from "../../../lib/session";
import { storage } from "../../../lib/storage";
import { DashboardShell } from "../DashboardShell";

export const dynamic = "force-dynamic";

/**
 * What this Site is wired up to, and where each piece is configured.
 *
 * Deliberately read-only. Storage keys, mail credentials and AI keys live in the Site's
 * environment, not in its database — a Dashboard form that writes an API key into a table
 * is a different security posture, and it would put a client one screen away from breaking
 * their own Site's email.
 *
 * So this screen answers the question people actually have, which is not "let me change
 * the SMTP password" but "is email even set up, and where do I do that?".
 */
export default async function SettingsPage() {
  const person = await currentUser();
  if (!person) redirect("/admin/sign-in");
  if (person.role !== "owner") redirect("/admin");

  const db = createDatabase(requireDatabaseUrl());
  const [settings] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, "singleton"))
    .limit(1);

  const mail = email();
  const ai = aiProvider();
  const files = storage();

  const rows: {
    name: string;
    status: "on" | "off";
    detail: string;
    where: string;
    docs?: string;
  }[] = [
    {
      name: "Uploads",
      status: "on",
      detail: `Stored on ${files.name}`,
      where: files.name === "local disk" ? "MEDIA_DIR in .env" : "S3_* in .env",
      docs: "docs/HOSTING.md",
    },
    {
      name: "Email",
      status: mail.configured ? "on" : "off",
      detail: mail.configured
        ? `Notifications sent via ${mail.name}`
        : "Enquiries are collected, but nobody is notified",
      where: "RESEND_API_KEY or SMTP_* in .env",
      docs: "docs/EMAIL.md",
    },
    {
      name: "Writing assistant",
      status: ai ? "on" : "off",
      detail: ai
        ? `${ai.name} — leads with ${ai.model}`
        : "The Editor shows no assistant buttons",
      where: "OPENROUTER_API_KEY or another AI key in .env",
      docs: "docs/AI.md",
    },
  ];

  return (
    <DashboardShell current="settings" person={person} title="Site settings">
      <section className="mn-field-group">
        <legend>This Site</legend>
        <dl className="mn-facts">
          <div>
            <dt>Name</dt>
            <dd>{settings?.siteName ?? "—"}</dd>
          </div>
          <div>
            <dt>Locked for Authors</dt>
            <dd>{(settings?.lockedSlots ?? []).join(", ") || "nothing"}</dd>
          </div>
          <div>
            <dt>Installed</dt>
            <dd>
              {settings?.installedAt
                ? new Date(settings.installedAt).toLocaleDateString()
                : "not yet"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mn-field-group">
        <legend>Services</legend>
        <p className="mn-media-meta">
          These are configured in the Site’s <code>.env</code> file and read once at boot, not
          from this screen. Keys belong to the deployment rather than to the database — a form
          here would put an API key in a table and a client one click from breaking their own
          Site.
        </p>

        <ul className="mn-page-list">
          {rows.map((row) => (
            <li key={row.name} className="mn-page-row">
              <span className={`mn-badge${row.status === "on" ? " is-live" : ""}`}>
                {row.status === "on" ? "Configured" : "Not set up"}
              </span>

              <span className="mn-page-main">
                <strong>{row.name}</strong>
                <span className="mn-media-meta">{row.detail}</span>
              </span>

              <span className="mn-media-meta">
                <code>{row.where}</code>
                {row.docs ? ` · ${row.docs}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </DashboardShell>
  );
}
