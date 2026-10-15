import { AppError } from "@/lib/errors";
import { ANALYSIS_MODULES, IL_ANALIZI_SLUG, SUBJECTS_BY_EXAM, panelPath, preferredAcademicYear, type AnalysisFilters, type ExamType } from "@/lib/domain";
import { loadPanelContext } from "@/lib/panel";
import { AppShell } from "@/components/app-shell";
import { AnalysisView } from "@/components/analysis-view";
import { AnalysisFilters as FilterBar } from "@/components/analysis-filters";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ReportDownloadButton } from "@/components/report-download-button";

function parseFilters(sp: Record<string, string | undefined>): AnalysisFilters {
  return {
    academicYearId: sp.yil,
    examType: (sp.tur as ExamType) || undefined,
    examSittingId: sp.sinav,
    scoreTrack: (sp.puan as AnalysisFilters["scoreTrack"]) || undefined,
    examArea: (sp.alan as AnalysisFilters["examArea"]) || undefined,
    dateFrom: sp.baslangic,
    dateTo: sp.bitis,
    grade: sp.sinif,
    section: sp.sube,
    subjectCode: sp.ders,
    studentId: sp.ogrenci,
  };
}

export async function PanelModuleScreen({
  searchParams,
  moduleSlug,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  moduleSlug: string;
}) {
  if (moduleSlug === IL_ANALIZI_SLUG) redirect("/il-analizi");
  const raw = await searchParams;
  const sp = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  ) as Record<string, string | undefined>;
  const ctx = await loadPanelContext(sp.kurum);
  if (!ctx.institution) {
    if (ctx.session.role === "system_admin" || ctx.session.role === "district_admin") {
      return (
        <AppShell
          user={ctx.session}
          institution={null}
          modules={[]}
          institutions={ctx.allInstitutions}
        canViewNetwork={ctx.canViewNetwork}
        >
          <Card>
            <CardHeader>
              <CardTitle>Okul paneli için okul seçin</CardTitle>
              <CardDescription>
                İlin akademik durumunu ders, okul, sınıf ve şube kırılımıyla görmek için il
                analizini kullanın. Tek okulu tüm analizleriyle incelemek için okul seçin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <a
                className="inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                href="/il-analizi"
              >
                İl analizine git
              </a>
            <div className="grid gap-2 sm:grid-cols-2">
              {ctx.allInstitutions.map((inst) => (
                <a
                  key={inst.id}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
                  href={panelPath("okul-ozeti", inst.id)}
                >
                  <span className="font-medium">{inst.name}</span>
                  <span className="block text-xs text-muted-foreground font-mono">{inst.code}</span>
                </a>
              ))}
            </div>
            </CardContent>
          </Card>
        </AppShell>
      );
    }
    return (
      <AppShell user={ctx.session} institution={null} modules={[]} canViewNetwork={ctx.canViewNetwork}>
        <p>Kullanıcıya bağlı kurum yok.</p>
      </AppShell>
    );
  }

  if (ctx.modules.length === 0) {
    return (
      <AppShell
        user={ctx.session}
        institution={ctx.institution}
        modules={[]}
        institutions={ctx.allInstitutions}
        canViewNetwork={ctx.canViewNetwork}
      >
        <Card>
          <CardHeader>
            <CardTitle>Kurumunuz için henüz bir analiz modülü açılmadı</CardTitle>
            <CardDescription>
              Sistem yöneticisi analiz yetkilerini açtığında menü ve özet burada görünecek.
            </CardDescription>
          </CardHeader>
        </Card>
      </AppShell>
    );
  }

  const allowed = ctx.modules.some((m) => m.slug === moduleSlug);
  if (!allowed) {
    return (
      <AppShell
        user={ctx.session}
        institution={ctx.institution}
        modules={ctx.modules}
        institutions={ctx.allInstitutions}
        canViewNetwork={ctx.canViewNetwork}
      >
        <Alert variant="destructive">
          <AlertTitle>Bu analiz modülü kapalı</AlertTitle>
          <AlertDescription>
            {ANALYSIS_MODULES.find((m) => m.slug === moduleSlug)?.name ?? moduleSlug} kurumunuz
            için açılmamış. Doğrudan bağlantı ile erişim de reddedilir.
          </AlertDescription>
        </Alert>
      </AppShell>
    );
  }

  const filters = parseFilters(sp);
  if (!filters.academicYearId) {
    filters.academicYearId = preferredAcademicYear(ctx.store.listAcademicYears())?.id;
  }
  const options = ctx.store.listFilterOptions(ctx.session, ctx.institution.id);
  const allowedExamTypes = ctx.institution.examTypePermissions.length
    ? ctx.institution.examTypePermissions
    : (["LGS"] as ExamType[]);
  const sittingType = filters.examSittingId
    ? options.sittings.find((s) => s.id === filters.examSittingId)?.examType
    : undefined;
  const latestType = [...options.sittings].sort((a, b) => a.examDate.localeCompare(b.examDate)).at(-1)
    ?.examType;
  const examType = (filters.examType ?? sittingType ?? latestType ?? allowedExamTypes[0]) as ExamType;
  filters.examType = examType;
  const subjects = SUBJECTS_BY_EXAM[examType] ?? [];

  let data: Record<string, unknown> = { empty: true };
  try {
    data = ctx.store.getAnalysis(ctx.session, ctx.institution.id, moduleSlug, filters);
  } catch (error) {
    if (error instanceof AppError) {
      return (
        <AppShell
          user={ctx.session}
          institution={ctx.institution}
          modules={ctx.modules}
          institutions={ctx.allInstitutions}
        canViewNetwork={ctx.canViewNetwork}
        >
          <Alert variant="destructive">
            <AlertTitle>Erişim reddedildi</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </AppShell>
      );
    }
    throw error;
  }

  return (
    <AppShell
      user={ctx.session}
      institution={ctx.institution}
      modules={ctx.modules}
      institutions={ctx.allInstitutions}
      canViewNetwork={ctx.canViewNetwork}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Seçili süreç değerlendirmenin öğrenci ortalamaları, il / ilçe / okul sırası ve ders netleriyle Excel
            raporu.
          </p>
          <Suspense fallback={null}>
            <ReportDownloadButton scope="okul" institutionId={ctx.institution.id} />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <FilterBar
            years={options.years}
            sittings={options.sittings}
            grades={options.grades}
            sections={options.sections}
            students={options.students}
            subjects={subjects}
            allowedExamTypes={allowedExamTypes}
            defaultExamType={examType}
            moduleSlug={moduleSlug}
            canManageYears={ctx.session.role === "system_admin"}
          />
        </Suspense>
        <AnalysisView
          data={{ ...data, openModules: ctx.modules }}
          moduleSlug={moduleSlug}
          institutionId={ctx.institution.id}
          canUpload={ctx.session.role === "system_admin"}
          scoreTrack={examType === "AYT" ? filters.scoreTrack : undefined}
        />
      </div>
    </AppShell>
  );
}
