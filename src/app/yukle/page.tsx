import { AppShell } from "@/components/app-shell";
import { ImportWizard } from "@/components/import-wizard";
import { requireUser } from "@/lib/panel";
import { getStore } from "@/lib/store/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sonuç yükle" };

export default async function UploadPage() {
  const session = await requireUser();
  if (session.role !== "system_admin") redirect("/panel");
  const store = await getStore();
  return (
    <AppShell
      user={session}
      institution={null}
      modules={[]}
      institutions={store.listInstitutions(session)}
      canViewNetwork
    >
      <ImportWizard
        years={store.listAcademicYears()}
        tytSittings={store.listExamSittings().filter((sitting) => sitting.examType === "TYT")}
      />
    </AppShell>
  );
}
