import { redirect } from "next/navigation";

import { currentUser } from "../../../lib/session";
import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await currentUser()) redirect("/admin");
  return <SignInForm />;
}
