import { redirect } from "next/navigation";

import { DashboardBar } from "../DashboardBar";
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
      <DashboardBar title="Enquiries" person={person} />

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
