import { redirect } from "next/navigation";
import { requireUser } from "@/lib/panel";
import { getStore, persistStore } from "@/lib/store/server";
import { AppShell } from "@/components/app-shell";
import { DistrictUsersAdmin } from "@/components/admin-screens";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "İlçe kullanıcıları" };

export default async function DistrictUsersPage() {
  const session = await requireUser();
  if (session.role !== "system_admin") redirect("/panel");
  const store = await getStore();
  const institutions = store.listInstitutions(session);
  const users = store.listDistrictUsers(session);
  if (store.hasPendingSave()) await persistStore();
  return (
    <AppShell user={session} institution={null} modules={[]} institutions={institutions}>
      <DistrictUsersAdmin users={users} />
    </AppShell>
  );
}
