import { redirect } from "next/navigation";

import { currentUser } from "../../../lib/session";
import {
  createSharedSlot,
  deleteSharedSlot,
  listSharedSlotSummaries,
  renameSharedSlot,
} from "../slot-actions";
import { DashboardShell } from "../DashboardShell";
import { SlotList } from "./SlotList";

export const dynamic = "force-dynamic";

/**
 * The Headers and Footers a Site shares between its Pages.
 *
 * This screen exists because the product claimed something it did not do: every Page held
 * its own copy of the Header, so editing one changed one Page while the demo text said "the
 * Header above is the same on every Page". Only the Menu inside it was shared.
 */
export default async function SlotsPage() {
  const person = await currentUser();
  if (!person) redirect("/admin/sign-in");
  // A Header appears on every Page that uses it, which makes editing one the furthest-
  // reaching change in the product. It belongs to the Owner.
  if (person.role !== "owner") redirect("/admin");

  return (
    <DashboardShell current="slots" person={person} title="Headers & Footers">
      <SlotList
        slots={await listSharedSlotSummaries()}
        onCreate={createSharedSlot}
        onRename={renameSharedSlot}
        onDelete={deleteSharedSlot}
      />
    </DashboardShell>
  );
}
