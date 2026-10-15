import {
  SUBJECTS_BY_EXAM,
  institutionInDistrict,
  placesEqual,
  subjectNetsFromResults,
  type AnalysisFilters,
  type ExamSitting,
  type ExamType,
  type SubjectDef,
  EXAM_AREA_LABELS,
} from "@/lib/domain";
import type { AppState } from "@/lib/store/app-store";
import { sittingsOfOneExamType } from "@/lib/analiz/exam-scope";
import { parseScoreTrack, scoreOfTrack, scoreTrackLabel, type KarneRankTrack } from "@/lib/analiz/compute";

export type ReportScope = "okul" | "ilce" | "il";

export type ReportStudentRow = {
  schoolRank: number;
  cityRank: number;
  districtRank: number;
  grade: string;
  section: string;
  studentNo: string;
  name: string;
  schoolName: string;
  city: string;
  district: string;
  score: number | null;
  totalNet: number;
  nets: Record<string, number>;
};

export type ReportGroupRow = {
  label: string;
  participants: number;
  placeRank: number | null;
  avgScore: number | null;
  avgTotalNet: number | null;
  avgNets: Record<string, number | null>;
};

export type StudentAveragesReport = {
  scope: ReportScope;
  examType: ExamType;
  examName: string;
  examDate: string;
  gradeLabel: string;
  title: string;
  subtitle: string;
  scoreTrack: KarneRankTrack;
  scoreTrackLabel: string;
  subjects: SubjectDef[];
  summaries: ReportGroupRow[];
  schools: ReportGroupRow[];
  districts: ReportGroupRow[];
  students: ReportStudentRow[];
};

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

function standing(score: number | null | undefined): number {
  return score ?? Number.NEGATIVE_INFINITY;
}

function rankByScore<T extends { score: number | null | undefined }>(
  peers: T[],
  score: number | null | undefined,
): number {
  const value = standing(score);
  return peers.filter((row) => standing(row.score) > value).length + 1;
}

function normalizeExamLabel(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

function sameExam(left: ExamSitting, right: ExamSitting): boolean {
  if (left.examType !== right.examType) return false;
  const leftCode = normalizeExamLabel(left.examCode ?? "");
  const rightCode = normalizeExamLabel(right.examCode ?? "");
  if (leftCode && rightCode && leftCode === rightCode) return true;
  return (
    left.examDate === right.examDate &&
    normalizeExamLabel(left.name) === normalizeExamLabel(right.name)
  );
}

function filledNetCount(nets: Record<string, number>): number {
  return Object.values(nets).filter((value) => value != null).length;
}

function preferStudentRow<T extends { score: number | null; totalNet: number; nets: Record<string, number> }>(
  current: T,
  candidate: T,
): T {
  if ((candidate.score != null) !== (current.score != null)) {
    return candidate.score != null ? candidate : current;
  }
  const candidateNets = filledNetCount(candidate.nets);
  const currentNets = filledNetCount(current.nets);
  if (candidateNets !== currentNets) return candidateNets > currentNets ? candidate : current;
  if (candidate.totalNet !== current.totalNet) return candidate.totalNet > current.totalNet ? candidate : current;
  return current;
}

function groupAverages(
  label: string,
  rows: Array<{ score: number | null; totalNet: number; nets: Record<string, number> }>,
  subjects: SubjectDef[],
  placeRank: number | null,
): ReportGroupRow {
  return {
    label,
    participants: rows.length,
    placeRank,
    avgScore: avg(rows.filter((row) => row.score != null).map((row) => row.score as number)),
    avgTotalNet: avg(rows.map((row) => row.totalNet)),
    avgNets: Object.fromEntries(
      subjects.map((subject) => [
        subject.code,
        avg(rows.map((row) => row.nets[subject.code]).filter((value): value is number => value != null)),
      ]),
    ),
  };
}

export function computeStudentAveragesReport(
  state: AppState,
  input: {
    scope: ReportScope;
    institutionId?: string | null;
    city?: string | null;
    district?: string | null;
    filters: AnalysisFilters;
  },
): StudentAveragesReport {
  const focusInstitution = input.institutionId
    ? state.institutions.find((row) => row.id === input.institutionId)
    : undefined;
  const city = (input.city || focusInstitution?.city || "").trim();
  const district = (input.district || focusInstitution?.district || "").trim();

  let sittings = state.sittings.slice();
  if (input.filters.academicYearId) {
    sittings = sittings.filter((row) => row.academicYearId === input.filters.academicYearId);
  }
  if (input.filters.dateFrom) sittings = sittings.filter((row) => row.examDate >= input.filters.dateFrom!);
  const scoped = sittingsOfOneExamType(sittings, input.filters);
  sittings = scoped.sittings;
  const examType = scoped.examType ?? input.filters.examType ?? "LGS";
  const track = examType === "AYT" ? parseScoreTrack(input.filters.scoreTrack) : "genel";
  const trackLabel = examType === "AYT" ? scoreTrackLabel(track) : "";
  const ordered = [...sittings].sort((a, b) => a.examDate.localeCompare(b.examDate));
  const seed =
    (input.filters.examSittingId
      ? ordered.find((row) => row.id === input.filters.examSittingId)
      : null) ??
    ordered.at(-1);
  if (!seed) {
    return {
      scope: input.scope,
      examType,
      examName: "",
      examDate: "",
      gradeLabel: "",
      title: `${examType} öğrenci ortalamaları`,
      subtitle: "",
      scoreTrack: track,
      scoreTrackLabel: trackLabel,
      subjects: SUBJECTS_BY_EXAM[examType],
      summaries: [],
      schools: [],
      districts: [],
      students: [],
    };
  }
  const sittingIds = new Set(state.sittings.filter((row) => sameExam(row, seed)).map((row) => row.id));
  const subjects = SUBJECTS_BY_EXAM[seed.examType];
  const studentsById = new Map(state.students.map((row) => [row.id, row]));
  const instById = new Map(state.institutions.map((row) => [row.id, row]));

  const universe = state.results
    .filter((result) => sittingIds.has(result.examSittingId))
    .filter((result) => {
      // AYT için alan filtrelemesi
      if (examType === "AYT" && input.filters.examArea) {
        return result.examArea === input.filters.examArea;
      }
      return true;
    })
    .map((result) => {
      const student = studentsById.get(result.studentId);
      const institution = instById.get(result.institutionId);
      if (!student || !institution) return null;
      const nets = subjectNetsFromResults(
        state.subjectResults.filter((row) => row.resultId === result.id),
      );
      return {
        result,
        student,
        institution,
        score: scoreOfTrack(result, track),
        totalNet: result.calculatedNet,
        nets,
        city: institution.city,
        district: institution.district,
        schoolId: institution.id,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const byStudent = new Map<string, (typeof universe)[number]>();
  for (const row of universe) {
    const existing = byStudent.get(row.student.id);
    byStudent.set(row.student.id, existing ? preferStudentRow(existing, row) : row);
  }
  const uniqueUniverse = [...byStudent.values()];

  const cityPeers = city ? uniqueUniverse.filter((row) => placesEqual(row.city, city)) : uniqueUniverse;
  const districtPeers =
    city && district
      ? uniqueUniverse.filter(
          (row) => placesEqual(row.city, city) && placesEqual(row.district, district),
        )
      : [];
  const schoolPeers = focusInstitution
    ? uniqueUniverse.filter((row) => row.schoolId === focusInstitution.id)
    : [];

  const scopedRows =
    input.scope === "okul"
      ? schoolPeers
      : input.scope === "ilce"
        ? districtPeers
        : city
          ? cityPeers
          : universe;

  const students: ReportStudentRow[] = scopedRows
    .map((row) => ({
      schoolRank: rankByScore(
        uniqueUniverse.filter((item) => item.schoolId === row.schoolId),
        row.score,
      ),
      cityRank: rankByScore(
        uniqueUniverse.filter((item) => placesEqual(item.city, row.city)),
        row.score,
      ),
      districtRank: rankByScore(
        uniqueUniverse.filter(
          (item) => placesEqual(item.city, row.city) && placesEqual(item.district, row.district),
        ),
        row.score,
      ),
      grade: row.student.grade,
      section: row.student.section,
      studentNo: row.student.sourceStudentNo,
      name: row.student.fullName,
      schoolName: row.institution.name,
      city: row.institution.city,
      district: row.institution.district,
      score: row.score,
      totalNet: row.totalNet,
      nets: row.nets,
    }))
    .sort((a, b) => {
      const rank =
        input.scope === "okul"
          ? a.schoolRank - b.schoolRank
          : input.scope === "ilce"
            ? a.districtRank - b.districtRank
            : a.cityRank - b.cityRank;
      return rank || a.name.localeCompare(b.name, "tr");
    });

  const schoolGroups = new Map<string, typeof uniqueUniverse>();
  const districtGroups = new Map<string, typeof uniqueUniverse>();
  for (const row of (city ? cityPeers : uniqueUniverse)) {
    const schoolKey = row.schoolId;
    schoolGroups.set(schoolKey, [...(schoolGroups.get(schoolKey) ?? []), row]);
    const districtKey = `${row.city}|${row.district}`;
    districtGroups.set(districtKey, [...(districtGroups.get(districtKey) ?? []), row]);
  }

  const districtAverages = [...districtGroups.entries()].map(([key, rows]) => {
    const [groupCity, groupDistrict] = key.split("|");
    return {
      key,
      city: groupCity,
      district: groupDistrict,
      row: groupAverages(`${groupDistrict} / ${groupCity}`, rows, subjects, null),
      score: avg(rows.filter((item) => item.score != null).map((item) => item.score as number)),
    };
  });
  for (const item of districtAverages) {
    item.row.placeRank = rankByScore(
      districtAverages.filter((other) => placesEqual(other.city, item.city)),
      item.score,
    );
  }

  const schoolAverages = [...schoolGroups.entries()].map(([id, rows]) => {
    const institution = instById.get(id)!;
    return {
      id,
      city: institution.city,
      district: institution.district,
      row: groupAverages(institution.name, rows, subjects, null),
      score: avg(rows.filter((item) => item.score != null).map((item) => item.score as number)),
    };
  });
  for (const item of schoolAverages) {
    item.row.placeRank = rankByScore(
      schoolAverages.filter((other) => placesEqual(other.city, item.city)),
      item.score,
    );
  }

  const summaries: ReportGroupRow[] = [];
  if (city) {
    summaries.push(groupAverages(`${city.toLocaleUpperCase("tr-TR")} İLİ`, cityPeers, subjects, null));
  } else {
    summaries.push(groupAverages("TÜM İLLER", universe, subjects, null));
  }
  if (input.scope !== "il" && district) {
    const districtMeta = districtAverages.find(
      (item) => placesEqual(item.city, city) && placesEqual(item.district, district),
    );
    summaries.push(
      groupAverages(
        `${district.toLocaleUpperCase("tr-TR")} İLÇESİ`,
        districtPeers,
        subjects,
        districtMeta?.row.placeRank ?? null,
      ),
    );
  }
  if (input.scope === "okul" && focusInstitution) {
    const schoolMeta = schoolAverages.find((item) => item.id === focusInstitution.id);
    summaries.push(
      groupAverages("OKUL", schoolPeers, subjects, schoolMeta?.row.placeRank ?? null),
    );
  }

  const gradeCounts = new Map<string, number>();
  for (const row of students) {
    if (!row.grade) continue;
    gradeCounts.set(row.grade, (gradeCounts.get(row.grade) ?? 0) + 1);
  }
  const gradeLabel = [...gradeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  
  // Alan etiketi oluştur
  const areaLabel = input.filters.examArea 
    ? EXAM_AREA_LABELS[input.filters.examArea]
    : "";
  
  const subtitle =
    input.scope === "okul"
      ? focusInstitution?.name ?? "Okul"
      : input.scope === "ilce"
        ? `${district} İlçesi`
        : city
          ? `${city} İli`
          : "Tüm iller";

  return {
    scope: input.scope,
    examType: seed.examType,
    examName: seed.name,
    examDate: seed.examDate,
    gradeLabel,
    title: [gradeLabel ? `${gradeLabel}. SINIF` : "", seed.examType, seed.name, areaLabel, trackLabel]
      .filter(Boolean)
      .join(" ")
      .toLocaleUpperCase("tr-TR"),
    subtitle: `${subtitle} — Öğrenci ortalamaları`.toLocaleUpperCase("tr-TR"),
    scoreTrack: track,
    scoreTrackLabel: trackLabel,
    subjects,
    summaries,
    schools: schoolAverages
      .filter((item) => {
        if (input.scope === "okul") return item.id === focusInstitution?.id;
        if (input.scope === "ilce") {
          return placesEqual(item.city, city) && placesEqual(item.district, district);
        }
        return !city || placesEqual(item.city, city);
      })
      .sort((a, b) => (a.row.placeRank ?? 99) - (b.row.placeRank ?? 99))
      .map((item) => item.row),
    districts: districtAverages
      .filter((item) => input.scope === "il" && (!city || placesEqual(item.city, city)))
      .sort((a, b) => (a.row.placeRank ?? 99) - (b.row.placeRank ?? 99))
      .map((item) => item.row),
    students,
  };
}

export function reportScopeForSession(
  role: "system_admin" | "district_admin" | "school_user",
  queryScope?: string | null,
): ReportScope {
  if (role === "school_user") return "okul";
  if (role === "district_admin") return queryScope === "okul" ? "okul" : "ilce";
  if (queryScope === "okul" || queryScope === "ilce" || queryScope === "il") return queryScope;
  return "il";
}

export function institutionInReportScope(
  inst: { id: string; city: string; district: string },
  input: { city?: string | null; district?: string | null; institutionId?: string | null },
): boolean {
  if (input.institutionId) return inst.id === input.institutionId;
  if (input.city && input.district) return institutionInDistrict(inst, input.city, input.district);
  if (input.city) return placesEqual(inst.city, input.city);
  return true;
}
