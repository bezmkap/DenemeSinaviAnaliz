import { redirect } from "next/navigation";
import { requireUser } from "@/lib/panel";
import { getStore } from "@/lib/store/server";
import { AppShell } from "@/components/app-shell";
import { InstitutionsAdmin } from "@/components/admin-screens";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Okul kaydı" };

export default async function AdminHome() {
  const session = await requireUser();
  if (session.role !== "system_admin") redirect("/panel");
  const store = await getStore();
  const institutions = store.listInstitutions(session);
  return (
    <AppShell user={session} institution={null} modules={[]} institutions={institutions}>
      <InstitutionsAdmin institutions={institutions} />
    </AppShell>
  );
}
