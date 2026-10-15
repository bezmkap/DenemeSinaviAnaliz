export type ExamType = "LGS" | "TYT" | "AYT";
export type InstitutionType = "ortaokul" | "lise";
export type Role = "system_admin" | "district_admin" | "school_user";

export const ROLES: Role[] = ["system_admin", "district_admin", "school_user"];

export function parseRole(value: unknown): Role {
  if (value === "system_admin" || value === "district_admin") return value;
  return "school_user";
}

export function isSystemAdmin(role: Role): boolean {
  return role === "system_admin";
}

export function isDistrictAdmin(role: Role): boolean {
  return role === "district_admin";
}

export function canOpenNetworkHome(role: Role): boolean {
  return role === "system_admin" || role === "district_admin";
}

export function homePathForRole(role: Role): string {
  return canOpenNetworkHome(role) ? "/il-analizi" : "/panel";
}
export type UploadStatus = "previewed" | "committed" | "rolled_back" | "rejected";

export const EXAM_TYPES: ExamType[] = ["LGS", "TYT", "AYT"];
export const INSTITUTION_TYPES: InstitutionType[] = ["ortaokul", "lise"];

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  ortaokul: "Ortaokul",
  lise: "Lise",
};

export const SUGGESTED_EXAM_TYPES: Record<InstitutionType, ExamType[]> = {
  ortaokul: ["LGS"],
  lise: ["TYT", "AYT"],
};

export function normalizeInstitutionTypes(
  types?: InstitutionType[],
  fallback?: InstitutionType,
): InstitutionType[] {
  const unique: InstitutionType[] = [];
  for (const value of types ?? []) {
    if (!INSTITUTION_TYPES.includes(value) || unique.includes(value)) continue;
    unique.push(value);
  }
  unique.sort((a, b) => INSTITUTION_TYPES.indexOf(a) - INSTITUTION_TYPES.indexOf(b));
  if (unique.length) return unique;
  if (fallback && INSTITUTION_TYPES.includes(fallback)) return [fallback];
  return [];
}

export function institutionTypesOf(inst: {
  type?: InstitutionType;
  types?: InstitutionType[];
}): InstitutionType[] {
  return normalizeInstitutionTypes(inst.types, inst.type);
}

export function institutionHasType(
  inst: { type?: InstitutionType; types?: InstitutionType[] },
  type: InstitutionType,
): boolean {
  return institutionTypesOf(inst).includes(type);
}

export function formatInstitutionTypes(inst: {
  type?: InstitutionType;
  types?: InstitutionType[];
}): string {
  return institutionTypesOf(inst)
    .map((type) => INSTITUTION_TYPE_LABELS[type])
    .join(", ");
}

export function suggestedExamTypesFor(types: InstitutionType[]): ExamType[] {
  const exams: ExamType[] = [];
  if (types.includes("ortaokul")) exams.push("LGS");
  if (types.includes("lise")) exams.push("TYT", "AYT");
  return exams;
}

/** Ortaokul yalnız LGS, lise yalnız TYT/AYT. AYT açıksa TYT de açık kalır. */
export function sanitizeExamTypes(
  institutionTypes: InstitutionType[],
  requested?: ExamType[],
): ExamType[] {
  const allowed = suggestedExamTypesFor(institutionTypes);
  const picked = (requested ?? []).filter((exam) => allowed.includes(exam));
  const exams = new Set(picked.length ? picked : allowed);
  if (exams.has("AYT") && allowed.includes("TYT")) exams.add("TYT");
  return EXAM_TYPES.filter((exam) => exams.has(exam));
}

export function examTypeAllowedForInstitution(
  inst: { type?: InstitutionType; types?: InstitutionType[] },
  examType: ExamType,
): boolean {
  return suggestedExamTypesFor(institutionTypesOf(inst)).includes(examType);
}

export type AnalysisModuleDef = {
  slug: string;
  name: string;
  navLabel: string;
  description: string;
};

export const ANALYSIS_MODULES: AnalysisModuleDef[] = [
  {
    slug: "okul-ozeti",
    name: "Okul özeti",
    navLabel: "Okul özeti",
    description: "Son sınav, gelişim ve okul içi özet göstergeler",
  },
  {
    slug: "olcme-degerlendirme",
    name: "Ölçme ve değerlendirme",
    navLabel: "Ölçme & değerlendirme",
    description: "Okul röntgeni: başarı, ilerleme, eşitlik ve ders dengesi",
  },
  {
    slug: "sinav-analizi",
    name: "Sınav analizi",
    navLabel: "Sınav analizi",
    description: "Seçilen süreç değerlendirmenin okul geneli kırılımı",
  },
  {
    slug: "ogrenci-sonuclari",
    name: "Öğrenci sonuçları",
    navLabel: "Öğrenci sonuçları",
    description: "Öğrenci bazlı sonuç ve dönem içi değişim",
  },
  {
    slug: "sinif-karsilastirma",
    name: "Sınıf karşılaştırması",
    navLabel: "Sınıf",
    description: "Sınıf düzeylerinin birbirine göre durumu",
  },
  {
    slug: "sube-karsilastirma",
    name: "Şube karşılaştırması",
    navLabel: "Şube",
    description: "Şubelerin net ve puan karşılaştırması",
  },
  {
    slug: "ders-analizi",
    name: "Ders analizi",
    navLabel: "Ders analizi",
    description: "Ders bazında doğru, yanlış, boş ve net",
  },
  {
    slug: "dybn-analizi",
    name: "Doğru, yanlış, boş ve net",
    navLabel: "D / Y / B / net",
    description: "Okul geneli D/Y/B/N dağılımı",
  },
  {
    slug: "soru-analizi",
    name: "Soru analizi",
    navLabel: "Soru analizi",
    description: "Soru bazında doğru, yanlış, boş, güçlük ve şık dağılımı",
  },
  {
    slug: "puan-dagilim",
    name: "Puan dağılımı",
    navLabel: "Puan dağılımı",
    description: "Puan aralıkları ve okul içi sıralama",
  },
  {
    slug: "sinavlar-arasi-gelisim",
    name: "Sınavlar arası gelişim",
    navLabel: "Sınavlar arası",
    description: "Süreç değerlendirmeler boyunca okul ortalamasının seyri",
  },
  {
    slug: "ogrenci-performans",
    name: "Performans değişimi",
    navLabel: "Performans değişimi",
    description: "Öğrencilerin sınavlar arasındaki net değişimi",
  },
  {
    slug: "basari-sirasi",
    name: "Okul içi başarı sırası",
    navLabel: "Başarı sırası",
    description: "Seçilen sınavda okul içi sıralama",
  },
  {
    slug: "risk-analizi",
    name: "Risk ve erken uyarı",
    navLabel: "Risk ve uyarı",
    description: "Tahminsel analitik ile risk altındaki öğrencileri tespit",
  },
  {
    slug: "gelisim-trendi",
    name: "Trend ve tahmin",
    navLabel: "Trend ve tahmin",
    description: "Zamana dayalı gelişim analizi ve performans projeksiyonları",
  },
  {
    slug: "akran-karsilastirma",
    name: "Akran karşılaştırması",
    navLabel: "Akran grubu",
    description: "Benzer özelliklerdeki öğrencilerle karşılaştırmalı analiz",
  },
  {
    slug: "sinif-detay-analizi",
    name: "Sınıf ve şube detayı",
    navLabel: "Sınıf detayı",
    description: "Isı haritası ve dağılım grafikleri ile derinlemesine sınıf analizi",
  },
  {
    slug: "ogrenci-profili",
    name: "Öğrenci profili",
    navLabel: "Öğrenci profili",
    description: "Öğrenci bazlı detaylı performans ve gelişim takibi",
  },
  {
    slug: "mudahale-onerileri",
    name: "Müdahale önerileri",
    navLabel: "Müdahale önerileri",
    description: "Veriye dayalı aksiyon önerileri ve destek planları",
  },
];

export const MODULE_GROUPS: Array<{ id: string; label: string; slugs: string[] }> = [
  { id: "ozet", label: "Özet", slugs: ["okul-ozeti", "olcme-degerlendirme", "sinav-analizi"] },
  {
    id: "karsilastirma",
    label: "Karşılaştırma",
    slugs: ["sinif-karsilastirma", "sube-karsilastirma", "sinif-detay-analizi", "akran-karsilastirma"],
  },
  { id: "ders", label: "Ders ve dağılım", slugs: ["ders-analizi", "dybn-analizi", "soru-analizi", "puan-dagilim"] },
  {
    id: "ogrenci",
    label: "Öğrenci",
    slugs: ["ogrenci-sonuclari", "basari-sirasi", "ogrenci-performans", "ogrenci-profili"],
  },
  { id: "gelisim", label: "Gelişim", slugs: ["sinavlar-arasi-gelisim", "gelisim-trendi"] },
  { id: "destek", label: "Destek", slugs: ["risk-analizi", "mudahale-onerileri"] },
];

export function withKurum(href: string, institutionId?: string | null) {
  if (!institutionId) return href;
  return `${href}${href.includes("?") ? "&" : "?"}kurum=${institutionId}`;
}

export function panelPath(slug: string, institutionId?: string | null) {
  const base = slug === "okul-ozeti" ? "/panel" : `/panel/${slug}`;
  return withKurum(base, institutionId);
}

const PANEL_QUERY_KEEP = ["kurum", "yil", "tur", "sinav", "puan", "alan", "baslangic", "bitis", "il", "ilce", "ders"] as const;

export function withKeptQuery(href: string, query: { get: (key: string) => string | null }) {
  const [path, existing] = href.split("?");
  const params = new URLSearchParams(existing ?? "");
  for (const key of PANEL_QUERY_KEEP) {
    if (params.has(key)) continue;
    const value = query.get(key);
    if (value) params.set(key, value);
  }
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export const DEFAULT_OPEN_MODULE = "okul-ozeti";

export const IL_ANALIZI_SLUG = "il-analizi";

export const IL_ANALIZI_MODULE: AnalysisModuleDef = {
  slug: IL_ANALIZI_SLUG,
  name: "İl analizi",
  navLabel: "İl analizi",
  description: "İlin akademik durumunu okul, ders, şube ve sınıf kırılımıyla görür",
};

export const IL_ANALYSIS_MODULES: AnalysisModuleDef[] = [
  {
    slug: "genel",
    name: "Genel karşılaştırma",
    navLabel: "Genel",
    description: "İl geneli özet, okul sayısı ve ortalama net",
  },
  {
    slug: "olcme-degerlendirme",
    name: "Ölçme ve değerlendirme",
    navLabel: "Ölçme & değerlendirme",
    description: "İl röntgeni: başarı, eşitlik ve müdahale bandı",
  },
  {
    slug: "ders",
    name: "Ders analizi",
    navLabel: "Ders analizi",
    description: "İl genelinde ders netleri ve en güçlü / zayıf okullar",
  },
  {
    slug: "okul",
    name: "Kurum analizi",
    navLabel: "Kurum analizi",
    description: "Okulların ortalama net ve puan karşılaştırması",
  },
  {
    slug: "sube",
    name: "Şube analizi",
    navLabel: "Şube",
    description: "Okul, sınıf ve şube bazında ortalama net",
  },
  {
    slug: "sinif",
    name: "Sınıf karşılaştırması",
    navLabel: "Sınıf",
    description: "Okul ve sınıf düzeyinde ortalama net",
  },
  {
    slug: "il",
    name: "İl ve ilçe",
    navLabel: "İl / ilçe",
    description: "İl ve ilçe kırılımı",
  },
  {
    slug: "soru",
    name: "Soru analizi",
    navLabel: "Soru analizi",
    description: "Kapsamdaki öğrencilerde soru bazında doğru sayısı, yüzde ve kazanım",
  },
  {
    slug: "sirala",
    name: "Başarı sıralaması",
    navLabel: "Başarı sırası",
    description: "Okulların il içi net sıralaması",
  },
  {
    slug: "gelisim",
    name: "Sınavlar arası gelişim",
    navLabel: "Gelişim",
    description: "Süreç değerlendirmeler boyunca il ve okul ortalamasının seyri",
  },
];

export const IL_MODULE_GROUPS: Array<{ id: string; label: string; slugs: string[] }> = [
  { id: "ozet", label: "Özet", slugs: ["genel", "olcme-degerlendirme"] },
  { id: "karsilastirma", label: "Karşılaştırma", slugs: ["okul", "sinif", "sube", "sirala"] },
  { id: "ders", label: "Ders ve yer", slugs: ["ders", "il", "soru"] },
  { id: "gelisim", label: "Gelişim", slugs: ["gelisim"] },
];

export const DEFAULT_IL_MODULE = "genel";

export function ilAnaliziPath(slug: string) {
  return slug === DEFAULT_IL_MODULE ? "/il-analizi" : `/il-analizi/${slug}`;
}

export type SubjectDef = {
  code: string;
  name: string;
  questionCount: number;
  sortOrder: number;
};

export const LGS_SUBJECTS: SubjectDef[] = [
  { code: "turkce", name: "Türkçe", questionCount: 20, sortOrder: 1 },
  {
    code: "inkilap",
    name: "T.C. İnkılap Tarihi ve Atatürkçülük",
    questionCount: 10,
    sortOrder: 2,
  },
  {
    code: "din",
    name: "Din Kültürü ve Ahlak Bilgisi",
    questionCount: 10,
    sortOrder: 3,
  },
  { code: "ingilizce", name: "İngilizce", questionCount: 10, sortOrder: 4 },
  { code: "matematik", name: "Matematik", questionCount: 20, sortOrder: 5 },
  { code: "fen", name: "Fen Bilimleri", questionCount: 20, sortOrder: 6 },
];

export const TYT_SUBJECTS: SubjectDef[] = [
  { code: "turkce", name: "Türkçe", questionCount: 40, sortOrder: 1 },
  { code: "sosyal", name: "Sosyal Bilimler", questionCount: 20, sortOrder: 2 },
  { code: "matematik", name: "Temel Matematik", questionCount: 40, sortOrder: 3 },
  { code: "fen", name: "Fen Bilimleri", questionCount: 20, sortOrder: 4 },
];

export const AYT_SUBJECTS: SubjectDef[] = [
  { code: "turkdili", name: "Türk Dili ve Edebiyatı", questionCount: 24, sortOrder: 1 },
  { code: "tarih1", name: "Tarih-1", questionCount: 10, sortOrder: 2 },
  { code: "cografya1", name: "Coğrafya-1", questionCount: 6, sortOrder: 3 },
  { code: "tarih2", name: "Tarih-2", questionCount: 11, sortOrder: 4 },
  { code: "cografya2", name: "Coğrafya-2", questionCount: 11, sortOrder: 5 },
  { code: "felsefe", name: "Felsefe Grubu", questionCount: 12, sortOrder: 6 },
  { code: "din", name: "Din Kültürü ve Ahlak Bilgisi", questionCount: 6, sortOrder: 7 },
  { code: "matematik", name: "Matematik", questionCount: 40, sortOrder: 8 },
  { code: "fizik", name: "Fizik", questionCount: 14, sortOrder: 9 },
  { code: "kimya", name: "Kimya", questionCount: 13, sortOrder: 10 },
  { code: "biyoloji", name: "Biyoloji", questionCount: 13, sortOrder: 11 },
];

export const SUBJECTS_BY_EXAM: Record<ExamType, SubjectDef[]> = {
  LGS: LGS_SUBJECTS,
  TYT: TYT_SUBJECTS,
  AYT: AYT_SUBJECTS,
};

export type NetRule = {
  divisor: number;
  formulaLabel: string;
};

export const NET_RULES: Record<ExamType, NetRule> = {
  LGS: { divisor: 3, formulaLabel: "Doğru − Yanlış / 3" },
  TYT: { divisor: 4, formulaLabel: "Doğru − Yanlış / 4" },
  AYT: { divisor: 4, formulaLabel: "Doğru − Yanlış / 4" },
};

export function calculateNet(
  correct: number,
  wrong: number,
  examType: ExamType,
): number {
  const divisor = NET_RULES[examType].divisor;
  const net = correct - wrong / divisor;
  return Math.round(net * 100) / 100;
}

/** MEB LGS katsayıları: Türkçe/Mat/Fen 4, diğerleri 1. */
export const LGS_SCORE_WEIGHTS: Record<string, number> = {
  turkce: 4,
  matematik: 4,
  fen: 4,
  inkilap: 1,
  din: 1,
  ingilizce: 1,
};

/** ÖSYM TYT yerleştirme katsayıları (net × katsayı + taban). */
export const TYT_NET_COEFFICIENTS: Record<string, number> = {
  turkce: 2.841,
  sosyal: 3.136,
  matematik: 2.877,
  fen: 3.128,
};

export const TYT_BASE_SCORE = 145;

export type AytScoreType = "say" | "ea" | "soz";

export const AYT_SCORE_TYPE_LABELS: Record<AytScoreType, string> = {
  say: "Sayısal",
  ea: "Eşit ağırlık",
  soz: "Sözel",
};

type AytTrackCoefficients = {
  base: number;
  tyt: Record<string, number>;
  ayt: Record<string, number>;
};

/** ÖSYM AYT yerleştirme katsayıları: taban + TYT netleri + AYT netleri. */
export const AYT_TRACK_COEFFICIENTS: Record<AytScoreType, AytTrackCoefficients> = {
  say: {
    base: 125.218,
    tyt: { turkce: 1.196, sosyal: 1.321, matematik: 1.211, fen: 1.318 },
    ayt: { matematik: 2.59, fizik: 3.187, kimya: 2.947, biyoloji: 3.11 },
  },
  ea: {
    base: 127.258,
    tyt: { turkce: 1.221, sosyal: 1.348, matematik: 1.237, fen: 1.346 },
    ayt: { turkdili: 3.208, tarih1: 3.328, cografya1: 2.277, matematik: 2.644 },
  },
  soz: {
    base: 127.421,
    tyt: { turkce: 1.155, sosyal: 1.275, matematik: 1.17, fen: 1.272 },
    ayt: {
      turkdili: 3.034,
      tarih1: 3.148,
      cografya1: 2.154,
      tarih2: 3.513,
      cografya2: 2.215,
      felsefe: 3.895,
      din: 2.931,
    },
  },
};

export type AytScores = { say: number; ea: number; soz: number };

export const SCORE_NORM_YEAR = 2026;

export type TestNorm = { mean: number; std: number };

/**
 * 2026 LGS Türkiye net ortalamaları (MEB Merkezî Sınav Raporu madde güçlüğü × soru)
 * ve güvenirlik katsayılarından türetilen ham puan sapmaları.
 */
export const LGS_2026_NORMS: Record<string, TestNorm> = {
  turkce: { mean: 9.4, std: 5.3 },
  inkilap: { mean: 5.3, std: 3.6 },
  din: { mean: 6.3, std: 2.9 },
  ingilizce: { mean: 4.4, std: 4.5 },
  matematik: { mean: 5.6, std: 5.4 },
  fen: { mean: 9.0, std: 6.2 },
};

/** 2026 YKS sayısal bilgiler — tüm adaylar (ÖSYM, 21 Temmuz 2026). */
export const TYT_2026_NORMS: Record<string, TestNorm> = {
  turkce: { mean: 20.1, std: 8.3 },
  sosyal: { mean: 10.0, std: 4.0 },
  matematik: { mean: 6.4, std: 7.5 },
  fen: { mean: 3.9, std: 5.0 },
};

export const AYT_2026_NORMS: Record<string, TestNorm> = {
  turkdili: { mean: 6.5, std: 5.4 },
  tarih1: { mean: 2.9, std: 2.9 },
  cografya1: { mean: 1.9, std: 1.8 },
  tarih2: { mean: 1.9, std: 2.5 },
  cografya2: { mean: 2.4, std: 2.7 },
  felsefe: { mean: 1.8, std: 2.2 },
  din: { mean: 2.0, std: 2.2 },
  matematik: { mean: 7.1, std: 8.9 },
  fizik: { mean: 2.6, std: 3.6 },
  kimya: { mean: 2.1, std: 3.6 },
  biyoloji: { mean: 3.0, std: 3.6 },
};

function standardScore(net: number, norm: TestNorm): number {
  if (!(norm.std > 0)) return 50;
  return 50 + (10 * (net - norm.mean)) / norm.std;
}

function taspFromNets(
  nets: Record<string, number>,
  weights: Record<string, number>,
  norms: Record<string, TestNorm>,
  subjects: SubjectDef[],
): number {
  let tasp = 0;
  for (const [code, weight] of Object.entries(weights)) {
    const questionCount = subjects.find((subject) => subject.code === code)?.questionCount ?? 0;
    if (questionCount <= 0) continue;
    const norm = norms[code] ?? { mean: questionCount / 2, std: Math.max(1, questionCount / 4) };
    tasp += weight * standardScore(nets[code] ?? 0, norm);
  }
  return tasp;
}

function taspAtFill(
  fill: (code: string, questionCount: number) => number,
  weights: Record<string, number>,
  norms: Record<string, TestNorm>,
  subjects: SubjectDef[],
): number {
  const nets: Record<string, number> = {};
  for (const code of Object.keys(weights)) {
    const questionCount = subjects.find((subject) => subject.code === code)?.questionCount ?? 0;
    nets[code] = fill(code, questionCount);
  }
  return taspFromNets(nets, weights, norms, subjects);
}

/** LGS: 2026 Türkiye net ortalaması bu puana gelir; tam net 500'e çekilir. TYT/AYT katsayı formülü kullanır. */
export const SCORE_AT_2026_MEAN: Record<ExamType, number> = {
  LGS: 300,
  TYT: 200,
  AYT: 200,
};

export function clampPlacementScore(value: number): number {
  const clamped = Math.max(0, Math.min(500, value));
  const rounded = Math.round(clamped * 10) / 10;
  if (rounded >= 499) {
    return 500;
  }
  return rounded;
}

function weightedNets(coefficients: Record<string, number>, nets: Record<string, number>): number {
  let total = 0;
  for (const [code, coefficient] of Object.entries(coefficients)) {
    total += coefficient * (nets[code] ?? 0);
  }
  return total;
}

function scoreWithNorms(
  nets: Record<string, number>,
  weights: Record<string, number>,
  norms: Record<string, TestNorm>,
  subjects: SubjectDef[],
  meanScore: number,
): number {
  const tasp = taspFromNets(nets, weights, norms, subjects);
  const taspMean = taspAtFill(
    (code) => norms[code]?.mean ?? 0,
    weights,
    norms,
    subjects,
  );
  const taspMax = taspAtFill(
    (_code, questionCount) => questionCount,
    weights,
    norms,
    subjects,
  );
  if (taspMax <= taspMean) return meanScore;
  const raw = meanScore + ((500 - meanScore) * (tasp - taspMean)) / (taspMax - taspMean);
  return Math.round(Math.max(100, Math.min(500, raw)) * 10) / 10;
}

export function calculateTytScore(subjectNets: Record<string, number>): number {
  return clampPlacementScore(TYT_BASE_SCORE + weightedNets(TYT_NET_COEFFICIENTS, subjectNets));
}

export function calculateAytTrackScore(
  type: AytScoreType,
  aytNets: Record<string, number>,
  tytNets: Record<string, number>,
): number {
  const track = AYT_TRACK_COEFFICIENTS[type];
  return clampPlacementScore(
    track.base + weightedNets(track.tyt, tytNets) + weightedNets(track.ayt, aytNets),
  );
}

export function calculateAytScores(
  aytNets: Record<string, number>,
  tytNets: Record<string, number>,
): AytScores {
  return {
    say: calculateAytTrackScore("say", aytNets, tytNets),
    ea: calculateAytTrackScore("ea", aytNets, tytNets),
    soz: calculateAytTrackScore("soz", aytNets, tytNets),
  };
}

export function bestAytScore(scores: AytScores): number {
  return Math.max(scores.say, scores.ea, scores.soz);
}

export function calculateExamScore(
  examType: "LGS" | "TYT",
  subjectNets: Record<string, number>,
  tytNets?: Record<string, number> | null,
): number;
export function calculateExamScore(
  examType: ExamType,
  subjectNets: Record<string, number>,
  tytNets?: Record<string, number> | null,
): number | null;
export function calculateExamScore(
  examType: ExamType,
  subjectNets: Record<string, number>,
  tytNets?: Record<string, number> | null,
): number | null {
  if (examType === "LGS") {
    return scoreWithNorms(
      subjectNets,
      LGS_SCORE_WEIGHTS,
      LGS_2026_NORMS,
      LGS_SUBJECTS,
      SCORE_AT_2026_MEAN.LGS,
    );
  }
  if (examType === "TYT") {
    return calculateTytScore(subjectNets);
  }
  if (!tytNets) return null;
  return bestAytScore(calculateAytScores(subjectNets, tytNets));
}

export function subjectNetsFromResults(
  rows: Array<{ subjectCode: string; calculatedNet: number }>,
): Record<string, number> {
  const nets: Record<string, number> = {};
  for (const row of rows) {
    nets[row.subjectCode] = row.calculatedNet;
  }
  return nets;
}

export function netsDiffer(sourceNet: number | null, calculatedNet: number): boolean {
  if (sourceNet == null || Number.isNaN(sourceNet)) return false;
  return Math.abs(sourceNet - calculatedNet) > 0.051;
}

export function foldTr(value: string): string {
  return value
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function asTextCode(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return Number.isInteger(value) ? String(value) : String(value);
  }
  return String(value).trim();
}

export function cleanImportText(value: unknown): string {
  return asTextCode(value)
    .replace(/\u0000/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PLACEHOLDER_LABEL = /^[\s*#?._\-–—]+$/;
const EXCEL_ERROR_LABEL = /^#(N\/A|VALUE!|REF!|NAME\?|NULL!|DIV\/0!|NUM!|GETTING_DATA)$/i;

export function isPlaceholderLabel(value: string): boolean {
  const text = value.trim();
  if (!text) return true;
  if (EXCEL_ERROR_LABEL.test(text)) return true;
  return PLACEHOLDER_LABEL.test(text);
}

export function isSummaryImportRow(name: string, studentNo: string): boolean {
  const foldedName = foldTr(name);
  const foldedNo = foldTr(studentNo);
  const summary = /^(toplam|geneltoplam|genel|ortalama|ort|sinifortalamasi|okulortalamasi|ogrencisayisi)$/;
  return summary.test(foldedName) || summary.test(foldedNo);
}

function strippedStudentNo(text: string): string {
  if (!text || isPlaceholderLabel(text)) return "";
  const compact = text.replace(/[*#?\s]/g, "").trim();
  if (!compact || isPlaceholderLabel(compact)) return "";
  return compact;
}

function strippedPersonName(text: string): string {
  const cleaned = text.replace(/[*#]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned || isPlaceholderLabel(cleaned)) return "";
  return cleaned;
}

/** OCR/Excel'de * , bozuk karakter veya boş ad-numara satırlarını içe aktarılabilir hale getirir. */
export function normalizeStudentIdentity(
  studentNoRaw: unknown,
  fullNameRaw: unknown,
  excelRow: number,
): { studentNo: string; fullName: string; summary: boolean } {
  const cleanedNo = cleanImportText(studentNoRaw);
  const cleanedName = cleanImportText(fullNameRaw);
  if (isSummaryImportRow(cleanedName, cleanedNo)) {
    return { studentNo: cleanedNo, fullName: cleanedName, summary: true };
  }
  const studentNo = strippedStudentNo(cleanedNo) || `SATIR-${excelRow}`;
  const fullName = strippedPersonName(cleanedName) || `Adsız ${studentNo}`;
  return { studentNo, fullName, summary: false };
}

export function normalizeSection(value: unknown): string {
  const parsed = parsePlacementPart(value);
  return parsed.section;
}

function parsePlacementPart(value: unknown): { grade: string; section: string } {
  const text = asTextCode(value)
    .replace(/^şube\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return { grade: "", section: "" };
  const match = text.match(
    /^(\d{1,2})(?:[.,]0+)?(?:\s*\.?\s*s[ıiİI]n[ıiİI]f)?(?:\s*[-/._]?\s*([A-Za-zÇĞİÖŞÜçğıöşü]+))?$/i,
  );
  if (match) {
    return {
      grade: String(Number(match[1])),
      section: match[2] ? match[2].toLocaleUpperCase("tr-TR") : "",
    };
  }
  return { grade: "", section: text.toLocaleUpperCase("tr-TR") };
}

/** Excel'de 8 / 8.0 / 8A / 8-A / 8. Sınıf gibi yazımları tek sınıfa indirir. */
export function parseClassPlacement(
  gradeRaw: unknown,
  sectionRaw: unknown = "",
): { grade: string; section: string } {
  const fromGrade = parsePlacementPart(gradeRaw);
  const fromSection = parsePlacementPart(sectionRaw);
  return {
    grade: fromGrade.grade || fromSection.grade,
    section: fromSection.section || fromGrade.section,
  };
}

export function classKeyOf(student: { grade: string; section: string }): {
  grade: string;
  section: string;
} {
  return parseClassPlacement(student.grade, student.section);
}

export function normalizeInstitutionCode(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function institutionCodesEqual(a: string, b: string): boolean {
  const left = normalizeInstitutionCode(a);
  const right = normalizeInstitutionCode(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const numeric = (value: string) => /^\d+$/.test(value);
  if (!numeric(left) || !numeric(right)) return false;
  const strip = (value: string) => value.replace(/^0+/, "") || "0";
  return strip(left) === strip(right);
}

export function schoolLoginEmail(code: string): string {
  return `${normalizeInstitutionCode(code).toLocaleLowerCase("tr-TR")}@okul.local`;
}

export function districtLoginEmail(city: string, district: string): string {
  return `${foldTr(district)}.${foldTr(city)}@ilce.local`;
}

export function normalizePlaceName(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

export function placesEqual(left: string, right: string): boolean {
  const a = normalizePlaceName(left);
  const b = normalizePlaceName(right);
  return Boolean(a) && a === b;
}

export function institutionInDistrict(
  inst: { city: string; district: string },
  city: string,
  district: string,
): boolean {
  return placesEqual(inst.city, city) && placesEqual(inst.district, district);
}

export function findInstitutionByCode<T extends { code: string }>(
  institutions: T[],
  code: string,
): T | undefined {
  const wanted = normalizeInstitutionCode(code);
  if (!wanted) return undefined;
  return (
    institutions.find((row) => row.code === wanted) ??
    institutions.find((row) => institutionCodesEqual(row.code, wanted))
  );
}

export function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export type Institution = {
  id: string;
  code: string;
  name: string;
  city: string;
  district: string;
  type: InstitutionType;
  types: InstitutionType[];
  examTypePermissions: ExamType[];
  createdAt: string;
};

export type UserAccount = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  passwordHash: string;
  city?: string | null;
  district?: string | null;
  createdAt: string;
};

export type Membership = {
  id: string;
  userId: string;
  institutionId: string;
};

export type AcademicYear = {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
};

export function sortAcademicYears(years: AcademicYear[]): AcademicYear[] {
  return [...years].sort(
    (a, b) => b.startsOn.localeCompare(a.startsOn) || b.label.localeCompare(a.label, "tr"),
  );
}

export function preferredAcademicYear(years: AcademicYear[]): AcademicYear | undefined {
  return years.find((year) => year.isActive) ?? sortAcademicYears(years)[0];
}

function shiftIsoDateYear(iso: string, deltaYears: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const year = Number(match[1]) + deltaYears;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const shifted = new Date(Date.UTC(year, month - 1, day));
  if (shifted.getUTCMonth() !== month - 1) {
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  }
  return shifted.toISOString().slice(0, 10);
}

export function suggestNextAcademicYear(years: AcademicYear[]): {
  label: string;
  startsOn: string;
  endsOn: string;
} {
  const latest = sortAcademicYears(years)[0];
  if (!latest) {
    return { label: "2025-2026", startsOn: "2025-09-08", endsOn: "2026-06-19" };
  }
  const match = latest.label.match(/^(\d{4})-(\d{4})$/);
  const start = match ? Number(match[1]) + 1 : Number(latest.startsOn.slice(0, 4)) + 1;
  return {
    label: `${start}-${start + 1}`,
    startsOn: shiftIsoDateYear(latest.startsOn, 1),
    endsOn: shiftIsoDateYear(latest.endsOn, 1),
  };
}

export type InstitutionModulePermission = {
  id: string;
  institutionId: string;
  moduleSlug: string;
  examType: ExamType;
  enabled: boolean;
};

export const ANSWER_KEY_CAPABILITY = "answer_keys";

export type CapabilityGrant = {
  id: string;
  capability: typeof ANSWER_KEY_CAPABILITY;
  kind: "school" | "district";
  institutionId?: string | null;
  city?: string | null;
  district?: string | null;
};

export type AnswerKeySet = Record<string, Record<string, string>>;

export type QuestionSpec = {
  answer: string;
  outcome: string;
  /** İptal edilen soru herkese doğru sayılır. */
  cancelled?: boolean;
};

export type QuestionKeySet = Record<string, Record<string, QuestionSpec[]>>;

/** Diğer kitapçık soru no'su: bookletLinks[B][turkce][9] = 20 → A 10. soru = B 20. soru */
export type BookletLinkSet = Record<string, Record<string, number[]>>;

export type ExamSitting = {
  id: string;
  examType: ExamType;
  name: string;
  examDate: string;
  academicYearId: string;
  publisher: string;
  examCode: string;
  createdBy: string;
  createdAt: string;
  tytSittingId?: string | null;
  answerKeys?: AnswerKeySet;
  questionKeys?: QuestionKeySet;
  bookletLinks?: BookletLinkSet;
};

export type Student = {
  id: string;
  institutionId: string;
  academicYearId: string;
  sourceStudentNo: string;
  fullName: string;
  grade: string;
  section: string;
};

export type ExamArea = "sayisal" | "sozel" | "esit_agirlik";

export const EXAM_AREA_LABELS: Record<ExamArea, string> = {
  sayisal: "Sayısal",
  sozel: "Sözel",
  esit_agirlik: "Eşit Ağırlık",
};

export type ExamResult = {
  id: string;
  studentId: string;
  examSittingId: string;
  institutionId: string;
  uploadId: string;
  totalCorrect: number;
  totalWrong: number;
  totalBlank: number;
  sourceNet: number | null;
  calculatedNet: number;
  score: number | null;
  scoreSay: number | null;
  scoreEa: number | null;
  scoreSoz: number | null;
  rankGeneral: number | null;
  rankCity: number | null;
  rankDistrict: number | null;
  rankSchool: number | null;
  rankClass: number | null;
  countGeneral: number | null;
  countCity: number | null;
  countDistrict: number | null;
  countSchool: number | null;
  countClass: number | null;
  booklet?: string | null;
  examArea?: ExamArea | null;
};

export type SubjectResult = {
  id: string;
  resultId: string;
  subjectCode: string;
  correct: number;
  wrong: number;
  blank: number;
  sourceNet: number | null;
  calculatedNet: number;
  answers?: string | null;
};

export type UploadRecord = {
  id: string;
  examSittingId: string | null;
  uploadedBy: string;
  fileName: string;
  fileHash: string;
  status: UploadStatus;
  examType: ExamType;
  rowCount: number;
  validCount: number;
  errorCount: number;
  createdAt: string;
  committedAt: string | null;
  rolledBackAt: string | null;
};

export type UploadError = {
  id: string;
  uploadId: string;
  rowNumber: number;
  message: string;
};

export type AuditLog = {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  institutionId: string | null;
  institutionName: string | null;
  moduleSlug: string | null;
  examType: ExamType | null;
  oldValue: string | null;
  newValue: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  institutionIds: string[];
  city?: string | null;
  district?: string | null;
  canEditAnswerKeys?: boolean;
};

export type AnalysisFilters = {
  academicYearId?: string;
  examType?: ExamType;
  examSittingId?: string;
  scoreTrack?: "genel" | "say" | "ea" | "soz";
  examArea?: ExamArea;
  dateFrom?: string;
  dateTo?: string;
  grade?: string;
  section?: string;
  subjectCode?: string;
  studentId?: string;
  city?: string;
  district?: string;
};

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type StudentRiskProfile = {
  studentId: string;
  studentNo: string;
  name: string;
  grade: string;
  section: string;
  riskLevel: RiskLevel;
  riskScore: number;
  factors: RiskFactor[];
  trend: "improving" | "stable" | "declining";
  lastExamNet: number;
  avgNet: number;
  netChange: number;
  interventionPriority: number;
};

export type RiskFactor = {
  type: "attendance" | "performance" | "consistency" | "engagement";
  severity: "low" | "medium" | "high";
  description: string;
  impact: number;
};

export type StudentGrowthProjection = {
  studentId: string;
  currentNet: number;
  projectedNet: number;
  confidenceInterval: [number, number];
  growthRate: number;
  projectionBasis: "linear" | "exponential" | "polynomial";
  nextExamEstimate: number;
};

export type PeerGroup = {
  groupId: string;
  criteria: string;
  studentCount: number;
  avgNet: number;
  avgScore: number;
  performanceRange: [number, number];
  topPerformers: string[];
};

export type InterventionRecommendation = {
  studentId: string;
  studentName: string;
  priority: "urgent" | "high" | "medium" | "low";
  recommendationType: "academic" | "behavioral" | "social-emotional" | "general";
  title: string;
  description: string;
  specificActions: string[];
  expectedOutcome: string;
  timeframe: string;
};
