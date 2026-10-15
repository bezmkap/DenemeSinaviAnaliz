import type { ExamType, SubjectDef } from "@/lib/domain";
import { SUBJECTS_BY_EXAM } from "@/lib/domain";
import {
  detectImportFormat,
  groupAnswerColumns,
  groupSubjectColumns,
  matchField,
  matchSubjectPrefix,
  tytAmbiguousLabel,
  shouldSkipSubjectGroup,
  canonicalSubjectPrefix,
  type HeaderCell,
  type SubjectColumnGroup,
} from "@/lib/import/headers";
import type { AnswerKeySet } from "@/lib/import/answers";

export type MappedSubject = {
  subjectCode: string;
  label: string;
  d: number;
  y: number;
  b: number;
  n?: number;
  answers?: number;
  sourceHeaders: string[];
  confirmed: boolean;
  needsConfirmation: boolean;
  suggestion: string | null;
  occurrence: number;
  prefix: string;
};

export type ColumnMapping = {
  format?: "dybn" | "answers";
  booklet?: number;
  booklets?: string[];
  answerKeys?: AnswerKeySet;
  examArea?: number;
  studentNo?: number;
  fullName?: number;
  institutionCode?: number;
  grade?: number;
  section?: number;
  score?: number;
  rankGeneral?: number;
  rankCity?: number;
  rankDistrict?: number;
  rankSchool?: number;
  rankClass?: number;
  countGeneral?: number;
  countCity?: number;
  countDistrict?: number;
  countSchool?: number;
  countClass?: number;
  subjects: MappedSubject[];
};

export type MappingIssue = {
  level: "error" | "warning";
  message: string;
};

export type ExamImporter = {
  examType: ExamType;
  subjects: SubjectDef[];
  suggestMapping: (headers: HeaderCell[]) => {
    mapping: ColumnMapping;
    issues: MappingIssue[];
  };
  assertReady: () => void;
};

function baseFieldMapping(headers: HeaderCell[]): Omit<ColumnMapping, "subjects"> {
  const mapping: Omit<ColumnMapping, "subjects"> = {};
  for (const header of headers) {
    const field = matchField(header.folded);
    if (field && mapping[field as keyof typeof mapping] == null) {
      (mapping as Record<string, number>)[field] = header.index;
    }
  }
  return mapping;
}

function requiredFieldIssues(mapping: ColumnMapping): MappingIssue[] {
  const issues: MappingIssue[] = [];
  const required: Array<[keyof ColumnMapping, string]> = [
    ["studentNo", "öğrenci numarası"],
    ["fullName", "ad soyad"],
    ["institutionCode", "kurum kodu"],
    ["grade", "sınıf"],
  ];
  if (mapping.section == null && mapping.grade == null) {
    issues.push({
      level: "error",
      message: "Zorunlu sütun eşleşmedi: şube",
    });
  } else if (mapping.section == null) {
    issues.push({
      level: "warning",
      message: "Şube sütunu yok; sınıf sütunundaki 8-A / 8A yazımlarından şube okunur.",
    });
  }
  for (const [key, label] of required) {
    if (mapping[key] == null) {
      issues.push({
        level: "error",
        message: `Zorunlu sütun eşleşmedi: ${label}`,
      });
    }
  }
  return issues;
}

function mapGroups(
  headers: HeaderCell[],
  examType: ExamType,
  groups: SubjectColumnGroup[],
): MappedSubject[] {
  const subjects = SUBJECTS_BY_EXAM[examType];
  const used = new Set<string>();
  const prefixSeen = new Map<string, number>();
  const mapped: MappedSubject[] = [];

  for (const group of groups) {
    if (shouldSkipSubjectGroup(examType, group.prefix)) continue;
    if (group.d == null || group.y == null || group.b == null) continue;
    const sourceHeaders = headers
      .filter((h) => group.headerIndexes.includes(h.index))
      .map((h) => h.raw);
    const prefixCount = prefixSeen.get(group.prefix) ?? 0;
    prefixSeen.set(group.prefix, prefixCount + 1);
    const ambiguous =
      examType === "TYT" ? tytAmbiguousLabel(group.prefix, prefixCount) : null;
    let subjectCode = matchSubjectPrefix(
      canonicalSubjectPrefix(examType, group.prefix),
      subjects,
    );
    let needsConfirmation = false;
    let confirmed = true;
    let suggestion: string | null = null;
    let label = subjects.find((s) => s.code === subjectCode)?.name ?? group.prefix;

    if (ambiguous) {
      subjectCode = "matematik";
      needsConfirmation = true;
      confirmed = false;
      suggestion = ambiguous;
      label = ambiguous;
    } else if (subjectCode && used.has(subjectCode)) {
      needsConfirmation = true;
      confirmed = false;
      suggestion = `Yinelenen sütun grubu (${group.prefix})`;
      label = `${label} (yinelenen)`;
      subjectCode = subjectCode;
    } else if (!subjectCode) {
      needsConfirmation = true;
      confirmed = false;
      suggestion = "Ders eşlemesi belirsiz";
    }

    if (subjectCode && confirmed) used.add(subjectCode);

    mapped.push({
      subjectCode: subjectCode ?? group.prefix,
      label,
      d: group.d,
      y: group.y,
      b: group.b,
      n: group.n,
      sourceHeaders,
      confirmed,
      needsConfirmation,
      suggestion,
      occurrence: group.occurrence,
      prefix: group.prefix,
    });
  }
  return mapped;
}

function createImporter(examType: ExamType): ExamImporter {
  return {
    examType,
    subjects: SUBJECTS_BY_EXAM[examType],
    assertReady() {
      return;
    },
    suggestMapping(headers) {
      const format = detectImportFormat(headers);
      const mapping: ColumnMapping = {
        ...baseFieldMapping(headers),
        format,
        subjects:
          format === "answers"
            ? groupAnswerColumns(headers, examType).map((column) => ({
                subjectCode: column.subjectCode,
                label: SUBJECTS_BY_EXAM[examType].find((row) => row.code === column.subjectCode)?.name ?? column.raw,
                d: 0,
                y: 0,
                b: 0,
                answers: column.index,
                sourceHeaders: [column.raw],
                confirmed: true,
                needsConfirmation: false,
                suggestion: null,
                occurrence: 0,
                prefix: column.prefix,
              }))
            : mapGroups(headers, examType, groupSubjectColumns(headers)),
      };
      const issues = requiredFieldIssues(mapping);
      if (format === "answers" && mapping.booklet == null) {
        issues.push({
          level: "warning",
          message: "Kitapçık sütunu yok; tüm satırlar A kitapçığı kabul edilir.",
        });
      }
      for (const subject of mapping.subjects) {
        if (subject.needsConfirmation) {
          issues.push({
            level: "error",
            message: `${subject.sourceHeaders.join(", ") || subject.prefix}: ${subject.suggestion ?? "Onay gerekli"}`,
          });
        }
      }
      const confirmedCodes = new Set(
        mapping.subjects.filter((s) => s.confirmed).map((s) => s.subjectCode),
      );
      for (const subject of SUBJECTS_BY_EXAM[examType]) {
        if (!confirmedCodes.has(subject.code)) {
          issues.push({
            level: "warning",
            message: `${subject.name} sütunları otomatik eşleşmedi.`,
          });
        }
      }
      return { mapping, issues };
    },
  };
}

export const lgsImporter: ExamImporter = createImporter("LGS");
export const tytImporter: ExamImporter = createImporter("TYT");
export const aytImporter: ExamImporter = createImporter("AYT");

export const IMPORTERS: Record<ExamType, ExamImporter> = {
  LGS: lgsImporter,
  TYT: tytImporter,
  AYT: aytImporter,
};

export function getImporter(examType: ExamType): ExamImporter {
  return IMPORTERS[examType];
}
