import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/store/server";
import { buildStudentAveragesWorkbook, reportFileName } from "@/lib/rapor/excel";
import type { AnalysisFilters, ExamType, ExamArea } from "@/lib/domain";
import { AppError, ErrorCodes } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const store = await getStore();
    const report = store.buildStudentAveragesReport(session, {
      scope: url.searchParams.get("kapsam"),
      institutionId: url.searchParams.get("kurum"),
      filters: {
        academicYearId: url.searchParams.get("yil") ?? undefined,
        examType: (url.searchParams.get("tur") as ExamType) || undefined,
        examSittingId: url.searchParams.get("sinav") ?? undefined,
        scoreTrack: (url.searchParams.get("puan") as AnalysisFilters["scoreTrack"]) || undefined,
        examArea: (url.searchParams.get("alan") as ExamArea) || undefined,
        dateFrom: url.searchParams.get("baslangic") ?? undefined,
        city: url.searchParams.get("il") ?? undefined,
        district: url.searchParams.get("ilce") ?? undefined,
      },
    });
    if (!report.students.length && !report.summaries.some((row) => row.participants)) {
      throw new AppError(ErrorCodes.NOT_FOUND, "Bu kapsamda indirilecek sınav sonucu yok.", 404);
    }
    const buffer = await buildStudentAveragesWorkbook(report);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${reportFileName(report)}"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
