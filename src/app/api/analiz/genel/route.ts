import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/store/server";
import type { AnalysisFilters, ExamType } from "@/lib/domain";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const store = await getStore();
    const filters: AnalysisFilters = {
      academicYearId: url.searchParams.get("yil") || undefined,
      examType: (url.searchParams.get("tur") as ExamType) || undefined,
      examSittingId: url.searchParams.get("sinav") || undefined,
      scoreTrack: (url.searchParams.get("puan") as AnalysisFilters["scoreTrack"]) || undefined,
      dateFrom: url.searchParams.get("baslangic") || undefined,
      dateTo: url.searchParams.get("bitis") || undefined,
      city: url.searchParams.get("il") || undefined,
    };
    const data = store.getNetworkAnalysis(session, filters);
    return Response.json(data);
  } catch (error) {
    return jsonError(error);
  }
}
