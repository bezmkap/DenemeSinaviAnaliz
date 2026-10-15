import { createHash } from "crypto";
import {
  asTextCode,
  calculateNet,
  calculateExamScore,
  netsDiffer,
  normalizeStudentIdentity,
  parseClassPlacement,
  parseNumber,
  type ExamType,
  type SubjectDef,
  SUBJECTS_BY_EXAM,
  type ExamArea,
} from "@/lib/domain";
import { parseSubjectHeader, type HeaderCell } from "@/lib/import/headers";
import { getImporter, type ColumnMapping, type MappingIssue } from "@/lib/import/importers";
import { readTopluSonucSheet, type RawRow } from "@/lib/import/workbook";
import {
  mergeAnswerKeys,
  normalizeBooklet,
  normalizeExamArea,
  keyLengthOk,
  requiredKeyIssues,
  scoreAnswers,
} from "@/lib/import/answers";

export type PreviewRow = {
  excelRow: number;
  studentNo: string;
  fullName: string;
  institutionCode: string;
  grade: string;
  section: string;
  score: number | null;
  subjects: Record<
    string,
    {
      correct: number;
      wrong: number;
      blank: number;
      sourceNet: number | null;
      calculatedNet: number;
      mismatch: boolean;
      answers?: string;
    }
  >;
  booklet: string;
  examArea: ExamArea | null;
  totalCorrect: number;
  totalWrong: number;
  totalBlank: number;
  sourceNet: number | null;
  calculatedNet: number;
  netMismatch: boolean;
  ranks: Record<string, number | null>;
  errors: string[];
};

export type PreviewResult = {
  fileHash: string;
  sheetName: string;
  examType: ExamType;
  headers: HeaderCell[];
  mapping: ColumnMapping;
  mappingIssues: MappingIssue[];
  rows: PreviewRow[];
  validCount: number;
  errorCount: number;
  mismatchCount: number;
  formulaLabel: string;
};

function col(row: RawRow, index: number | undefined): unknown {
  if (index == null) return "";
  return row.values[index] ?? "";
}

export function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function fillPlacementGaps(rows: PreviewRow[]) {
  const fields = [
    ["grade", "Sınıf boş."],
    ["section", "Şube boş."],
    ["institutionCode", "Kurum kodu boş."],
  ] as const;
  for (const [field, error] of fields) {
    let last = "";
    for (const row of rows) {
      if (row[field]) last = row[field];
      else if (last) {
        row[field] = last;
        row.errors = row.errors.filter((message) => message !== error);
      }
    }
    last = "";
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const row = rows[i];
      if (row[field]) last = row[field];
      else if (last) {
        row[field] = last;
        row.errors = row.errors.filter((message) => message !== error);
      }
    }
  }
}

export function applyMappingToRow(
  row: RawRow,
  mapping: ColumnMapping,
  examType: ExamType,
  carry?: { grade: string; section: string; institutionCode: string },
): PreviewRow {
  const identity = normalizeStudentIdentity(
    col(row, mapping.studentNo),
    col(row, mapping.fullName),
    row.excelRow,
  );
  const studentNo = identity.studentNo;
  const fullName = identity.fullName;
  const parsedClass = parseClassPlacement(col(row, mapping.grade), col(row, mapping.section));
  const grade = parsedClass.grade || carry?.grade || "";
  const section = parsedClass.section || carry?.section || "";
  const institutionCode =
    asTextCode(col(row, mapping.institutionCode)) || carry?.institutionCode || "";
  const booklet = normalizeBooklet(col(row, mapping.booklet));
  const examArea = examType === "AYT" ? normalizeExamArea(col(row, mapping.examArea)) : null;
  const errors: string[] = [];

  if (identity.summary) errors.push("Özet satır.");
  if (!studentNo) errors.push("Öğrenci numarası boş.");
  if (!fullName) errors.push("Ad soyad boş.");
  if (!institutionCode) errors.push("Kurum kodu boş.");
  if (!grade) errors.push("Sınıf boş.");

  const subjects: PreviewRow["subjects"] = {};
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalBlank = 0;
  let sourceNetSum = 0;
  let sourceNetPresent = false;
  const answerFormat = mapping.format === "answers";

  for (const mapped of mapping.subjects) {
    if (!mapped.confirmed) continue;
    let correct = 0;
    let wrong = 0;
    let blank = 0;
    let sourceNet: number | null = mapped.n != null ? parseNumber(col(row, mapped.n)) : null;
    let answers: string | undefined;
    if (answerFormat || mapped.answers != null) {
      const def = SUBJECTS_BY_EXAM[examType].find((row) => row.code === mapped.subjectCode);
      const questionCount = def?.questionCount ?? 0;
      const key = mapping.answerKeys?.[booklet]?.[mapped.subjectCode] ?? "";
      const scored = scoreAnswers(col(row, mapped.answers), key, questionCount);
      answers = scored.answers;
      if (keyLengthOk(key, questionCount)) {
        correct = scored.correct;
        wrong = scored.wrong;
        blank = scored.blank;
      } else {
        correct = 0;
        wrong = 0;
        blank = questionCount;
      }
      sourceNet = null;
    } else {
      correct = parseNumber(col(row, mapped.d)) ?? 0;
      wrong = parseNumber(col(row, mapped.y)) ?? 0;
      blank = parseNumber(col(row, mapped.b)) ?? 0;
    }
    const calculatedNet = calculateNet(correct, wrong, examType);
    const mismatch = netsDiffer(sourceNet, calculatedNet);
    subjects[mapped.subjectCode] = {
      correct,
      wrong,
      blank,
      sourceNet,
      calculatedNet,
      mismatch,
      answers,
    };
    totalCorrect += correct;
    totalWrong += wrong;
    totalBlank += blank;
    if (sourceNet != null) {
      sourceNetSum += sourceNet;
      sourceNetPresent = true;
    }
  }

  const subjectNets = Object.fromEntries(
    Object.entries(subjects).map(([code, subject]) => [code, subject.calculatedNet]),
  );
  const score = calculateExamScore(examType, subjectNets);
  const calculatedNet = calculateNet(totalCorrect, totalWrong, examType);
  const sourceNet = sourceNetPresent ? Math.round(sourceNetSum * 100) / 100 : null;

  return {
    excelRow: row.excelRow,
    studentNo,
    fullName,
    institutionCode,
    grade,
    section,
    booklet,
    examArea,
    score,
    subjects,
    totalCorrect,
    totalWrong,
    totalBlank,
    sourceNet,
    calculatedNet,
    netMismatch: netsDiffer(sourceNet, calculatedNet),
    ranks: {
      general: parseNumber(col(row, mapping.rankGeneral)),
      city: parseNumber(col(row, mapping.rankCity)),
      district: parseNumber(col(row, mapping.rankDistrict)),
      school: parseNumber(col(row, mapping.rankSchool)),
      class: parseNumber(col(row, mapping.rankClass)),
      countGeneral: parseNumber(col(row, mapping.countGeneral)),
      countCity: parseNumber(col(row, mapping.countCity)),
      countDistrict: parseNumber(col(row, mapping.countDistrict)),
      countSchool: parseNumber(col(row, mapping.countSchool)),
      countClass: parseNumber(col(row, mapping.countClass)),
    },
    errors,
  };
}

export function mappingReady(
  mapping: ColumnMapping,
  examType: ExamType,
): MappingIssue[] {
  const importer = getImporter(examType);
  const { issues } = importer.suggestMapping([]);
  void issues;
  const out: MappingIssue[] = [];
  if (mapping.studentNo == null) out.push({ level: "error", message: "Öğrenci numarası sütunu seçilmedi." });
  if (mapping.fullName == null) out.push({ level: "error", message: "Ad soyad sütunu seçilmedi." });
  if (mapping.institutionCode == null) out.push({ level: "error", message: "Kurum kodu sütunu seçilmedi." });
  if (mapping.grade == null) out.push({ level: "error", message: "Sınıf sütunu seçilmedi." });
  if (mapping.section == null) {
    out.push({
      level: "warning",
      message: "Şube sütunu seçilmedi; sınıf hücresindeki 8-A / 8A yazımlarından şube okunur.",
    });
  }

  const unconfirmed = mapping.subjects.filter((s) => s.needsConfirmation && !s.confirmed);
  for (const subject of unconfirmed) {
    out.push({
      level: "error",
      message: `${subject.label} sütunları kullanıcı onayı olmadan içe aktarılamaz.`,
    });
  }

  const confirmed = new Set(mapping.subjects.filter((s) => s.confirmed).map((s) => s.subjectCode));
  const required: SubjectDef[] = SUBJECTS_BY_EXAM[examType];
  for (const subject of required) {
    if (!confirmed.has(subject.code)) {
      out.push({
        level: "error",
        message: `${subject.name} dersi eşlenmedi.`,
      });
    }
  }
  if (mapping.format === "answers") {
    const keyIssues = requiredKeyIssues(
      examType,
      mapping.booklets ?? ["A"],
      mapping.answerKeys,
      [...confirmed],
    );
    if (keyIssues.length) {
      out.push({
        level: "warning",
        message:
          "Cevap anahtarı henüz yok. Öğrenci cevapları kaydedilir; şık, kazanım ve A/B karşılıkları yüklemeden sonra Cevap anahtarı sayfasından girilir.",
      });
    }
  }
  return out;
}

export async function buildPreview(options: {
  buffer: Buffer;
  examType: ExamType;
  mappingOverride?: ColumnMapping;
}): Promise<PreviewResult> {
  const importer = getImporter(options.examType);
  importer.assertReady();
  const { headers, rows, sheetName, answerKeys } = await readTopluSonucSheet(
    options.buffer,
    options.examType,
  );
  const suggested = importer.suggestMapping(headers);
  const mapping = options.mappingOverride ?? suggested.mapping;
  mapping.format = mapping.format ?? suggested.mapping.format;
  const booklets = [
    ...new Set(rows.map((row) => normalizeBooklet(col(row, mapping.booklet ?? suggested.mapping.booklet)))),
  ].sort();
  mapping.booklets = booklets;
  mapping.answerKeys = mergeAnswerKeys(answerKeys, mapping.answerKeys);
  const mappingIssues = options.mappingOverride
    ? mappingReady(mapping, options.examType)
    : [
        ...suggested.issues,
        ...(mapping.format === "answers"
          ? requiredKeyIssues(
              options.examType,
              booklets,
              mapping.answerKeys,
              mapping.subjects.filter((subject) => subject.confirmed).map((subject) => subject.subjectCode),
            ).length
            ? [
                {
                  level: "warning" as const,
                  message:
                    "Cevap anahtarı henüz yok. Öğrenci cevapları kaydedilir; şık, kazanım ve A/B karşılıkları yüklemeden sonra Cevap anahtarı sayfasından girilir.",
                },
              ]
            : []
          : []),
      ];
  const prefixes = headers
    .map((header) => parseSubjectHeader(header.folded)?.prefix)
    .filter((prefix): prefix is string => Boolean(prefix));
  const looksLikeAyt = prefixes.some((prefix) => prefix.startsWith("ayt") && prefix !== "aytgenel");
  const looksLikeTyt =
    prefixes.some((prefix) => prefix.startsWith("tyt")) ||
    (prefixes.includes("sosyal") && prefixes.includes("turkce") && !looksLikeAyt);
  if (options.examType !== "AYT" && looksLikeAyt) {
    mappingIssues.unshift({
      level: "error",
      message: "Dosya AYT sütunları içeriyor. Sınav türünü AYT seçip yeniden okuyun.",
    });
  }
  if (options.examType === "AYT" && looksLikeTyt && !looksLikeAyt) {
    mappingIssues.unshift({
      level: "error",
      message: "Dosya TYT sütunları içeriyor. Sınav türünü TYT seçip yeniden okuyun.",
    });
  }
  if (options.examType === "AYT") {
    mappingIssues.push({
      level: "warning",
      message:
        "AYT puanı (sayısal, eşit ağırlık, sözel) yüklerken seçilen TYT netleriyle hesaplanır. TYT seçilmezse aynı yıldaki önceki TYT kullanılır; TYT'si olmayan öğrencide puan boş kalır.",
    });
  }
  const previewRows: PreviewRow[] = [];
  const carry = { grade: "", section: "", institutionCode: "" };
  for (const row of rows) {
    const mapped = applyMappingToRow(row, mapping, options.examType, carry);
    if (mapped.errors.includes("Özet satır.")) continue;
    if (mapped.grade) carry.grade = mapped.grade;
    if (mapped.section) carry.section = mapped.section;
    if (mapped.institutionCode) carry.institutionCode = mapped.institutionCode;
    previewRows.push(mapped);
  }
  fillPlacementGaps(previewRows);
  const institutionCounts = new Map<string, number>();
  for (const row of previewRows) {
    if (!row.institutionCode) continue;
    institutionCounts.set(row.institutionCode, (institutionCounts.get(row.institutionCode) ?? 0) + 1);
  }
  const majorityInstitution = [...institutionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (majorityInstitution) {
    for (const row of previewRows) {
      if (row.institutionCode) continue;
      row.institutionCode = majorityInstitution;
      row.errors = row.errors.filter((message) => message !== "Kurum kodu boş.");
    }
  }
  const errorCount = previewRows.filter((r) => r.errors.length > 0).length;
  const mismatchCount = previewRows.filter((r) => r.netMismatch).length;
  return {
    fileHash: hashBuffer(options.buffer),
    sheetName,
    examType: options.examType,
    headers,
    mapping,
    mappingIssues,
    rows: previewRows,
    validCount: previewRows.length - errorCount,
    errorCount,
    mismatchCount,
    formulaLabel:
      options.examType === "LGS" ? "Doğru − Yanlış / 3" : "Doğru − Yanlış / 4",
  };
}
