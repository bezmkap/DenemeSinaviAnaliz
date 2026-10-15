export type RadiologyTraffic = "guclu" | "izle" | "mudahale";

export type DimensionScore = {
  key: string;
  label: string;
  shortLabel: string;
  score: number;
  detail: string;
};

export type EquityMetrics = {
  mean: number;
  stdDev: number;
  p10: number;
  p90: number;
  gap: number;
  score: number;
};

export type EvaluationIntervention = {
  priority: "yuksek" | "orta" | "dusuk";
  title: string;
  detail: string;
};

export type SchoolEvaluation = {
  compositeScore: number;
  traffic: RadiologyTraffic;
  dimensions: DimensionScore[];
  provinceAvgNet: number | null;
  vsProvince: number | null;
  vsPrevious: number | null;
  peerRank: number | null;
  peerCount: number;
  equity: EquityMetrics;
  strongSubjects: Array<{ code: string; name: string; avgNet: number | null }>;
  weakSubjects: Array<{ code: string; name: string; avgNet: number | null }>;
  interventions: EvaluationIntervention[];
};

export type ProvinceSchoolFlag = {
  id: string;
  name: string;
  avgNet: number | null;
  vsProvince: number | null;
  traffic: RadiologyTraffic;
  compositeScore: number;
  flag: "basari" | "izle" | "mudahale";
};

export type ProvinceEvaluation = {
  compositeScore: number;
  traffic: RadiologyTraffic;
  dimensions: DimensionScore[];
  equity: EquityMetrics;
  vsPrevious: number | null;
  successSchools: ProvinceSchoolFlag[];
  watchSchools: ProvinceSchoolFlag[];
  urgentSchools: ProvinceSchoolFlag[];
  strongSubjects: Array<{ code: string; name: string; avgNet: number | null }>;
  weakSubjects: Array<{ code: string; name: string; avgNet: number | null }>;
  interventions: EvaluationIntervention[];
};

export function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

export function clampScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}

export function trafficFromScore(score: number): RadiologyTraffic {
  if (score >= 70) return "guclu";
  if (score >= 45) return "izle";
  return "mudahale";
}

export function trafficLabel(traffic: RadiologyTraffic): string {
  if (traffic === "guclu") return "Güçlü";
  if (traffic === "izle") return "İzle";
  return "Müdahale";
}

export function equityFromNets(nets: number[]): EquityMetrics {
  if (!nets.length) {
    return { mean: 0, stdDev: 0, p10: 0, p90: 0, gap: 0, score: 50 };
  }
  const sorted = [...nets].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const variance = sorted.reduce((sum, n) => sum + (n - mean) ** 2, 0) / sorted.length;
  const stdDev = Math.sqrt(variance);
  const p10 = sorted[Math.max(0, Math.floor(sorted.length * 0.1))] ?? sorted[0];
  const p90 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] ?? sorted.at(-1)!;
  const gap = p90 - p10;
  const cv = mean !== 0 ? stdDev / Math.abs(mean) : 1;
  return {
    mean: Math.round(mean * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    p10: Math.round(p10 * 100) / 100,
    p90: Math.round(p90 * 100) / 100,
    gap: Math.round(gap * 100) / 100,
    score: clampScore(100 * (1 - Math.min(1, cv))),
  };
}

export function buildSchoolEvaluation(input: {
  schoolAvgNet: number | null;
  provinceAvgNet: number | null;
  previousAvgNet: number | null;
  studentNets: number[];
  subjects: Array<{ code: string; name: string; avgNet: number | null }>;
  peerRank?: number | null;
  peerCount?: number;
}): SchoolEvaluation {
  const peerRank = input.peerRank ?? null;
  const peerCount = input.peerCount ?? 0;
  const vsProvince =
    input.schoolAvgNet != null && input.provinceAvgNet != null
      ? Math.round((input.schoolAvgNet - input.provinceAvgNet) * 100) / 100
      : null;
  const vsPrevious =
    input.schoolAvgNet != null && input.previousAvgNet != null
      ? Math.round((input.schoolAvgNet - input.previousAvgNet) * 100) / 100
      : null;
  const equity = equityFromNets(input.studentNets);
  const subjectNets = input.subjects
    .map((row) => row.avgNet)
    .filter((n): n is number => n != null);
  const subjectMean = avg(subjectNets) ?? 0;
  const subjectEquity = equityFromNets(subjectNets);

  const achievement = clampScore(
    vsProvince == null ? 50 + (input.schoolAvgNet ?? 0) * 0.6 : 50 + vsProvince * 8,
  );
  const progress = clampScore(50 + (vsPrevious ?? 0) * 8);
  const relative = achievement;
  const balance = subjectNets.length ? subjectEquity.score : 50;

  const dimensions: DimensionScore[] = [
    {
      key: "achievement",
      label: "Başarı",
      shortLabel: "Başarı",
      score: achievement,
      detail:
        vsProvince == null
          ? "İl karşılaştırması için başka okul sonucu yok."
          : vsProvince >= 0
            ? `İl ortalamasının ${vsProvince.toFixed(1)} net üzerinde.`
            : `İl ortalamasının ${Math.abs(vsProvince).toFixed(1)} net altında.`,
    },
    {
      key: "progress",
      label: "İlerleme",
      shortLabel: "İlerleme",
      score: progress,
      detail:
        vsPrevious == null
          ? "Karşılaştırılacak önceki sınav yok."
          : vsPrevious >= 0
            ? `Önceki süreç değerlendirmeye göre ${vsPrevious.toFixed(1)} net artış.`
            : `Önceki süreç değerlendirmeye göre ${Math.abs(vsPrevious).toFixed(1)} net düşüş.`,
    },
    {
      key: "equity",
      label: "Eşitlik",
      shortLabel: "Eşitlik",
      score: equity.score,
      detail: `Öğrenci netleri P10–P90 aralığı ${equity.gap.toFixed(1)}. Standart sapma ${equity.stdDev.toFixed(1)}.`,
    },
    {
      key: "balance",
      label: "Ders dengesi",
      shortLabel: "Denge",
      score: balance,
      detail:
        subjectMean > 0
          ? "Ders netleri birbirine yakınsa denge yüksek, uçurum varsa müdahale gerekir."
          : "Ders kırılımı yok.",
    },
    {
      key: "relative",
      label: "Göreli konum",
      shortLabel: "Göreli",
      score: relative,
      detail:
        peerRank && peerCount
          ? `İl içinde ${peerCount} okul arasında ${peerRank}. sırada.`
          : "Okulun il içindeki göreli akademik konumu.",
    },
  ];

  const compositeScore = clampScore(
    dimensions.reduce((sum, dim) => sum + dim.score, 0) / dimensions.length,
  );
  const traffic = trafficFromScore(compositeScore);

  const rankedSubjects = [...input.subjects]
    .filter((row) => row.avgNet != null)
    .sort((a, b) => (b.avgNet ?? 0) - (a.avgNet ?? 0));

  const interventions: EvaluationIntervention[] = [];
  if (vsPrevious != null && vsPrevious <= -3) {
    interventions.push({
      priority: "yuksek",
      title: "Performans düşüşü",
      detail: "Okul ortalaması önceki süreç değerlendirmeye göre belirgin geriledi. Zayıf şube ve dersler hızla incelenmeli.",
    });
  }
  if (vsProvince != null && vsProvince <= -4) {
    interventions.push({
      priority: "yuksek",
      title: "İl ortalamasının altında",
      detail: "Okul, il genelinin gerisinde. Öncelikli derslere etüt ve konu tarama planı gerekir.",
    });
  }
  if (equity.score < 45) {
    interventions.push({
      priority: "orta",
      title: "Okul içi uçurum",
      detail: "Öğrenci netleri arasında geniş makas var. Alt dilime hedefi destek programı açılmalı.",
    });
  }
  const weakSubjects = rankedSubjects.slice(-3).reverse();
  if (weakSubjects[0] && (weakSubjects[0].avgNet ?? 0) + 3 < (rankedSubjects[0]?.avgNet ?? 0)) {
    interventions.push({
      priority: "orta",
      title: `Öncelikli ders: ${weakSubjects[0].name}`,
      detail: "En zayıf ders ile en güçlü ders arasındaki fark kapatılmalı.",
    });
  }

  return {
    compositeScore,
    traffic,
    dimensions,
    provinceAvgNet: input.provinceAvgNet,
    vsProvince,
    vsPrevious,
    peerRank,
    peerCount,
    equity,
    strongSubjects: rankedSubjects.slice(0, 3),
    weakSubjects,
    interventions,
  };
}

export function buildProvinceEvaluation(input: {
  provinceAvgNet: number | null;
  previousAvgNet: number | null;
  studentNets: number[];
  subjects: Array<{ code: string; name: string; avgNet: number | null }>;
  schools: Array<{ id: string; name: string; avgNet: number | null }>;
}): ProvinceEvaluation {
  const equity = equityFromNets(input.studentNets);
  const vsPrevious =
    input.provinceAvgNet != null && input.previousAvgNet != null
      ? Math.round((input.provinceAvgNet - input.previousAvgNet) * 100) / 100
      : null;
  const schoolNets = input.schools.map((row) => row.avgNet).filter((n): n is number => n != null);
  const schoolEquity = equityFromNets(schoolNets);

  const achievement = clampScore(50 + (input.provinceAvgNet ?? 0) * 0.5);
  const progress = clampScore(50 + (vsPrevious ?? 0) * 8);
  const dimensions: DimensionScore[] = [
    {
      key: "achievement",
      label: "İl başarısı",
      shortLabel: "Başarı",
      score: achievement,
      detail: `İl ortalama net ${input.provinceAvgNet ?? "—"}.`,
    },
    {
      key: "progress",
      label: "İlerleme",
      shortLabel: "İlerleme",
      score: progress,
      detail:
        vsPrevious == null
          ? "Önceki sınav karşılaştırması yok."
          : `Önceki süreç değerlendirmeye göre ${vsPrevious >= 0 ? "+" : ""}${vsPrevious.toFixed(1)} net.`,
    },
    {
      key: "equity",
      label: "Okullar arası eşitlik",
      shortLabel: "Eşitlik",
      score: schoolEquity.score,
      detail: `Okul netleri P10–P90 aralığı ${schoolEquity.gap.toFixed(1)}.`,
    },
    {
      key: "studentEquity",
      label: "Öğrenci eşitliği",
      shortLabel: "Öğrenci",
      score: equity.score,
      detail: `İl genelinde öğrenci net sapması ${equity.stdDev.toFixed(1)}.`,
    },
  ];

  const compositeScore = clampScore(
    dimensions.reduce((sum, dim) => sum + dim.score, 0) / dimensions.length,
  );
  const traffic = trafficFromScore(compositeScore);
  const provinceAvg = input.provinceAvgNet ?? 0;

  const flagged: ProvinceSchoolFlag[] = input.schools.map((school) => {
    const vs = school.avgNet != null ? Math.round((school.avgNet - provinceAvg) * 100) / 100 : null;
    const score = clampScore(50 + (vs ?? 0) * 8);
    const schoolTraffic = trafficFromScore(score);
    return {
      id: school.id,
      name: school.name,
      avgNet: school.avgNet,
      vsProvince: vs,
      traffic: schoolTraffic,
      compositeScore: score,
      flag: schoolTraffic === "guclu" ? "basari" : schoolTraffic === "izle" ? "izle" : "mudahale",
    };
  });

  const rankedSubjects = [...input.subjects]
    .filter((row) => row.avgNet != null)
    .sort((a, b) => (b.avgNet ?? 0) - (a.avgNet ?? 0));

  const urgentSchools = flagged.filter((row) => row.flag === "mudahale");
  const interventions: EvaluationIntervention[] = [];
  if (urgentSchools.length) {
    interventions.push({
      priority: "yuksek",
      title: `${urgentSchools.length} okul müdahale bandında`,
      detail: urgentSchools
        .slice(0, 4)
        .map((row) => row.name)
        .join(", "),
    });
  }
  if (vsPrevious != null && vsPrevious <= -2) {
    interventions.push({
      priority: "yuksek",
      title: "İl genelinde gerileme",
      detail: "Son süreç değerlendirme il ortalaması önceki sınavın altında. Ders ve okul röntgeni birlikte okunmalı.",
    });
  }
  if (schoolEquity.score < 45) {
    interventions.push({
      priority: "orta",
      title: "Okullar arası makas geniş",
      detail: "Başarılı okulların uygulamaları zayıf okullarla paylaşılmalı.",
    });
  }

  return {
    compositeScore,
    traffic,
    dimensions,
    equity,
    vsPrevious,
    successSchools: flagged.filter((row) => row.flag === "basari").slice(0, 8),
    watchSchools: flagged.filter((row) => row.flag === "izle").slice(0, 8),
    urgentSchools: urgentSchools.slice(0, 8),
    strongSubjects: rankedSubjects.slice(0, 3),
    weakSubjects: rankedSubjects.slice(-3).reverse(),
    interventions,
  };
}
