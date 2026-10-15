import type { AnalysisFilters, ExamSitting, ExamType } from "@/lib/domain";

export function sittingsOfOneExamType(
  sittings: ExamSitting[],
  filters: AnalysisFilters,
  fallbackExamType?: ExamType | null,
): { examType: ExamType | null; sittings: ExamSitting[] } {
  if (!sittings.length) return { examType: fallbackExamType ?? null, sittings: [] };
  let examType: ExamType | null = filters.examType ?? null;
  if (!examType && filters.examSittingId) {
    examType = sittings.find((s) => s.id === filters.examSittingId)?.examType ?? null;
  }
  if (!examType) {
    examType =
      [...sittings].sort((a, b) => a.examDate.localeCompare(b.examDate)).at(-1)?.examType ?? null;
  }
  if (!examType && fallbackExamType) examType = fallbackExamType;
  return {
    examType,
    sittings: examType ? sittings.filter((s) => s.examType === examType) : [],
  };
}
