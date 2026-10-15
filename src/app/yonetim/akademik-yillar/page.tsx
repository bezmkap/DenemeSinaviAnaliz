import { AcademicYearsAdmin } from "@/components/academic-years-admin";
import { AppShell } from "@/components/app-shell";
import { suggestNextAcademicYear } from "@/lib/domain";
import { requireUser } from "@/lib/panel";
import { getStore } from "@/lib/store/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Akademik yıllar" };

export default async function AcademicYearsPage() {
  const session = await requireUser();
  if (session.role !== "system_admin") redirect("/panel");
  const store = await getStore();
  const state = store.getState();
  const years = store.listAcademicYears().map((year) => ({
    ...year,
    sittingCount: state.sittings.filter((row) => row.academicYearId === year.id).length,
    studentCount: state.students.filter((row) => row.academicYearId === year.id).length,
  }));
  return (
    <AppShell user={session} institution={null} modules={[]} institutions={store.listInstitutions(session)}>
      <AcademicYearsAdmin years={years} suggestion={suggestNextAcademicYear(years)} />
    </AppShell>
  );
}
