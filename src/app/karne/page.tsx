import { AppShell } from "@/components/app-shell";
import { ClassReportCardsScreen } from "@/components/class-report-cards-screen";
import { loadPanelContext } from "@/lib/panel";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Öğrenci karnesi" };

export default async function KarnePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const kurum = typeof params.kurum === "string" ? params.kurum : undefined;
  const sinav = typeof params.sinav === "string" ? params.sinav : "";
  const sinif = typeof params.sinif === "string" ? params.sinif : "";
  const ctx = await loadPanelContext(kurum);
  const filters = ctx.institution ? ctx.store.listFilterOptions(ctx.session, ctx.institution.id) : null;
  const sittings = [...(filters?.sittings ?? [])].sort(
    (a, b) => b.examDate.localeCompare(a.examDate) || a.name.localeCompare(b.name, "tr"),
  );
  const classes = filters?.classes ?? [];
  const selectedSittingId = sinav || sittings[0]?.id || "";
  const selectedClass = sinif || (classes[0] ? `${classes[0].grade}-${classes[0].section}` : "");
  const [grade, section] = selectedClass.includes("-")
    ? [selectedClass.slice(0, selectedClass.indexOf("-")), selectedClass.slice(selectedClass.indexOf("-") + 1)]
    : ["", ""];
  const report =
    ctx.institution && selectedSittingId && grade && section
      ? ctx.store.listClassReportCards(ctx.session, ctx.institution.id, {
          sittingId: selectedSittingId,
          grade,
          section,
        })
      : null;

  return (
    <AppShell
      user={ctx.session}
      institution={ctx.institution}
      modules={ctx.modules}
      institutions={ctx.allInstitutions}
      canViewNetwork={ctx.canViewNetwork}
    >
      <ClassReportCardsScreen
        institution={ctx.institution}
        sittings={sittings}
        classes={classes}
        selectedSittingId={selectedSittingId}
        selectedClass={selectedClass}
        report={report}
      />
    </AppShell>
  );
}
