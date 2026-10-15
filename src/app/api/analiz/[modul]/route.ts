import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/store/server";
import { resolveInstitutionId } from "@/lib/store/app-store";
import type { AnalysisFilters, ExamType } from "@/lib/domain";

export async function GET(
  request: Request,
  context: { params: Promise<{ modul: string }> },
) {
  try {
    const session = await requireSession();
    const { modul } = await context.params;
    const url = new URL(request.url);
    const store = await getStore();
    const institutionId = resolveInstitutionId(session, url.searchParams.get("kurum"));
    const filters: AnalysisFilters = {
      academicYearId: url.searchParams.get("yil") || undefined,
      examType: (url.searchParams.get("tur") as ExamType) || undefined,
      examSittingId: url.searchParams.get("sinav") || undefined,
      scoreTrack: (url.searchParams.get("puan") as AnalysisFilters["scoreTrack"]) || undefined,
      dateFrom: url.searchParams.get("baslangic") || undefined,
      dateTo: url.searchParams.get("bitis") || undefined,
      grade: url.searchParams.get("sinif") || undefined,
      section: url.searchParams.get("sube") || undefined,
      subjectCode: url.searchParams.get("ders") || undefined,
      studentId: url.searchParams.get("ogrenci") || undefined,
    };
    const data = store.getAnalysis(session, institutionId, modul, filters);
    return Response.json(data);
  } catch (error) {
    return jsonError(error);
  }
}
