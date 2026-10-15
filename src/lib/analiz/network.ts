import { SUBJECTS_BY_EXAM, classKeyOf, placesEqual, type AnalysisFilters, type ExamResult, type ExamSitting, type ExamType, type Institution } from "@/lib/domain";
import type { AppState } from "@/lib/store/app-store";
import { sittingsOfOneExamType } from "@/lib/analiz/exam-scope";
import { buildProvinceEvaluation, type ProvinceEvaluation } from "@/lib/analiz/evaluation";
import { computeQuestionAnalysis, parseScoreTrack, avgTrackScore, type QuestionAnalysisPayload } from "@/lib/analiz/compute";

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

export type NetworkSchoolRow = {
  id: string;
  name: string;
  code: string;
  city: string;
  district: string;
  type: Institution["type"];
  types: Institution["types"];
  participants: number;
  avgNet: number | null;
  avgScore: number | null;
  examName: string;
  examType: ExamSitting["examType"] | null;
  examDate: string;
};

export type NetworkSchoolRef = {
  id: string;
  name: string;
  avgNet: number | null;
};

export type NetworkSubjectRow = {
  code: string;
  name: string;
  avgNet: number | null;
  avgCorrect: number | null;
  avgWrong: number | null;
  avgBlank: number | null;
  participants: number;
  schoolCount: number;
  strongestSchool: NetworkSchoolRef | null;
  weakestSchool: NetworkSchoolRef | null;
};

export type NetworkSectionRow = {
  institutionId: string;
  schoolName: string;
  schoolCode: string;
  city: string;
  district: string;
  grade: string;
  section: string;
  count: number;
  avgNet: number | null;
  avgScore: number | null;
};

export type NetworkClassRow = {
  institutionId: string;
  schoolName: string;
  city: string;
  district: string;
  grade: string;
  count: number;
  avgNet: number | null;
  avgScore: number | null;
};

export type NetworkSchoolProgress = {
  id: string;
  name: string;
  avgNet: number | null;
  previousAvgNet: number | null;
  delta: number | null;
};

export type NetworkAnalysisPayload = {
  empty: boolean;
  scope: "all-schools" | "district-schools";
  examType: ExamType | null;
  lastTotals: {
    schoolCount: number;
    cityCount: number;
    districtCount: number;
    participants: number;
    averageNet: number | null;
    averageScore: number | null;
    averageCorrect: number | null;
    averageWrong: number | null;
    averageBlank: number | null;
  };
  schools: NetworkSchoolRow[];
  cities: Array<{
    city: string;
    schoolCount: number;
    participants: number;
    avgNet: number | null;
    avgScore: number | null;
  }>;
  districts: Array<{
    city: string;
    district: string;
    schoolCount: number;
    participants: number;
    avgNet: number | null;
  }>;
  yearTrend: Array<{
    examName: string;
    date: string;
    examType: string;
    avgNet: number | null;
    participants: number;
    schoolCount: number;
  }>;
  subjects: NetworkSubjectRow[];
  sections: NetworkSectionRow[];
  classes: NetworkClassRow[];
  evaluation: ProvinceEvaluation | null;
  schoolProgress: NetworkSchoolProgress[];
  questionAnalysis: QuestionAnalysisPayload | null;
};

function emptyPayload(examType: ExamType | null): NetworkAnalysisPayload {
  return {
    empty: true,
    scope: "all-schools",
    examType,
    lastTotals: {
      schoolCount: 0,
      cityCount: 0,
      districtCount: 0,
      participants: 0,
      averageNet: null,
      averageScore: null,
      averageCorrect: null,
      averageWrong: null,
      averageBlank: null,
    },
    schools: [],
    cities: [],
    districts: [],
    yearTrend: [],
    subjects: [],
    sections: [],
    classes: [],
    evaluation: null,
    schoolProgress: [],
    questionAnalysis: {
      hasAnswers: false,
      cancelledCount: 0,
      participantCount: 0,
      sittingName: "",
      subjects: [],
    },
  };
}

function matchingSittings(
  state: AppState,
  filters: AnalysisFilters,
): { examType: ExamType | null; sittings: ExamSitting[] } {
  let sittings = state.sittings.slice();
  if (filters.academicYearId) {
    sittings = sittings.filter((s) => s.academicYearId === filters.academicYearId);
  }
  if (filters.dateFrom) sittings = sittings.filter((s) => s.examDate >= filters.dateFrom!);
  if (filters.dateTo) sittings = sittings.filter((s) => s.examDate <= filters.dateTo!);
  return sittingsOfOneExamType(sittings, filters);
}

function latestResultsForInstitution(
  results: ExamResult[],
  sittingsById: Map<string, ExamSitting>,
  institutionId: string,
  pinnedSittingId?: string,
): ExamResult[] {
  const instResults = results.filter((r) => r.institutionId === institutionId);
  if (pinnedSittingId) {
    return instResults.filter((r) => r.examSittingId === pinnedSittingId);
  }
  if (!instResults.length) return [];
  const latestDate = instResults
    .map((r) => sittingsById.get(r.examSittingId)?.examDate ?? "")
    .sort()
    .at(-1);
  return instResults.filter(
    (r) => sittingsById.get(r.examSittingId)?.examDate === latestDate,
  );
}

export function computeNetworkAnalysis(
  state: AppState,
  filters: AnalysisFilters,
): NetworkAnalysisPayload {
  const institutions = state.institutions.filter((inst) => {
    if (filters.city && !placesEqual(inst.city, filters.city)) return false;
    if (filters.district && !placesEqual(inst.district, filters.district)) return false;
    return true;
  });
  const { examType, sittings } = matchingSittings(state, filters);
  const track = examType === "AYT" ? parseScoreTrack(filters.scoreTrack) : "genel";
  const sittingIds = new Set(sittings.map((s) => s.id));
  const sittingsById = new Map(sittings.map((s) => [s.id, s]));
  const instIds = new Set(institutions.map((i) => i.id));
  let results = state.results.filter(
    (r) => instIds.has(r.institutionId) && sittingIds.has(r.examSittingId),
  );
  if (filters.examArea) {
    results = results.filter((r) => r.examArea === filters.examArea);
  }

  const schools: NetworkSchoolRow[] = institutions
    .map((inst) => {
      const rows = latestResultsForInstitution(
        results,
        sittingsById,
        inst.id,
        filters.examSittingId,
      );
      if (!rows.length) return null;
      const sitting = sittingsById.get(rows[0].examSittingId);
      return {
        id: inst.id,
        name: inst.name,
        code: inst.code,
        city: inst.city,
        district: inst.district,
        type: inst.type,
        types: inst.types,
        participants: rows.length,
        avgNet: avg(rows.map((r) => r.calculatedNet)),
        avgScore: avgTrackScore(rows, track),
        examName: sitting?.name ?? "",
        examType: sitting?.examType ?? null,
        examDate: sitting?.examDate ?? "",
      };
    })
    .filter((row): row is NetworkSchoolRow => row != null)
    .sort((a, b) => (b.avgNet ?? -Infinity) - (a.avgNet ?? -Infinity));

  if (!schools.length) return emptyPayload(examType);

  const latestBySchool = new Map<string, ExamResult[]>();
  for (const school of schools) {
    latestBySchool.set(
      school.id,
      latestResultsForInstitution(results, sittingsById, school.id, filters.examSittingId),
    );
  }
  const allLatest = [...latestBySchool.values()].flat();

  const cityMap = new Map<string, ExamResult[]>();
  const districtMap = new Map<string, ExamResult[]>();
  for (const row of allLatest) {
    const inst = institutions.find((i) => i.id === row.institutionId);
    if (!inst) continue;
    cityMap.set(inst.city, [...(cityMap.get(inst.city) ?? []), row]);
    const dkey = `${inst.city}||${inst.district}`;
    districtMap.set(dkey, [...(districtMap.get(dkey) ?? []), row]);
  }

  const cities = [...cityMap.entries()]
    .map(([city, rows]) => ({
      city,
      schoolCount: new Set(rows.map((r) => r.institutionId)).size,
      participants: rows.length,
      avgNet: avg(rows.map((r) => r.calculatedNet)),
      avgScore: avgTrackScore(rows, track),
    }))
    .sort((a, b) => (b.avgNet ?? -Infinity) - (a.avgNet ?? -Infinity));

  const districts = [...districtMap.entries()]
    .map(([key, rows]) => {
      const [city, district] = key.split("||");
      return {
        city,
        district,
        schoolCount: new Set(rows.map((r) => r.institutionId)).size,
        participants: rows.length,
        avgNet: avg(rows.map((r) => r.calculatedNet)),
      };
    })
    .sort((a, b) => (b.avgNet ?? -Infinity) - (a.avgNet ?? -Infinity));

  const orderedSittings = [...sittings].sort((a, b) => a.examDate.localeCompare(b.examDate));
  const yearTrend = orderedSittings
    .map((sitting) => {
      const rows = results.filter((r) => r.examSittingId === sitting.id);
      if (!rows.length) return null;
      return {
        examName: sitting.name,
        date: sitting.examDate,
        examType: sitting.examType,
        avgNet: avg(rows.map((r) => r.calculatedNet)),
        participants: rows.length,
        schoolCount: new Set(rows.map((r) => r.institutionId)).size,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const studentsById = new Map(state.students.map((student) => [student.id, student]));
  const latestIds = new Set(allLatest.map((row) => row.id));
  const resultSchool = new Map(allLatest.map((row) => [row.id, row.institutionId]));
  const subjectDefs = examType ? SUBJECTS_BY_EXAM[examType] : [];

  const subjects: NetworkSubjectRow[] = subjectDefs.map((def) => {
    const rows = state.subjectResults.filter(
      (sr) => latestIds.has(sr.resultId) && sr.subjectCode === def.code,
    );
    const schoolAverages = schools
      .map((school) => {
        const schoolResultIds = new Set((latestBySchool.get(school.id) ?? []).map((r) => r.id));
        const schoolRows = rows.filter((sr) => schoolResultIds.has(sr.resultId));
        return {
          id: school.id,
          name: school.name,
          avgNet: avg(schoolRows.map((r) => r.calculatedNet)),
        };
      })
      .filter((row) => row.avgNet != null)
      .sort((a, b) => (b.avgNet ?? -Infinity) - (a.avgNet ?? -Infinity));
    return {
      code: def.code,
      name: def.name,
      avgNet: avg(rows.map((r) => r.calculatedNet)),
      avgCorrect: avg(rows.map((r) => r.correct)),
      avgWrong: avg(rows.map((r) => r.wrong)),
      avgBlank: avg(rows.map((r) => r.blank)),
      participants: rows.length,
      schoolCount: new Set(rows.map((sr) => resultSchool.get(sr.resultId)).filter(Boolean)).size,
      strongestSchool: schoolAverages[0] ?? null,
      weakestSchool: schoolAverages.at(-1) ?? null,
    };
  });

  const sectionMap = new Map<string, ExamResult[]>();
  const classMap = new Map<string, ExamResult[]>();
  for (const result of allLatest) {
    const student = studentsById.get(result.studentId);
    const inst = institutions.find((item) => item.id === result.institutionId);
    if (!student || !inst) continue;
    const placement = classKeyOf(student);
    const sectionKey = `${inst.id}||${placement.grade}||${placement.section}`;
    const classKey = `${inst.id}||${placement.grade}`;
    sectionMap.set(sectionKey, [...(sectionMap.get(sectionKey) ?? []), result]);
    classMap.set(classKey, [...(classMap.get(classKey) ?? []), result]);
  }

  const sections: NetworkSectionRow[] = [...sectionMap.entries()]
    .map(([key, rows]) => {
      const [institutionId, grade, section] = key.split("||");
      const inst = institutions.find((item) => item.id === institutionId);
      return {
        institutionId,
        schoolName: inst?.name ?? "",
        schoolCode: inst?.code ?? "",
        city: inst?.city ?? "",
        district: inst?.district ?? "",
        grade,
        section,
        count: rows.length,
        avgNet: avg(rows.map((r) => r.calculatedNet)),
        avgScore: avgTrackScore(rows, track),
      };
    })
    .sort((a, b) => (b.avgNet ?? -Infinity) - (a.avgNet ?? -Infinity));

  const classes: NetworkClassRow[] = [...classMap.entries()]
    .map(([key, rows]) => {
      const [institutionId, grade] = key.split("||");
      const inst = institutions.find((item) => item.id === institutionId);
      return {
        institutionId,
        schoolName: inst?.name ?? "",
        city: inst?.city ?? "",
        district: inst?.district ?? "",
        grade,
        count: rows.length,
        avgNet: avg(rows.map((r) => r.calculatedNet)),
        avgScore: avgTrackScore(rows, track),
      };
    })
    .sort((a, b) => (b.avgNet ?? -Infinity) - (a.avgNet ?? -Infinity));

  const currentIndex = filters.examSittingId
    ? orderedSittings.findIndex((sitting) => sitting.id === filters.examSittingId)
    : orderedSittings.length - 1;
  const prevSitting = currentIndex > 0 ? orderedSittings[currentIndex - 1] : null;

  const schoolProgress: NetworkSchoolProgress[] = schools.map((school) => {
    const prevRows = prevSitting
      ? results.filter((row) => row.institutionId === school.id && row.examSittingId === prevSitting.id)
      : [];
    const previousAvgNet = avg(prevRows.map((row) => row.calculatedNet));
    const delta =
      school.avgNet != null && previousAvgNet != null
        ? Math.round((school.avgNet - previousAvgNet) * 100) / 100
        : null;
    return {
      id: school.id,
      name: school.name,
      avgNet: school.avgNet,
      previousAvgNet,
      delta,
    };
  });

  const lastTotals = {
    schoolCount: schools.length,
    cityCount: cities.length,
    districtCount: districts.length,
    participants: allLatest.length,
    averageNet: avg(allLatest.map((r) => r.calculatedNet)),
    averageScore: avgTrackScore(allLatest, track),
    averageCorrect: avg(allLatest.map((r) => r.totalCorrect)),
    averageWrong: avg(allLatest.map((r) => r.totalWrong)),
    averageBlank: avg(allLatest.map((r) => r.totalBlank)),
  };

  const evaluation = buildProvinceEvaluation({
    provinceAvgNet: lastTotals.averageNet,
    previousAvgNet: yearTrend.length >= 2 ? (yearTrend.at(-2)?.avgNet ?? null) : null,
    studentNets: allLatest.map((row) => row.calculatedNet),
    subjects: subjects.map((row) => ({ code: row.code, name: row.name, avgNet: row.avgNet })),
    schools: schools.map((row) => ({ id: row.id, name: row.name, avgNet: row.avgNet })),
  });

  const questionSitting =
    (filters.examSittingId ? sittingsById.get(filters.examSittingId) : null) ??
    [...allLatest]
      .map((row) => sittingsById.get(row.examSittingId))
      .filter((sitting): sitting is ExamSitting => Boolean(sitting))
      .sort((a, b) => a.examDate.localeCompare(b.examDate) || a.id.localeCompare(b.id))
      .at(-1) ??
    null;
  const questionResults = questionSitting
    ? allLatest.filter((row) => row.examSittingId === questionSitting.id)
    : [];
  const questionAnalysis = computeQuestionAnalysis(
    questionSitting,
    questionResults,
    state,
    filters.subjectCode,
  );

  return {
    empty: false,
    scope: filters.district ? "district-schools" : "all-schools",
    examType,
    lastTotals,
    schools,
    cities,
    districts,
    yearTrend,
    subjects,
    sections,
    classes,
    evaluation,
    schoolProgress,
    questionAnalysis,
  };
}
