import { foldTr, SUBJECTS_BY_EXAM, type ExamType, type SubjectDef } from "@/lib/domain";

export type HeaderCell = {
  index: number;
  raw: string;
  folded: string;
};

export type SubjectColumnGroup = {
  prefix: string;
  d?: number;
  y?: number;
  b?: number;
  n?: number;
  headerIndexes: number[];
  occurrence: number;
};

const FIELD_ALIASES: Record<string, string[]> = {
  studentNo: ["ogrencino", "ogrencinumara", "ogrencinumaras", "okulno", "no", "ogrno"],
  fullName: ["adsoyad", "advesoyad", "ogrenciadi", "adi", "ad"],
  institutionCode: ["kurumkodu", "okulkodu", "kurumkod", "okulkod", "kurum"],
  grade: ["sinif", "sinifi", "sinifduzeyi", "sinifsube"],
  section: ["sube", "subesi"],
  booklet: ["kitapcik", "kitapcikturu", "kitapciktipi", "form", "booklet"],
  examArea: ["alan", "alantipi", "alanturu", "sinavalani", "examarea"],
  score: [
    "puan",
    "toplampuan",
    "ykspuan",
    "lgspuan",
    "sayisalpuan",
    "sozelpuan",
    "eapuan",
  ],
  rankGeneral: ["genels", "genelsira", "sayisalgenels", "sozelgenels", "eagenels"],
  rankCity: ["ils", "ilsira", "sayisalils", "sozelils", "eails"],
  rankDistrict: ["ilces", "ilcesira", "sayisalilces", "sozelilces", "eailces"],
  rankSchool: ["okuls", "okulsira", "sayisalokuls", "sozelokuls", "eaokuls"],
  rankClass: ["sinifs", "sinifsira", "sayisalsinifs", "sozelsinifs", "easinifs"],
  countGeneral: ["genelk", "genelkatilim", "aytgenelk"],
  countCity: ["ilk", "ilkatilim", "aytilk"],
  countDistrict: ["ilcek", "ilcekatilim", "aytilcek"],
  countSchool: ["okulk", "okulkatilim", "aytokulk"],
  countClass: ["sinifk", "sinifkatilim", "aytsinifk"],
};

export function matchField(folded: string): string | null {
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(folded)) return field;
  }
  return null;
}

export function parseSubjectHeader(
  folded: string,
): { prefix: string; kind: "d" | "y" | "b" | "n" } | null {
  const match = folded.match(/^([a-z0-9]+?)(d|y|b|n)$/);
  if (!match) return null;
  return { prefix: match[1], kind: match[2] as "d" | "y" | "b" | "n" };
}

export function groupSubjectColumns(headers: HeaderCell[]): SubjectColumnGroup[] {
  const groups: SubjectColumnGroup[] = [];
  const seen = new Map<string, number>();

  for (const header of headers) {
    const parsed = parseSubjectHeader(header.folded);
    if (!parsed) continue;
    const occurrence = seen.get(parsed.prefix) ?? 0;
    const open = groups.find(
      (g) =>
        g.prefix === parsed.prefix &&
        g.occurrence === occurrence &&
        g[parsed.kind] == null,
    );
    if (open) {
      open[parsed.kind] = header.index;
      open.headerIndexes.push(header.index);
      if (open.d != null && open.y != null && open.b != null && open.n != null) {
        seen.set(parsed.prefix, occurrence + 1);
      }
      continue;
    }
    const nextOccurrence = occurrence;
    const group: SubjectColumnGroup = {
      prefix: parsed.prefix,
      occurrence: nextOccurrence,
      headerIndexes: [header.index],
    };
    group[parsed.kind] = header.index;
    groups.push(group);
  }
  return groups;
}

const SUBJECT_PREFIXES: Record<string, string[]> = {
  turkce: ["turkce", "turkce"],
  inkilap: ["inkilap", "inkilaptarihi", "tctarih", "inkilapttarih", "tarih", "sosyal", "sosyalbilgiler"],
  din: ["din", "dinkulturu", "dkab", "aytdin"],
  ingilizce: ["ingilizce", "ing", "yabancidil"],
  matematik: ["matematik", "temelmatematik", "mat", "aytmatematik"],
  sosyal: ["sosyal", "sosyalbilimler", "sos"],
  fen: ["fen", "fenbilimleri", "fend"],
  turkdili: ["turkdili", "aytturkdili", "edebiyat", "turkdiliveedebiyati"],
  tarih1: ["tarih1", "ayttarih1"],
  cografya1: ["cografya1", "aytcografya1"],
  tarih2: ["tarih2", "ayttarih2"],
  cografya2: ["cografya2", "aytcografya2"],
  felsefe: ["felsefe", "aytfelsefe", "felsefegrubu"],
  fizik: ["fizik", "aytfizik"],
  kimya: ["kimya", "aytkimya"],
  biyoloji: ["biyoloji", "aytbiyoloji"],
};

export function shouldSkipSubjectGroup(examType: ExamType, prefix: string): boolean {
  if (prefix === "aytgenel" || prefix === "tytgenel") return true;
  if (examType === "AYT") return prefix.startsWith("tyt");
  return prefix.startsWith("ayt");
}

export function canonicalSubjectPrefix(examType: ExamType, prefix: string): string {
  if (examType === "AYT" && prefix.startsWith("ayt") && prefix !== "aytgenel") {
    return prefix.slice(3);
  }
  return prefix;
}

export function matchSubjectPrefix(
  prefix: string,
  subjects: SubjectDef[],
): string | null {
  for (const subject of subjects) {
    const aliases = SUBJECT_PREFIXES[subject.code] ?? [subject.code];
    if (aliases.includes(prefix) || prefix.startsWith(subject.code)) {
      return subject.code;
    }
  }
  return null;
}

export function tytAmbiguousLabel(prefix: string, occurrence: number): string | null {
  if (prefix === "sosyal" && occurrence >= 1) return "Muhtemel Matematik";
  return null;
}

export type AnswerColumn = {
  subjectCode: string;
  prefix: string;
  index: number;
  raw: string;
};

export function detectImportFormat(headers: HeaderCell[]): "dybn" | "answers" {
  const groups = groupSubjectColumns(headers);
  const complete = groups.some((group) => group.d != null && group.y != null && group.b != null);
  if (complete) return "dybn";
  return "answers";
}

export function groupAnswerColumns(headers: HeaderCell[], examType: ExamType): AnswerColumn[] {
  const subjects = SUBJECTS_BY_EXAM[examType];
  const used = new Set<string>();
  const columns: AnswerColumn[] = [];
  for (const header of headers) {
    if (matchField(header.folded)) continue;
    if (shouldSkipSubjectGroup(examType, header.folded)) continue;
    const prefix = canonicalSubjectPrefix(examType, header.folded);
    const subjectCode = matchSubjectPrefix(prefix, subjects);
    if (!subjectCode || used.has(subjectCode)) continue;
    used.add(subjectCode);
    columns.push({
      subjectCode,
      prefix: header.folded,
      index: header.index,
      raw: header.raw,
    });
  }
  return columns;
}

export function examHasSubject(examType: ExamType, code: string): boolean {
  if (examType === "LGS") {
    return ["turkce", "inkilap", "din", "ingilizce", "matematik", "fen"].includes(
      code,
    );
  }
  if (examType === "TYT") {
    return ["turkce", "sosyal", "matematik", "fen"].includes(code);
  }
  if (examType === "AYT") {
    return [
      "turkdili",
      "tarih1",
      "cografya1",
      "tarih2",
      "cografya2",
      "felsefe",
      "din",
      "matematik",
      "fizik",
      "kimya",
      "biyoloji",
    ].includes(code);
  }
  return false;
}

export { foldTr };
