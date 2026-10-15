import { AppShell } from "@/components/app-shell";
import { UploadsAdmin } from "@/components/uploads-admin";
import { requireUser } from "@/lib/panel";
import { getStore } from "@/lib/store/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Yüklemeler" };

export default async function UploadsPage() {
  const session = await requireUser();
  if (session.role !== "system_admin") redirect("/panel");
  const store = await getStore();
  const institutions = store.listInstitutions(session);
  return (
    <AppShell user={session} institution={null} modules={[]} institutions={institutions}>
      <UploadsAdmin uploads={store.listUploads(session)} />
    </AppShell>
  );
}
