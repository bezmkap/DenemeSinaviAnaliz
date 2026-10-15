import {
  ANALYSIS_MODULES,
  SUBJECTS_BY_EXAM,
  classKeyOf,
  clampPlacementScore,
  placesEqual,
  type AnalysisFilters,
  type ExamResult,
  type ExamSitting,
  type ExamType,
  type Student,
  type SubjectResult,
} from "@/lib/domain";
import type { AppState } from "@/lib/store/app-store";
import { sittingsOfOneExamType } from "@/lib/analiz/exam-scope";
import { buildSchoolEvaluation } from "@/lib/analiz/evaluation";
import {
  hasMappedQuestions,
  invertQuestionMap,
  isMissedQuestionStatus,
  normalizeAnswerString,
  questionStatus,
} from "@/lib/import/answers";

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

function standingScore(score: number | null | undefined): number {
  return score ?? Number.NEGATIVE_INFINITY;
}

function rankAmong(
  values: Array<number | null | undefined>,
  score: number | null | undefined,
): number {
  const value = standingScore(score);
  return values.filter((row) => standingScore(row) > value).length + 1;
}

function rankByScore<T extends { score: number | null | undefined }>(
  peers: T[],
  score: number | null | undefined,
): number {
  return rankAmong(
    peers.map((row) => row.score),
    score,
  );
}

export type KarneRankTrack = "genel" | "say" | "ea" | "soz";

export type KarneRankSet = {
  schoolRank: number | null;
  schoolCount: number | null;
  cityRank: number | null;
  cityCount: number | null;
  districtRank: number | null;
  districtCount: number | null;
};

export type KarneRankSets = Record<KarneRankTrack, KarneRankSet>;

export const AYT_RANK_TRACKS: Array<{ id: KarneRankTrack; label: string; hint: string }> = [
  { id: "soz", label: "Sözel", hint: "Sözel puana göre sıra" },
  { id: "say", label: "Sayısal", hint: "Sayısal puana göre sıra" },
  { id: "ea", label: "EA", hint: "Eşit ağırlık puanına göre sıra" },
  { id: "genel", label: "En yüksek", hint: "Üç puandan en yükseğine göre sıra" },
];

export type ScoreTrackRow = {
  score?: number | null;
  scoreSay?: number | null;
  scoreEa?: number | null;
  scoreSoz?: number | null;
};

export function parseScoreTrack(value: string | null | undefined): KarneRankTrack {
  if (value === "say" || value === "ea" || value === "soz" || value === "genel") return value;
  return "genel";
}

export function scoreOfTrack(row: ScoreTrackRow, track: KarneRankTrack): number | null {
  if (track === "say") return row.scoreSay ?? null;
  if (track === "ea") return row.scoreEa ?? null;
  if (track === "soz") return row.scoreSoz ?? null;
  return row.score ?? null;
}

export function scoreTrackLabel(track: KarneRankTrack): string {
  return AYT_RANK_TRACKS.find((tab) => tab.id === track)?.label ?? "En yüksek";
}

export function avgTrackScore(rows: ScoreTrackRow[], track: KarneRankTrack): number | null {
  const average = avg(
    rows.map((row) => scoreOfTrack(row, track)).filter((value): value is number => value != null),
  );
  return average != null ? clampPlacementScore(average) : null;
}

function ranksForField(
  peers: ExamResult[],
  cityPeers: ExamResult[],
  districtPeers: ExamResult[],
  result: ExamResult,
  field: "score" | "scoreSay" | "scoreEa" | "scoreSoz",
): KarneRankSet {
  return {
    schoolRank: peers.length ? rankAmong(peers.map((row) => row[field]), result[field]) : null,
    schoolCount: peers.length || null,
    cityRank: cityPeers.length ? rankAmong(cityPeers.map((row) => row[field]), result[field]) : null,
    cityCount: cityPeers.length || null,
    districtRank: districtPeers.length
      ? rankAmong(districtPeers.map((row) => row[field]), result[field])
      : null,
    districtCount: districtPeers.length || null,
  };
}

export function buildKarneRankSets(
  peers: ExamResult[],
  cityPeers: ExamResult[],
  districtPeers: ExamResult[],
  result: ExamResult,
): KarneRankSets {
  return {
    genel: ranksForField(peers, cityPeers, districtPeers, result, "score"),
    say: ranksForField(peers, cityPeers, districtPeers, result, "scoreSay"),
    ea: ranksForField(peers, cityPeers, districtPeers, result, "scoreEa"),
    soz: ranksForField(peers, cityPeers, districtPeers, result, "scoreSoz"),
  };
}

function normalizeExamLabel(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

function sameSchoolExam(left: ExamSitting, right: ExamSitting): boolean {
  if (left.examType !== right.examType) return false;
  const leftCode = normalizeExamLabel(left.examCode ?? "");
  const rightCode = normalizeExamLabel(right.examCode ?? "");
  if (leftCode && rightCode && leftCode === rightCode) return true;
  return (
    left.examDate === right.examDate &&
    normalizeExamLabel(left.name) === normalizeExamLabel(right.name)
  );
}

function placementScoreCount(result: ExamResult): number {
  return [result.score, result.scoreSay, result.scoreEa, result.scoreSoz].filter(
    (value) => value != null,
  ).length;
}

function preferExamResult(state: AppState, current: ExamResult, candidate: ExamResult): ExamResult {
  const currentScores = placementScoreCount(current);
  const candidateScores = placementScoreCount(candidate);
  if (candidateScores !== currentScores) return candidateScores > currentScores ? candidate : current;
  const currentSubjects = state.subjectResults.filter((row) => row.resultId === current.id).length;
  const candidateSubjects = state.subjectResults.filter((row) => row.resultId === candidate.id).length;
  if (candidateSubjects !== currentSubjects) {
    return candidateSubjects > currentSubjects ? candidate : current;
  }
  if (candidate.calculatedNet !== current.calculatedNet) {
    return candidate.calculatedNet > current.calculatedNet ? candidate : current;
  }
  return current;
}

function uniqueResultsByStudent(state: AppState, results: ExamResult[]): ExamResult[] {
  const byStudent = new Map<string, ExamResult>();
  for (const result of results) {
    const existing = byStudent.get(result.studentId);
    byStudent.set(result.studentId, existing ? preferExamResult(state, existing, result) : result);
  }
  return [...byStudent.values()];
}

function collapseSameExamResults(state: AppState, results: ExamResult[]): ExamResult[] {
  const kept: ExamResult[] = [];
  for (const result of results) {
    const sitting = state.sittings.find((row) => row.id === result.examSittingId);
    const index = kept.findIndex((row) => {
      const other = state.sittings.find((item) => item.id === row.examSittingId);
      if (!sitting || !other) return row.examSittingId === result.examSittingId;
      return sameSchoolExam(sitting, other);
    });
    if (index === -1) kept.push(result);
    else kept[index] = preferExamResult(state, kept[index], result);
  }
  return kept;
}

function examPeerResults(
  state: AppState,
  sitting: ExamSitting | undefined,
  sittingId: string,
): ExamResult[] {
  const sittingIds = sitting
    ? new Set(
        state.sittings.filter((row) => sameSchoolExam(row, sitting)).map((row) => row.id),
      )
    : new Set([sittingId]);
  return uniqueResultsByStudent(
    state,
    state.results.filter((row) => sittingIds.has(row.examSittingId)),
  );
}

function schoolExamResults(
  state: AppState,
  institutionId: string,
  sitting: ExamSitting | undefined,
  sittingId: string,
): ExamResult[] {
  return examPeerResults(state, sitting, sittingId).filter(
    (row) => row.institutionId === institutionId,
  );
}

function placeExamResults(
  state: AppState,
  sitting: ExamSitting | undefined,
  sittingId: string,
  city?: string,
  district?: string,
): ExamResult[] {
  if (!city) return [];
  return examPeerResults(state, sitting, sittingId).filter((row) => {
    const inst = state.institutions.find((item) => item.id === row.institutionId);
    if (!inst || !placesEqual(inst.city, city)) return false;
    if (district && !placesEqual(inst.district, district)) return false;
    return true;
  });
}

function applyFilters(
  state: AppState,
  institutionId: string,
  filters: AnalysisFilters,
): { results: ExamResult[]; sittings: ExamSitting[]; students: Map<string, Student> } {
  const students = new Map(
    state.students.filter((s) => s.institutionId === institutionId).map((s) => [s.id, s]),
  );
  let sittings = state.sittings.slice();
  if (filters.academicYearId) {
    sittings = sittings.filter((s) => s.academicYearId === filters.academicYearId);
  }
  if (filters.dateFrom) sittings = sittings.filter((s) => s.examDate >= filters.dateFrom!);
  if (filters.dateTo) sittings = sittings.filter((s) => s.examDate <= filters.dateTo!);
  const ownSittingIds = new Set(
    state.results.filter((r) => r.institutionId === institutionId).map((r) => r.examSittingId),
  );
  const ownSittings = sittings.filter((s) => ownSittingIds.has(s.id));
  const institution = state.institutions.find((i) => i.id === institutionId);
  sittings = sittingsOfOneExamType(
    ownSittings.length ? ownSittings : sittings,
    filters,
    institution?.examTypePermissions[0],
  ).sittings;

  const sittingIds = new Set(sittings.map((s) => s.id));
  let results = state.results.filter(
    (r) => r.institutionId === institutionId && sittingIds.has(r.examSittingId),
  );
  if (filters.examArea) {
    results = results.filter((r) => r.examArea === filters.examArea);
  }
  results = results.filter((r) => {
    const student = students.get(r.studentId);
    if (!student) return false;
    if (filters.grade && classKeyOf(student).grade !== classKeyOf({ grade: filters.grade, section: "" }).grade) {
      return false;
    }
    if (
      filters.section &&
      classKeyOf(student).section !== classKeyOf({ grade: "", section: filters.section }).section
    ) {
      return false;
    }
    if (filters.studentId && student.id !== filters.studentId) return false;
    return true;
  });
  return { results, sittings, students };
}

export type AnalysisPayload = Record<string, unknown>;

export function computeAnalysis(
  state: AppState,
  institutionId: string,
  moduleSlug: string,
  filters: AnalysisFilters,
): AnalysisPayload {
  const typesWithData = [
    ...new Set(
      state.sittings
        .filter((sitting) =>
          state.results.some(
            (result) => result.institutionId === institutionId && result.examSittingId === sitting.id,
          ),
        )
        .map((sitting) => sitting.examType),
    ),
  ];
  const analysisFilters: AnalysisFilters =
    moduleSlug === "ogrenci-profili"
      ? { ...filters, grade: undefined, section: undefined }
      : filters;
  const { results, sittings, students } = applyFilters(state, institutionId, analysisFilters);
  const sittingsById = new Map(sittings.map((s) => [s.id, s]));
  const orderedSittings = [...sittings].sort((a, b) => a.examDate.localeCompare(b.examDate));
  const lastSitting =
    (filters.examSittingId
      ? orderedSittings.find((s) => s.id === filters.examSittingId)
      : null) ??
    orderedSittings.at(-1) ??
    null;
  const lastIndex = lastSitting ? orderedSittings.findIndex((s) => s.id === lastSitting.id) : -1;
  const previousSitting = lastIndex > 0 ? orderedSittings[lastIndex - 1] ?? null : null;

  const lastResults = lastSitting
    ? results.filter((r) => r.examSittingId === lastSitting.id)
    : [];
  const prevResults = previousSitting
    ? results.filter((r) => r.examSittingId === previousSitting.id)
    : [];
  const track =
    lastSitting?.examType === "AYT" ? parseScoreTrack(filters.scoreTrack) : "genel";

  const subjectAverages = (() => {
    if (!lastSitting) return [];
    const defs = SUBJECTS_BY_EXAM[lastSitting.examType];
    return defs.map((def) => {
      const rows = state.subjectResults.filter((sr) =>
        lastResults.some((r) => r.id === sr.resultId && sr.subjectCode === def.code),
      );
      if (filters.subjectCode && def.code !== filters.subjectCode) {
        return null;
      }
      return {
        code: def.code,
        name: def.name,
        avgCorrect: avg(rows.map((r) => r.correct)),
        avgWrong: avg(rows.map((r) => r.wrong)),
        avgBlank: avg(rows.map((r) => r.blank)),
        avgNet: avg(rows.map((r) => r.calculatedNet)),
        avgSourceNet: avg(rows.filter((r) => r.sourceNet != null).map((r) => r.sourceNet as number)),
      };
    }).filter(Boolean);
  })();

  const classMap = new Map<string, ExamResult[]>();
  const sectionMap = new Map<string, ExamResult[]>();
  const gradeCounts = new Map<string, number>();
  for (const result of lastResults) {
    const student = students.get(result.studentId);
    if (!student) continue;
    const grade = classKeyOf(student).grade;
    if (!grade) continue;
    gradeCounts.set(grade, (gradeCounts.get(grade) ?? 0) + 1);
  }
  const majorityGrade =
    [...gradeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  for (const result of lastResults) {
    const student = students.get(result.studentId);
    if (!student) continue;
    const placement = classKeyOf(student);
    const classKey = placement.grade || majorityGrade;
    if (!classKey) continue;
    const sectionKey = `${classKey}||${placement.section || "—"}`;
    classMap.set(classKey, [...(classMap.get(classKey) ?? []), result]);
    sectionMap.set(sectionKey, [...(sectionMap.get(sectionKey) ?? []), result]);
  }

  const classComparison = [...classMap.entries()].map(([grade, rows]) => ({
    grade,
    count: rows.length,
    avgNet: avg(rows.map((r) => r.calculatedNet)),
    avgScore: avgTrackScore(rows, track),
  }));
  const sectionComparison = [...sectionMap.entries()].map(([key, rows]) => {
    const [grade, section] = key.split("||");
    return {
      grade,
      section,
      count: rows.length,
      avgNet: avg(rows.map((r) => r.calculatedNet)),
      avgScore: avgTrackScore(rows, track),
    };
  });

  const rankingRows = lastResults.map((result) => {
    const student = students.get(result.studentId)!;
    const placement = classKeyOf(student);
    return {
      studentId: student.id,
      studentNo: student.sourceStudentNo,
      name: student.fullName,
      grade: placement.grade || student.grade,
      section: placement.section || student.section,
      net: result.calculatedNet,
      sourceNet: result.sourceNet,
      score: result.score,
      scoreSay: result.scoreSay ?? null,
      scoreEa: result.scoreEa ?? null,
      scoreSoz: result.scoreSoz ?? null,
      correct: result.totalCorrect,
      wrong: result.totalWrong,
      blank: result.totalBlank,
    };
  });
  const rankings = rankingRows
    .map((row) => ({
      ...row,
      schoolRank: rankByScore(rankingRows, row.score),
      rankSay: rankAmong(
        rankingRows.map((peer) => peer.scoreSay),
        row.scoreSay,
      ),
      rankEa: rankAmong(
        rankingRows.map((peer) => peer.scoreEa),
        row.scoreEa,
      ),
      rankSoz: rankAmong(
        rankingRows.map((peer) => peer.scoreSoz),
        row.scoreSoz,
      ),
    }))
    .sort(
      (a, b) =>
        standingScore(scoreOfTrack(b, track)) - standingScore(scoreOfTrack(a, track)),
    );

  const prevByStudent = new Map(prevResults.map((r) => [r.studentId, r]));
  const mostImproved = rankings
    .map((row) => {
      const prev = prevByStudent.get(row.studentId);
      if (!prev) return null;
      return {
        ...row,
        previousNet: prev.calculatedNet,
        netDelta: Math.round((row.net - prev.calculatedNet) * 100) / 100,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => b.netDelta - a.netDelta)
    .slice(0, 8);

  const lastAvg = avg(lastResults.map((r) => r.calculatedNet));
  const needsSupport = rankings
    .map((row) => {
      const prev = prevByStudent.get(row.studentId);
      const declined = prev ? row.net < prev.calculatedNet - 1 : false;
      const low = lastAvg != null && row.net <= lastAvg - 5;
      if (!declined && !low && row.schoolRank > Math.max(3, Math.ceil(rankings.length * 0.7))) {
        return { ...row, reason: "Okul sıralamasının alt diliminde" };
      }
      if (declined) return { ...row, reason: "Önceki süreç değerlendirmeye göre neti geriledi" };
      if (low) return { ...row, reason: "Okul ortalamasının belirgin altında" };
      return null;
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .slice(0, 8);

  const yearTrend = orderedSittings.map((sitting) => {
    const rows = results.filter((r) => r.examSittingId === sitting.id);
    return {
      examId: sitting.id,
      examName: sitting.name,
      date: sitting.examDate,
      examType: sitting.examType,
      avgNet: avg(rows.map((r) => r.calculatedNet)),
      avgScore: avgTrackScore(rows, track),
      participants: rows.length,
    };
  });

  const vsPrevious =
    lastSitting && previousSitting
      ? {
          previousName: previousSitting.name,
          previousDate: previousSitting.examDate,
          netDelta:
            lastAvg != null && avg(prevResults.map((r) => r.calculatedNet)) != null
              ? Math.round(
                  ((lastAvg as number) - (avg(prevResults.map((r) => r.calculatedNet)) as number)) *
                    100,
                ) / 100
              : null,
          scoreDelta:
            avgTrackScore(lastResults, track) != null && avgTrackScore(prevResults, track) != null
              ? Math.round(
                  ((avgTrackScore(lastResults, track) as number) -
                    (avgTrackScore(prevResults, track) as number)) *
                    100,
                ) / 100
              : null,
        }
      : null;

  const lastTotals = {
    participants: lastResults.length,
    averageScore: avgTrackScore(lastResults, track),
    averageNet: lastAvg,
    totalCorrect: lastResults.reduce((s, r) => s + r.totalCorrect, 0),
    totalWrong: lastResults.reduce((s, r) => s + r.totalWrong, 0),
    totalBlank: lastResults.reduce((s, r) => s + r.totalBlank, 0),
    averageSourceNet: avg(
      lastResults.filter((r) => r.sourceNet != null).map((r) => r.sourceNet as number),
    ),
  };

  const scoreBuckets = [
    { label: "450+", min: 450, max: 1000 },
    { label: "400-449", min: 400, max: 449.99 },
    { label: "350-399", min: 350, max: 399.99 },
    { label: "300-349", min: 300, max: 349.99 },
    { label: "300 altı", min: 0, max: 299.99 },
  ].map((bucket) => ({
    ...bucket,
    count: lastResults.filter((r) => {
      const score = scoreOfTrack(r, track);
      return score != null && score >= bucket.min && score <= bucket.max;
    }).length,
  }));

  const provinceNets = lastSitting
    ? state.results
        .filter((row) => row.examSittingId === lastSitting.id)
        .map((row) => row.calculatedNet)
    : [];
  const schoolMeans = lastSitting
    ? [...new Set(state.results.filter((row) => row.examSittingId === lastSitting.id).map((row) => row.institutionId))]
        .map((id) => ({
          id,
          avg: avg(
            state.results
              .filter((row) => row.examSittingId === lastSitting.id && row.institutionId === id)
              .map((row) => row.calculatedNet),
          ),
        }))
        .filter((row) => row.avg != null)
        .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
    : [];
  const peerCount = schoolMeans.length;
  const peerRank = schoolMeans.findIndex((row) => row.id === institutionId) + 1 || null;
  const evaluation = buildSchoolEvaluation({
    schoolAvgNet: lastAvg,
    provinceAvgNet: avg(provinceNets),
    previousAvgNet: avg(prevResults.map((row) => row.calculatedNet)),
    studentNets: lastResults.map((row) => row.calculatedNet),
    subjects: subjectAverages.filter((row): row is NonNullable<typeof row> => row != null),
    peerRank: peerRank || null,
    peerCount,
  });

  const base = {
    module: moduleSlug,
    institutionId,
    lastExam: lastSitting
      ? {
          id: lastSitting.id,
          name: lastSitting.name,
          date: lastSitting.examDate,
          examType: lastSitting.examType,
          publisher: lastSitting.publisher,
          examCode: lastSitting.examCode,
        }
      : null,
    lastTotals,
    subjectAverages,
    classComparison,
    sectionComparison,
    vsPrevious,
    yearTrend,
    rankings,
    mostImproved,
    needsSupport,
    scoreBuckets,
    sittings: orderedSittings,
    empty: results.length === 0,
    evaluation,
    otherExamTypes: typesWithData.filter(
      (type) => type !== (lastSitting?.examType ?? filters.examType),
    ),
  };

  if (moduleSlug === "ogrenci-performans") {
    return {
      ...base,
      changes: rankings
        .map((row) => {
          const history = orderedSittings.map((sitting) => {
            const found = results.find(
              (r) => r.studentId === row.studentId && r.examSittingId === sitting.id,
            );
            return {
              examName: sitting.name,
              date: sitting.examDate,
              net: found?.calculatedNet ?? null,
            };
          });
          const first = history.find((h) => h.net != null)?.net;
          const last = [...history].reverse().find((h) => h.net != null)?.net;
          return {
            ...row,
            history,
            netDelta:
              first != null && last != null ? Math.round((last - first) * 100) / 100 : null,
          };
        })
        .sort((a, b) => (b.netDelta ?? -999) - (a.netDelta ?? -999)),
    };
  }

  if (moduleSlug === "ders-analizi" && filters.subjectCode) {
    return {
      ...base,
      subjectAverages: subjectAverages.filter((s) => s && s.code === filters.subjectCode),
    };
  }

  if (moduleSlug === "soru-analizi") {
    return {
      ...base,
      questionAnalysis: computeQuestionAnalysis(lastSitting, lastResults, state, filters.subjectCode),
    };
  }

  if (moduleSlug === "risk-analizi") {
    return {
      ...base,
      riskProfiles: computeRiskProfiles(rankings, orderedSittings, results, students),
      riskDistribution: computeRiskDistribution(rankings, orderedSittings, results),
    };
  }

  if (moduleSlug === "gelisim-trendi") {
    return {
      ...base,
      studentProjections: computeStudentProjections(rankings, orderedSittings, results),
      trendAnalysis: computeTrendAnalysis(orderedSittings, results),
    };
  }

  if (moduleSlug === "akran-karsilastirma") {
    return {
      ...base,
      peerGroups: computePeerGroups(rankings, students),
      peerComparison: computePeerComparison(rankings, students, filters),
    };
  }

  if (moduleSlug === "sinif-detay-analizi") {
    return {
      ...base,
      heatMapData: computeClassHeatMap(lastResults, students, state.subjectResults, lastSitting),
      distributionAnalysis: computeDistributionAnalysis(lastResults, students),
    };
  }

  if (moduleSlug === "ogrenci-profili" && filters.studentId) {
    return {
      ...base,
      studentProfile: computeStudentProfile(
        filters.studentId,
        results,
        orderedSittings,
        students,
        state.subjectResults,
        state,
        institutionId,
      ),
    };
  }

  if (moduleSlug === "mudahale-onerileri") {
    return {
      ...base,
      recommendations: computeInterventionRecommendations(rankings, orderedSittings, results, prevByStudent),
    };
  }

  void sittingsById;
  void ANALYSIS_MODULES;
  return base;
}

function computeRiskProfiles(
  rankings: Array<{ studentId: string; studentNo: string; name: string; grade: string; section: string; net: number; schoolRank: number }>,
  sittings: ExamSitting[],
  results: ExamResult[],
  students: Map<string, Student>,
) {
  return rankings.map((row) => {
    const studentResults = results
      .filter((r) => r.studentId === row.studentId)
      .sort((a, b) => {
        const sittingA = sittings.find((s) => s.id === a.examSittingId);
        const sittingB = sittings.find((s) => s.id === b.examSittingId);
        return (sittingA?.examDate || "").localeCompare(sittingB?.examDate || "");
      });

    const nets = studentResults.map((r) => r.calculatedNet);
    const avgNet = avg(nets) ?? 0;
    const lastNet = nets[nets.length - 1] ?? 0;
    const netChange = nets.length >= 2 ? lastNet - nets[nets.length - 2] : 0;

    const consistency = computeConsistency(nets);
    const trend = netChange > 1 ? "improving" : netChange < -1 ? "declining" : "stable";
    
    const factors: Array<{ type: string; severity: string; description: string; impact: number }> = [];
    let riskScore = 0;

    if (lastNet < avgNet - 5) {
      factors.push({
        type: "performance",
        severity: "high",
        description: "Son sınav performansı öğrenci ortalamasının altında",
        impact: 30,
      });
      riskScore += 30;
    }

    if (consistency < 0.5) {
      factors.push({
        type: "consistency",
        severity: "medium",
        description: "Sınav performansı tutarsız ve dalgalı",
        impact: 20,
      });
      riskScore += 20;
    }

    if (trend === "declining" && netChange < -3) {
      factors.push({
        type: "performance",
        severity: "high",
        description: "Performansta belirgin düşüş trendi",
        impact: 35,
      });
      riskScore += 35;
    }

    if (row.schoolRank > Math.ceil(rankings.length * 0.7)) {
      factors.push({
        type: "engagement",
        severity: "medium",
        description: "Okul sıralamasının alt diliminde",
        impact: 15,
      });
      riskScore += 15;
    }

    const riskLevel: "low" | "medium" | "high" | "critical" =
      riskScore >= 60 ? "critical" : riskScore >= 40 ? "high" : riskScore >= 20 ? "medium" : "low";

    return {
      studentId: row.studentId,
      studentNo: row.studentNo,
      name: row.name,
      grade: row.grade,
      section: row.section,
      riskLevel,
      riskScore,
      factors,
      trend,
      lastExamNet: lastNet,
      avgNet: Math.round(avgNet * 100) / 100,
      netChange: Math.round(netChange * 100) / 100,
      interventionPriority: riskScore,
    };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

function computeConsistency(values: number[]): number {
  if (values.length < 2) return 1;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean !== 0 ? stdDev / mean : 0;
  return Math.max(0, 1 - cv);
}

function computeRiskDistribution(
  rankings: Array<{ studentId: string; net: number }>,
  sittings: ExamSitting[],
  results: ExamResult[],
) {
  const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  
  rankings.forEach((row) => {
    const studentResults = results.filter((r) => r.studentId === row.studentId);
    const nets = studentResults.map((r) => r.calculatedNet);
    const avgNet = avg(nets) ?? 0;
    const lastNet = nets[nets.length - 1] ?? 0;
    const netChange = nets.length >= 2 ? lastNet - nets[nets.length - 2] : 0;

    let riskScore = 0;
    if (lastNet < avgNet - 5) riskScore += 30;
    if (computeConsistency(nets) < 0.5) riskScore += 20;
    if (netChange < -3) riskScore += 35;

    if (riskScore >= 60) riskCounts.critical++;
    else if (riskScore >= 40) riskCounts.high++;
    else if (riskScore >= 20) riskCounts.medium++;
    else riskCounts.low++;
  });

  return [
    { level: "Düşük Risk", count: riskCounts.low, color: "#22c55e" },
    { level: "Orta Risk", count: riskCounts.medium, color: "#eab308" },
    { level: "Yüksek Risk", count: riskCounts.high, color: "#f97316" },
    { level: "Kritik Risk", count: riskCounts.critical, color: "#ef4444" },
  ];
}

function computeStudentProjections(
  rankings: Array<{ studentId: string; studentNo: string; name: string; net: number }>,
  sittings: ExamSitting[],
  results: ExamResult[],
) {
  return rankings.slice(0, 50).map((row) => {
    const studentResults = results
      .filter((r) => r.studentId === row.studentId)
      .sort((a, b) => {
        const sittingA = sittings.find((s) => s.id === a.examSittingId);
        const sittingB = sittings.find((s) => s.id === b.examSittingId);
        return (sittingA?.examDate || "").localeCompare(sittingB?.examDate || "");
      });

    const nets = studentResults.map((r) => r.calculatedNet);
    if (nets.length < 2) {
      return {
        studentId: row.studentId,
        studentNo: row.studentNo,
        name: row.name,
        currentNet: row.net,
        projectedNet: row.net,
        confidenceInterval: [row.net - 2, row.net + 2] as [number, number],
        growthRate: 0,
        projectionBasis: "linear" as const,
        nextExamEstimate: row.net,
      };
    }

    const n = nets.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = nets.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * nets[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const nextExamEstimate = slope * n + intercept;
    const projectedNet = Math.max(0, Math.min(100, nextExamEstimate));
    
    const residuals = nets.map((net, i) => net - (slope * i + intercept));
    const rmse = Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / n);
    
    const confidenceInterval: [number, number] = [
      Math.max(0, projectedNet - 1.96 * rmse),
      Math.min(100, projectedNet + 1.96 * rmse),
    ];

    return {
      studentId: row.studentId,
      studentNo: row.studentNo,
      name: row.name,
      currentNet: row.net,
      projectedNet: Math.round(projectedNet * 100) / 100,
      confidenceInterval,
      growthRate: Math.round(slope * 100) / 100,
      projectionBasis: "linear" as const,
      nextExamEstimate: Math.round(nextExamEstimate * 100) / 100,
    };
  });
}

function computeTrendAnalysis(sittings: ExamSitting[], results: ExamResult[]) {
  return sittings.map((sitting) => {
    const sittingResults = results.filter((r) => r.examSittingId === sitting.id);
    const nets = sittingResults.map((r) => r.calculatedNet);
    
    return {
      examName: sitting.name,
      date: sitting.examDate,
      avgNet: avg(nets),
      medianNet: nets.length > 0 ? nets.sort((a, b) => a - b)[Math.floor(nets.length / 2)] : null,
      stdDev: nets.length > 0 ? Math.sqrt(nets.reduce((sum, net) => sum + Math.pow(net - (avg(nets) || 0), 2), 0) / nets.length) : null,
      participantCount: nets.length,
    };
  });
}

function computePeerGroups(
  rankings: Array<{ studentId: string; grade: string; section: string; net: number }>,
  students: Map<string, Student>,
) {
  const groups = new Map<string, Array<typeof rankings[0]>>();
  
  rankings.forEach((row) => {
    const key = `${row.grade}-${row.section}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  });

  return Array.from(groups.entries()).map(([key, members]) => {
    const nets = members.map((m) => m.net);
    const sorted = [...members].sort((a, b) => b.net - a.net);
    
    return {
      groupId: key,
      criteria: `Sınıf ${key}`,
      studentCount: members.length,
      avgNet: avg(nets) || 0,
      avgScore: 0,
      performanceRange: [Math.min(...nets), Math.max(...nets)] as [number, number],
      topPerformers: sorted.slice(0, 3).map((m) => {
        const student = students.get(m.studentId);
        return student ? student.fullName : "";
      }),
    };
  });
}

function computePeerComparison(
  rankings: Array<{ studentId: string; grade: string; section: string; net: number }>,
  students: Map<string, Student>,
  filters: AnalysisFilters,
) {
  if (!filters.studentId) return null;

  const targetStudent = rankings.find((r) => r.studentId === filters.studentId);
  if (!targetStudent) return null;

  const peers = rankings.filter(
    (r) => r.grade === targetStudent.grade && r.section === targetStudent.section && r.studentId !== targetStudent.studentId
  );

  const peerNets = peers.map((p) => p.net);
  const peerAvg = avg(peerNets) || 0;
  const percentile = (peers.filter((p) => p.net < targetStudent.net).length / peers.length) * 100;

  return {
    studentNet: targetStudent.net,
    peerAverage: Math.round(peerAvg * 100) / 100,
    percentile: Math.round(percentile),
    peerCount: peers.length,
    ranking: rankings.findIndex((r) => r.studentId === filters.studentId) + 1,
    totalStudents: rankings.length,
  };
}

function computeClassHeatMap(
  results: ExamResult[],
  students: Map<string, Student>,
  subjectResults: SubjectResult[],
  sitting: ExamSitting | null,
) {
  if (!sitting) return [];

  const classSections = new Map<string, Map<string, number>>();
  
  results.forEach((result) => {
    const student = students.get(result.studentId);
    if (!student) return;

    const placement = classKeyOf(student);
    const key = `${placement.grade}-${placement.section}`;
    if (!classSections.has(key)) {
      classSections.set(key, new Map());
    }

    const sectionData = classSections.get(key)!;
    sectionData.set(student.id, result.calculatedNet);
  });

  return Array.from(classSections.entries()).map(([key, studentNets]) => {
    const nets = Array.from(studentNets.values());
    return {
      section: key,
      avgNet: avg(nets) || 0,
      minNet: Math.min(...nets),
      maxNet: Math.max(...nets),
      studentCount: nets.length,
      performance: avg(nets) || 0,
    };
  });
}

function computeDistributionAnalysis(
  results: ExamResult[],
  students: Map<string, Student>,
) {
  const netRanges = [
    { label: "0-10", min: 0, max: 10 },
    { label: "10-20", min: 10, max: 20 },
    { label: "20-30", min: 20, max: 30 },
    { label: "30-40", min: 30, max: 40 },
    { label: "40-50", min: 40, max: 50 },
    { label: "50-60", min: 50, max: 60 },
    { label: "60-70", min: 60, max: 70 },
    { label: "70-80", min: 70, max: 80 },
    { label: "80-90", min: 80, max: 90 },
    { label: "90-100", min: 90, max: 100 },
  ];

  return netRanges.map((range) => ({
    ...range,
    count: results.filter(
      (r) => r.calculatedNet >= range.min && r.calculatedNet < range.max
    ).length,
  }));
}

function computeStudentProfile(
  studentId: string,
  results: ExamResult[],
  sittings: ExamSitting[],
  students: Map<string, Student>,
  subjectResults: SubjectResult[],
  state: AppState,
  institutionId: string,
) {
  const student = students.get(studentId);
  if (!student) return null;

  const studentResults = collapseSameExamResults(
    state,
    results.filter((r) => r.studentId === studentId),
  ).sort((a, b) => {
      const sittingA = sittings.find((s) => s.id === a.examSittingId);
      const sittingB = sittings.find((s) => s.id === b.examSittingId);
      return (sittingA?.examDate || "").localeCompare(sittingB?.examDate || "");
    });

  const examHistory = studentResults.map((result) => {
    const sitting =
      state.sittings.find((row) => row.id === result.examSittingId) ??
      sittings.find((row) => row.id === result.examSittingId);
    const institution = state.institutions.find((row) => row.id === institutionId);
    const peers = schoolExamResults(state, institutionId, sitting, result.examSittingId);
    const cityPeers = placeExamResults(
      state,
      sitting,
      result.examSittingId,
      institution?.city,
    );
    const districtPeers = placeExamResults(
      state,
      sitting,
      result.examSittingId,
      institution?.city,
      institution?.district,
    );
    const subjects = subjectResults
      .filter((sr) => sr.resultId === result.id)
      .map((sr) => {
        const def = sitting
          ? SUBJECTS_BY_EXAM[sitting.examType].find((row) => row.code === sr.subjectCode)
          : undefined;
        return {
          code: sr.subjectCode,
          name: def?.name ?? sr.subjectCode,
          net: sr.calculatedNet,
          correct: sr.correct,
          wrong: sr.wrong,
          blank: sr.blank,
        };
      })
      .sort(
        (a, b) =>
          subjectOrder(sitting?.examType, a.code) - subjectOrder(sitting?.examType, b.code),
      );
    const questions = sitting
      ? buildExamQuestions(result, sitting, subjectResults.filter((row) => row.resultId === result.id))
      : [];
    const missingOutcomes = uniqueOutcomes(
      questions.filter((row) => isMissedQuestionStatus(row.status)),
      sitting?.examType,
    );

    return {
      sittingId: sitting?.id || "",
      examName: sitting?.name || "",
      date: sitting?.examDate || "",
      net: result.calculatedNet,
      score: result.score,
      scoreSay: result.scoreSay ?? null,
      scoreEa: result.scoreEa ?? null,
      scoreSoz: result.scoreSoz ?? null,
      schoolRank: peers.length ? rankByScore(peers, result.score) : null,
      schoolCount: peers.length || null,
      cityRank: cityPeers.length ? rankByScore(cityPeers, result.score) : null,
      cityCount: cityPeers.length || null,
      districtRank: districtPeers.length ? rankByScore(districtPeers, result.score) : null,
      districtCount: districtPeers.length || null,
      rankSets: buildKarneRankSets(peers, cityPeers, districtPeers, result),
      subjects,
      questions,
      missingOutcomes,
      outcomeResults: aggregateOutcomeResults(questions, sitting?.examType),
    };
  });

  const nets = studentResults.map((r) => r.calculatedNet);
  const avgNet = avg(nets) || 0;
  const bestNet = Math.max(...nets, 0);
  const latestNet = nets[nets.length - 1] || 0;
  const improvement = nets.length >= 2 ? latestNet - nets[0] : 0;

  return {
    student: {
      id: student.id,
      name: student.fullName,
      studentNo: student.sourceStudentNo,
      grade: student.grade,
      section: student.section,
    },
    summary: {
      examsTaken: studentResults.length,
      avgNet: Math.round(avgNet * 100) / 100,
      bestNet: Math.round(bestNet * 100) / 100,
      latestNet: Math.round(latestNet * 100) / 100,
      improvement: Math.round(improvement * 100) / 100,
      consistency: computeConsistency(nets),
    },
    examHistory,
    reportCard: {
      missingOutcomes: uniqueOutcomes(examHistory.flatMap((exam) => exam.questions).filter((row) => isMissedQuestionStatus(row.status))),
      gainedOutcomes: uniqueOutcomes(examHistory.flatMap((exam) => exam.questions).filter((row) => row.status === "correct")),
    },
  };
}

export type KarneQuestion = {
  subjectCode: string;
  subjectName: string;
  questionNo: number;
  sourceQuestionNo: number | null;
  studentAnswer: string;
  correctAnswer: string;
  outcome: string;
  status: "correct" | "wrong" | "blank" | "cancelled";
};

export type OutcomeResult = {
  subjectCode: string;
  subjectName: string;
  outcome: string;
  correct: number;
  wrong: number;
  blank: number;
  cancelled: number;
  questionNos: number[];
};

export function isMissingOutcome(row: OutcomeResult): boolean {
  return row.wrong + row.blank > 0;
}

function subjectOrder(examType: ExamType | undefined, code: string): number {
  if (!examType) return 999;
  return SUBJECTS_BY_EXAM[examType].find((row) => row.code === code)?.sortOrder ?? 999;
}

function subjectNameOrder(examType: ExamType | undefined, name: string): number {
  if (!examType) return 999;
  const index = SUBJECTS_BY_EXAM[examType].findIndex((row) => row.name === name);
  return index === -1 ? 999 : index + 1;
}

export function aggregateOutcomeResults(
  questions: KarneQuestion[],
  examType?: ExamType,
): OutcomeResult[] {
  const grouped = new Map<string, OutcomeResult>();
  for (const row of questions) {
    if (!row.outcome) continue;
    const key = `${row.subjectCode}|${row.outcome}`;
    const current = grouped.get(key) ?? {
      subjectCode: row.subjectCode,
      subjectName: row.subjectName,
      outcome: row.outcome,
      correct: 0,
      wrong: 0,
      blank: 0,
      cancelled: 0,
      questionNos: [],
    };
    current.questionNos.push(row.questionNo);
    if (row.status === "correct") current.correct += 1;
    else if (row.status === "wrong") current.wrong += 1;
    else if (row.status === "blank") current.blank += 1;
    else if (row.status === "cancelled") current.cancelled += 1;
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((a, b) => {
    const subjectDelta = subjectOrder(examType, a.subjectCode) - subjectOrder(examType, b.subjectCode);
    if (subjectDelta) return subjectDelta;
    const qA = Math.min(...a.questionNos);
    const qB = Math.min(...b.questionNos);
    if (qA !== qB) return qA - qB;
    return a.outcome.localeCompare(b.outcome, "tr");
  });
}

export type StudentKarne = {
  student: { id: string; name: string; studentNo: string; grade: string; section: string };
  booklet: string;
  totals: {
    correct: number;
    wrong: number;
    blank: number;
    net: number;
    score: number | null;
    scoreSay: number | null;
    scoreEa: number | null;
    scoreSoz: number | null;
    schoolRank: number | null;
    schoolCount: number | null;
    cityRank: number | null;
    cityCount: number | null;
    districtRank: number | null;
    districtCount: number | null;
    rankSets: KarneRankSets;
  };
  subjects: Array<{ code: string; name: string; correct: number; wrong: number; blank: number; net: number }>;
  questions: KarneQuestion[];
  outcomeResults: OutcomeResult[];
  missingOutcomes: Array<{ outcome: string; subjectName: string; count: number }>;
  missedQuestions: KarneQuestion[];
};

export type ClassReportCards = {
  sitting: { id: string; name: string; examDate: string; examType: string; publisher: string; examCode: string };
  institution: { id: string; name: string; code: string; city: string; district: string };
  grade: string;
  section: string;
  cards: StudentKarne[];
};

export function computeClassReportCards(
  state: AppState,
  institutionId: string,
  input: { sittingId: string; grade: string; section: string },
): ClassReportCards | null {
  const sitting = state.sittings.find((row) => row.id === input.sittingId);
  const institution = state.institutions.find((row) => row.id === institutionId);
  if (!sitting || !institution) return null;
  const classStudents = state.students
    .filter((student) => {
      if (student.institutionId !== institutionId) return false;
      const placement = classKeyOf(student);
      const wanted = classKeyOf({ grade: input.grade, section: input.section });
      return placement.grade === wanted.grade && placement.section === wanted.section;
    })
    .sort(
      (a, b) =>
        a.sourceStudentNo.localeCompare(b.sourceStudentNo, "tr", { numeric: true }) ||
        a.fullName.localeCompare(b.fullName, "tr"),
    );
  const students = new Map(classStudents.map((student) => [student.id, student]));
  const classResults = examPeerResults(state, sitting, sitting.id).filter(
    (result) => result.institutionId === institutionId && students.has(result.studentId),
  );
  const cards: StudentKarne[] = [];
  for (const student of classStudents) {
    const result = classResults.find((row) => row.studentId === student.id);
    if (!result) continue;
    const profile = computeStudentProfile(
      student.id,
      [result],
      state.sittings,
      students,
      state.subjectResults,
      state,
      institutionId,
    );
    const exam = profile?.examHistory[0];
    if (!profile || !exam) continue;
    cards.push({
      student: profile.student,
      booklet: result?.booklet || "A",
      totals: {
        correct: result?.totalCorrect ?? exam.subjects.reduce((sum, row) => sum + row.correct, 0),
        wrong: result?.totalWrong ?? exam.subjects.reduce((sum, row) => sum + row.wrong, 0),
        blank: result?.totalBlank ?? exam.subjects.reduce((sum, row) => sum + row.blank, 0),
        net: exam.net,
        score: exam.score,
        scoreSay: exam.scoreSay ?? result?.scoreSay ?? null,
        scoreEa: exam.scoreEa ?? result?.scoreEa ?? null,
        scoreSoz: exam.scoreSoz ?? result?.scoreSoz ?? null,
        schoolRank: exam.schoolRank,
        schoolCount: exam.schoolCount,
        cityRank: exam.cityRank ?? null,
        cityCount: exam.cityCount ?? null,
        districtRank: exam.districtRank ?? null,
        districtCount: exam.districtCount ?? null,
        rankSets: exam.rankSets,
      },
      subjects: exam.subjects.map((row) => ({
        code: row.code,
        name: row.name,
        correct: row.correct,
        wrong: row.wrong,
        blank: row.blank,
        net: row.net,
      })),
      questions: exam.questions ?? [],
      outcomeResults: exam.outcomeResults ?? aggregateOutcomeResults(exam.questions ?? [], sitting.examType),
      missingOutcomes: exam.missingOutcomes,
      missedQuestions: exam.questions.filter((row) => isMissedQuestionStatus(row.status) && row.outcome),
    });
  }
  return {
    sitting: {
      id: sitting.id,
      name: sitting.name,
      examDate: sitting.examDate,
      examType: sitting.examType,
      publisher: sitting.publisher,
      examCode: sitting.examCode,
    },
    institution: {
      id: institution.id,
      name: institution.name,
      code: institution.code,
      city: institution.city,
      district: institution.district,
    },
    grade: input.grade,
    section: input.section,
    cards,
  };
}

function buildExamQuestions(
  result: ExamResult,
  sitting: ExamSitting,
  subjects: SubjectResult[],
) {
  const booklet = result.booklet || "A";
  const defs = SUBJECTS_BY_EXAM[sitting.examType];
  const rows: Array<{
    subjectCode: string;
    subjectName: string;
    questionNo: number;
    sourceQuestionNo: number | null;
    booklet: string;
    studentAnswer: string;
    correctAnswer: string;
    outcome: string;
    status: "correct" | "wrong" | "blank" | "cancelled";
  }> = [];
  const baseBooklet = sitting.questionKeys?.A ? "A" : Object.keys(sitting.questionKeys ?? {}).sort()[0] ?? "A";
  for (const subject of subjects) {
    const def = defs.find((row) => row.code === subject.subjectCode);
    if (!def || !subject.answers) continue;
    const specs = sitting.questionKeys?.[booklet]?.[subject.subjectCode] ?? [];
    const student = normalizeAnswerString(subject.answers, def.questionCount);
    const sourceNos =
      booklet === baseBooklet
        ? []
        : invertQuestionMap(sitting.bookletLinks?.[booklet]?.[subject.subjectCode] ?? []);
    for (let i = 0; i < def.questionCount; i += 1) {
      const studentAnswer = student[i] === " " ? "" : student[i] ?? "";
      const correctAnswer = (specs[i]?.answer ?? sitting.answerKeys?.[booklet]?.[subject.subjectCode]?.[i] ?? "")
        .toString()
        .trim()
        .toUpperCase();
      const status = questionStatus(studentAnswer, correctAnswer, Boolean(specs[i]?.cancelled));
      const sourceQuestionNo = booklet === baseBooklet ? i + 1 : sourceNos[i] || null;
      rows.push({
        subjectCode: subject.subjectCode,
        subjectName: def.name,
        questionNo: i + 1,
        sourceQuestionNo: sourceQuestionNo && sourceQuestionNo !== i + 1 ? sourceQuestionNo : null,
        booklet,
        studentAnswer,
        correctAnswer,
        outcome: specs[i]?.outcome?.trim() ?? "",
        status,
      });
    }
  }
  return rows;
}

export type QuestionAnalysisRow = {
  subjectCode: string;
  subjectName: string;
  questionNo: number;
  bQuestionNo: number | null;
  outcome: string;
  cancelled: boolean;
  correctAnswer: string;
  correct: number;
  wrong: number;
  blank: number;
  answered: number;
  correctPct: number;
  wrongPct: number;
  blankPct: number;
  difficulty: "kolay" | "orta" | "zor" | "iptal";
  options: { A: number; B: number; C: number; D: number; E: number; blank: number };
};

export type QuestionAnalysisPayload = {
  hasAnswers: boolean;
  cancelledCount: number;
  participantCount: number;
  sittingName: string;
  subjects: Array<{ code: string; name: string; questions: QuestionAnalysisRow[] }>;
};

function difficultyOf(cancelled: boolean, correctPct: number): QuestionAnalysisRow["difficulty"] {
  if (cancelled) return "iptal";
  if (correctPct >= 70) return "kolay";
  if (correctPct >= 40) return "orta";
  return "zor";
}

function canonicalQuestionIndex(
  booklet: string,
  baseBooklet: string,
  questionIndex: number,
  links: number[] | undefined,
): number {
  if (booklet === baseBooklet) return questionIndex;
  if (!hasMappedQuestions(links)) return questionIndex;
  const aNo = invertQuestionMap(links ?? [])[questionIndex] ?? 0;
  return aNo >= 1 ? aNo - 1 : -1;
}

export function computeQuestionAnalysis(
  lastSitting: ExamSitting | null,
  lastResults: ExamResult[],
  state: AppState,
  subjectCode?: string,
): QuestionAnalysisPayload {
  if (!lastSitting) {
    return { hasAnswers: false, cancelledCount: 0, participantCount: 0, sittingName: "", subjects: [] };
  }
  const defs = SUBJECTS_BY_EXAM[lastSitting.examType].filter(
    (def) => !subjectCode || def.code === subjectCode,
  );
  const baseBooklet = lastSitting.questionKeys?.A
    ? "A"
    : Object.keys(lastSitting.questionKeys ?? {}).sort()[0] ?? "A";
  const resultIds = new Set(lastResults.map((row) => row.id));
  const subjectRows = state.subjectResults.filter((row) => resultIds.has(row.resultId));
  const hasAnswers = subjectRows.some((row) => Boolean(row.answers));
  const resultById = new Map(lastResults.map((row) => [row.id, row]));

  const subjects = defs.map((def) => {
    const aSpecs = lastSitting.questionKeys?.[baseBooklet]?.[def.code] ?? [];
    const bLinks = lastSitting.bookletLinks?.B?.[def.code];
    const buckets = Array.from({ length: def.questionCount }, (_, index) => ({
      subjectCode: def.code,
      subjectName: def.name,
      questionNo: index + 1,
      bQuestionNo: bLinks?.[index] && bLinks[index] > 0 ? bLinks[index] : null,
      outcome: aSpecs[index]?.outcome?.trim() ?? "",
      cancelled: Boolean(aSpecs[index]?.cancelled),
      correctAnswer: (aSpecs[index]?.answer ?? "").trim().toUpperCase(),
      correct: 0,
      wrong: 0,
      blank: 0,
      answered: 0,
      options: { A: 0, B: 0, C: 0, D: 0, E: 0, blank: 0 },
    }));

    for (const subject of subjectRows.filter((row) => row.subjectCode === def.code && row.answers)) {
      const result = resultById.get(subject.resultId);
      if (!result) continue;
      const booklet = result.booklet || "A";
      const student = normalizeAnswerString(subject.answers, def.questionCount);
      const bookletSpecs = lastSitting.questionKeys?.[booklet]?.[def.code] ?? aSpecs;
      const links = lastSitting.bookletLinks?.[booklet]?.[def.code];
      for (let i = 0; i < def.questionCount; i += 1) {
        const canonical = canonicalQuestionIndex(booklet, baseBooklet, i, links);
        if (canonical < 0 || canonical >= buckets.length) continue;
        const bucket = buckets[canonical];
        const mark = student[i] === " " ? "" : student[i] ?? "";
        const expected = (bookletSpecs[i]?.answer ?? bucket.correctAnswer).trim().toUpperCase();
        bucket.answered += 1;
        if (!mark) bucket.options.blank += 1;
        else if (mark === "A" || mark === "B" || mark === "C" || mark === "D" || mark === "E") {
          bucket.options[mark] += 1;
        }
        const original = questionStatus(mark, expected, false);
        if (original === "correct") bucket.correct += 1;
        else if (original === "wrong") bucket.wrong += 1;
        else bucket.blank += 1;
      }
    }

    const questions = buckets.map((bucket) => {
      const n = bucket.answered;
      const correctPct = n ? Math.round((bucket.correct / n) * 1000) / 10 : 0;
      const wrongPct = n ? Math.round((bucket.wrong / n) * 1000) / 10 : 0;
      const blankPct = n ? Math.round((bucket.blank / n) * 1000) / 10 : 0;
      return {
        ...bucket,
        correctPct,
        wrongPct,
        blankPct,
        difficulty: difficultyOf(bucket.cancelled, correctPct),
      };
    });

    return { code: def.code, name: def.name, questions };
  });

  return {
    hasAnswers,
    cancelledCount: subjects.reduce(
      (sum, subject) => sum + subject.questions.filter((row) => row.cancelled).length,
      0,
    ),
    participantCount: lastResults.length,
    sittingName: lastSitting.name,
    subjects,
  };
}

function uniqueOutcomes(
  rows: Array<{ outcome: string; subjectName: string; status: string }>,
  examType?: ExamType,
) {
  const grouped = new Map<string, { outcome: string; subjectName: string; count: number }>();
  for (const row of rows) {
    if (!row.outcome) continue;
    const key = `${row.subjectName}|${row.outcome}`;
    const current = grouped.get(key);
    if (current) current.count += 1;
    else grouped.set(key, { outcome: row.outcome, subjectName: row.subjectName, count: 1 });
  }
  return [...grouped.values()].sort((a, b) => {
    const subjectDelta = subjectNameOrder(examType, a.subjectName) - subjectNameOrder(examType, b.subjectName);
    if (subjectDelta) return subjectDelta;
    return a.outcome.localeCompare(b.outcome, "tr");
  });
}

function computeInterventionRecommendations(
  rankings: Array<{ studentId: string; studentNo: string; name: string; net: number; schoolRank: number }>,
  sittings: ExamSitting[],
  results: ExamResult[],
  prevByStudent: Map<string, ExamResult>,
) {
  const recommendations: Array<{
    studentId: string;
    studentName: string;
    priority: "urgent" | "high" | "medium" | "low";
    recommendationType: string;
    title: string;
    description: string;
    specificActions: string[];
    expectedOutcome: string;
    timeframe: string;
  }> = [];

  rankings.forEach((row) => {
    const studentResults = results.filter((r) => r.studentId === row.studentId);
    const nets = studentResults.map((r) => r.calculatedNet);
    const avgNet = avg(nets) || 0;
    const lastNet = nets[nets.length - 1] || 0;
    const netChange = nets.length >= 2 ? lastNet - nets[nets.length - 2] : 0;
    const consistency = computeConsistency(nets);

    if (netChange < -5) {
      recommendations.push({
        studentId: row.studentId,
        studentName: row.name,
        priority: "urgent",
        recommendationType: "academic",
        title: "Acil Akademik Destek Gerekli",
        description: `${row.name} son sınavda ${Math.abs(netChange).toFixed(1)} net düşüş gösterdi.`,
        specificActions: [
          "Öğrenci ve veli ile birebir görüşme yapın",
          "Başarısızlık nedenlerini tespit edin (sağlık, aile, motivasyon)",
          "Haftalık ders programı ve takip sistemi oluşturun",
          "Akran eğitimi veya rehber öğretmen desteği sağlayın",
        ],
        expectedOutcome: "2-3 sınav içinde performansın eski seviyesine dönmesi",
        timeframe: "Hemen başlanmalı, 2 hafta içinde ilk değerlendirme",
      });
    } else if (consistency < 0.4 && nets.length >= 3) {
      recommendations.push({
        studentId: row.studentId,
        studentName: row.name,
        priority: "high",
        recommendationType: "behavioral",
        title: "Tutarlılık ve Çalışma Disiplini Desteği",
        description: `${row.name} tutarsız performans gösteriyor. Düzenli çalışma alışkanlığı kazandırılmalı.`,
        specificActions: [
          "Günlük çalışma planı oluşturun ve takip edin",
          "Haftalık mini sınavlarla düzenli değerlendirme yapın",
          "Başarılı olunan konularda motivasyon sağlayın",
          "Zaman yönetimi ve verimli çalışma teknikleri öğretin",
        ],
        expectedOutcome: "Performansta istikrar ve kademeli artış",
        timeframe: "4-6 haftalık program",
      });
    } else if (lastNet < avgNet - 3) {
      recommendations.push({
        studentId: row.studentId,
        studentName: row.name,
        priority: "medium",
        recommendationType: "academic",
        title: "Hedefli Ders Desteği",
        description: `${row.name} ortalama performansının altında kaldı. Zayıf dersler belirlenmeli.`,
        specificActions: [
          "Ders bazlı analiz yaparak zayıf konuları tespit edin",
          "Haftalık 2-3 saat ek ders veya etüt desteği sağlayın",
          "Eksik konular için kaynak ve alıştırma materyali verin",
          "Aylık ilerleme değerlendirmesi yapın",
        ],
        expectedOutcome: "Zayıf derslerde en az 2-3 net artış",
        timeframe: "6-8 haftalık destek programı",
      });
    }
  });

  return recommendations.sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  }).slice(0, 15);
}
