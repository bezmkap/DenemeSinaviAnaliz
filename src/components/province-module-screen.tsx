import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { loadPanelContext, requireUser } from "@/lib/panel";
import { getStore, persistStore } from "@/lib/store/server";
import { AppShell } from "@/components/app-shell";
import { NetworkAnalysisView } from "@/components/network-analysis-view";
import { NetworkFilters } from "@/components/network-filters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEFAULT_IL_MODULE,
  IL_ANALYSIS_MODULES,
  SUBJECTS_BY_EXAM,
  preferredAcademicYear,
  type AnalysisFilters,
  type ExamType,
} from "@/lib/domain";
import { ReportDownloadButton } from "@/components/report-download-button";
import { reportScopeForSession } from "@/lib/rapor/student-averages";

export async function ProvinceModuleScreen({
  searchParams,
  moduleSlug,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  moduleSlug: string;
}) {
  const allowed = IL_ANALYSIS_MODULES.some((row) => row.slug === moduleSlug);
  if (!allowed) redirect("/il-analizi");

  const session = await requireUser();
  const store = await getStore();
  if (!store.canViewNetworkAnalysis(session)) redirect("/panel");

  const ctx =
    session.role === "school_user"
      ? await loadPanelContext()
      : {
          session,
          institution: null,
          modules: [],
          allInstitutions: store.listInstitutions(session),
          canViewNetwork: true,
        };

  const raw = await searchParams;
  const sp = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  ) as Record<string, string | undefined>;

  const districtUsers =
    session.role === "system_admin" ? store.listDistrictUsers(session) : [];
  if (store.hasPendingSave()) await persistStore();

  const options = store.listNetworkFilterOptions(session);
  const sittingType = sp.sinav
    ? options.sittings.find((s) => s.id === sp.sinav)?.examType
    : undefined;
  const defaultExamType =
    sittingType ??
    [...options.sittings].sort((a, b) => a.examDate.localeCompare(b.examDate)).at(-1)?.examType ??
    "LGS";
  const filters: AnalysisFilters = {
    academicYearId: sp.yil || preferredAcademicYear(options.years)?.id,
    examType: (sp.tur as ExamType) || defaultExamType,
    examSittingId: sp.sinav || undefined,
    scoreTrack: (sp.puan as AnalysisFilters["scoreTrack"]) || undefined,
    examArea: (sp.alan as AnalysisFilters["examArea"]) || undefined,
    dateFrom: sp.baslangic || undefined,
    city: session.role === "district_admin" ? session.city || undefined : sp.il || undefined,
    district: session.role === "district_admin" ? session.district || undefined : sp.ilce || undefined,
    subjectCode: moduleSlug === "soru" ? sp.ders || undefined : undefined,
  };
  const data = store.getNetworkAnalysis(session, filters);

  return (
    <AppShell
      user={session}
      institution={ctx.institution}
      modules={ctx.modules}
      institutions={
        session.role === "system_admin" || session.role === "district_admin"
          ? ctx.allInstitutions
          : []
      }
      networkScope
      canViewNetwork
    >
      <div className="space-y-6">
        {session.role === "system_admin" ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle>İlçe kullanıcıları</CardTitle>
              <CardDescription>
                {districtUsers.length
                  ? `${districtUsers.length} ilçe hesabı hazır. Her ilçe yalnızca kendi okullarını görür.`
                  : "Kayıtlı okulların ilçeleri için henüz hesap yok."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {districtUsers.length ? (
                <ul className="grid gap-2 text-sm sm:grid-cols-2">
                  {districtUsers.map((user) => (
                    <li key={user.id} className="rounded-lg border bg-background px-3 py-2">
                      <p className="font-medium">
                        {user.district} / {user.city}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{user.email}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Link
                href="/yonetim/ilce-kullanicilari"
                className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
              >
                İlçe hesaplarını aç
              </Link>
            </CardContent>
          </Card>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {session.role === "district_admin"
              ? "İlçe genelindeki öğrenci, okul ve ders netleri Excel raporu."
              : "Seçili il veya ilçenin öğrenci ortalamaları Excel raporu."}
          </p>
          <Suspense fallback={null}>
            <div className="flex flex-wrap gap-2">
              {session.role === "system_admin" ? (
                <>
                  <ReportDownloadButton scope="il" />
                  {sp.ilce || filters.district ? <ReportDownloadButton scope="ilce" /> : null}
                </>
              ) : (
                <ReportDownloadButton
                  scope={reportScopeForSession(session.role)}
                  institutionId={ctx.institution?.id}
                />
              )}
            </div>
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <NetworkFilters
            years={options.years}
            sittings={options.sittings}
            cities={options.cities}
            districts={
              filters.city
                ? options.districts.filter((district) =>
                    ctx.allInstitutions.some(
                      (inst) => inst.district === district && inst.city === filters.city,
                    ),
                  )
                : options.districts
            }
            defaultExamType={filters.examType ?? defaultExamType}
            lockedPlace={
              session.role === "district_admin"
                ? { city: session.city ?? "", district: session.district ?? "" }
                : null
            }
            moduleSlug={moduleSlug}
            subjects={SUBJECTS_BY_EXAM[filters.examType ?? defaultExamType] ?? []}
            canManageYears={session.role === "system_admin"}
          />
        </Suspense>
        <NetworkAnalysisView
          data={data}
          moduleSlug={moduleSlug || DEFAULT_IL_MODULE}
          viewerRole={session.role}
          viewerInstitutionId={ctx.institution?.id ?? null}
        />
      </div>
    </AppShell>
  );
}
