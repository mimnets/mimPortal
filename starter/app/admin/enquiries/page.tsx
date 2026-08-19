import Link from "next/link";
import { redirect } from "next/navigation";

import { currentUser } from "../../../lib/session";
import { email } from "../../../lib/email";
import { deleteEnquiry, listEnquiries, markEnquiryRead } from "../enquiry-actions";
import { EnquiryList } from "./EnquiryList";

export const dynamic = "force-dynamic";

export default async function EnquiriesPage() {
  const person = await currentUser();
  if (!person) redirect("/admin/sign-in");

  const sender = email();

  return (
    <main className="mn-dash">
      <header className="mn-dash-bar">
        <strong>Enquiries</strong>
        <nav className="mn-dash-nav">
          <Link href="/admin">Pages</Link>
          <Link href="/admin/menus">Menus</Link>
          <Link href="/admin/media">Media</Link>
          <Link href="/">View Site</Link>
        </nav>
        <span className="mn-ed-who">
          {person.name} · {person.role}
        </span>
      </header>

      <EnquiryList
        enquiries={await listEnquiries()}
        canDelete={person.role === "owner"}
        emailConfigured={sender.configured}
        emailName={sender.name}
        onMarkRead={markEnquiryRead}
        onDelete={deleteEnquiry}
      />
    </main>
  );
}
