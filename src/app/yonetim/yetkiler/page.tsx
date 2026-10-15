import { redirect } from "next/navigation";
import { requireUser } from "@/lib/panel";
import { getStore } from "@/lib/store/server";
import { AppShell } from "@/components/app-shell";
import { PermissionsAdmin } from "@/components/admin-screens";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Yetkiler" };

export default async function PermissionsPage() {
  const session = await requireUser();
  if (session.role !== "system_admin") redirect("/panel");
  const store = await getStore();
  const institutions = store.listInstitutions(session);
  return (
    <AppShell user={session} institution={null} modules={[]} institutions={institutions}>
      <PermissionsAdmin
        institutions={institutions}
        permissionIndex={store.getState().permissions}
      />
    </AppShell>
  );
}
