import { redirect } from "next/navigation";

import { DashboardShell } from "../DashboardShell";
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
    <DashboardShell current="enquiries" person={person} title="Enquiries">

      <EnquiryList
        enquiries={await listEnquiries()}
        canDelete={person.role === "owner"}
        emailConfigured={sender.configured}
        emailName={sender.name}
        onMarkRead={markEnquiryRead}
        onDelete={deleteEnquiry}
      />
    </DashboardShell>
  );
}
