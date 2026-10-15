import ExcelJS from "exceljs";
import { SUBJECTS_BY_EXAM, type ExamType } from "@/lib/domain";
import { workbookToBuffer } from "@/lib/import/workbook";

const LGS_HEADERS = [
  "Öğrenci No",
  "Ad Soyad",
  "Kurum Kodu",
  "Sınıf",
  "Şube",
  "turkce_D",
  "turkce_Y",
  "turkce_B",
  "turkce_N",
  "inkilap_D",
  "inkilap_Y",
  "inkilap_B",
  "inkilap_N",
  "din_D",
  "din_Y",
  "din_B",
  "din_N",
  "ingilizce_D",
  "ingilizce_Y",
  "ingilizce_B",
  "ingilizce_N",
  "matematik_D",
  "matematik_Y",
  "matematik_B",
  "matematik_N",
  "fen_D",
  "fen_Y",
  "fen_B",
  "fen_N",
  "Puan",
  "Genel_S",
  "İl_S",
  "İlçe_S",
  "Okul_S",
  "Sınıf_S",
  "Genel_K",
  "İl_K",
  "İlçe_K",
  "Okul_K",
  "Sınıf_K",
];

const TYT_HEADERS = [
  "Öğrenci No",
  "Ad Soyad",
  "Kurum Kodu",
  "Sınıf",
  "Şube",
  "turkce_D",
  "turkce_Y",
  "turkce_B",
  "turkce_N",
  "sosyal_D",
  "sosyal_Y",
  "sosyal_B",
  "sosyal_N",
  "sosyal_D",
  "sosyal_Y",
  "sosyal_B",
  "sosyal_N",
  "fen_D",
  "fen_Y",
  "fen_B",
  "fen_N",
  "Puan",
  "Genel_S",
  "İl_S",
  "İlçe_S",
  "Okul_S",
  "Sınıf_S",
  "Genel_K",
  "İl_K",
  "İlçe_K",
  "Okul_K",
  "Sınıf_K",
];

const AYT_HEADERS = [
  "No",
  "ad_soyad",
  "kurum",
  "sinif",
  "sube",
  "aytturkdili_D",
  "aytturkdili_Y",
  "aytturkdili_B",
  "aytturkdili_N",
  "ayttarih1_D",
  "ayttarih1_Y",
  "ayttarih1_B",
  "ayttarih1_N",
  "aytcografya1_D",
  "aytcografya1_Y",
  "aytcografya1_B",
  "aytcografya1_N",
  "ayttarih2_D",
  "ayttarih2_Y",
  "ayttarih2_B",
  "ayttarih2_N",
  "aytcografya2_D",
  "aytcografya2_Y",
  "aytcografya2_B",
  "aytcografya2_N",
  "aytfelsefe_D",
  "aytfelsefe_Y",
  "aytfelsefe_B",
  "aytfelsefe_N",
  "aytdin_D",
  "aytdin_Y",
  "aytdin_B",
  "aytdin_N",
  "aytmatematik_D",
  "aytmatematik_Y",
  "aytmatematik_B",
  "aytmatematik_N",
  "aytfizik_D",
  "aytfizik_Y",
  "aytfizik_B",
  "aytfizik_N",
  "aytkimya_D",
  "aytkimya_Y",
  "aytkimya_B",
  "aytkimya_N",
  "aytbiyoloji_D",
  "aytbiyoloji_Y",
  "aytbiyoloji_B",
  "aytbiyoloji_N",
  "aytgenel_D",
  "aytgenel_Y",
  "aytgenel_B",
  "aytgenel_N",
  "sayısal_Puan",
  "sayısal_Genel_s",
  "sayısal_İl_s",
  "sayısal_İlçe_s",
  "sayısal_Okul_s",
  "sayısal_Sınıf_s",
  "sozel_Puan",
  "sozel_Genel_s",
  "sozel_İl_s",
  "sozel_İlçe_s",
  "sozel_Okul_s",
  "sozel_Sınıf_s",
  "ea_Puan",
  "ea_Genel_s",
  "ea_İl_s",
  "ea_İlçe_s",
  "ea_Okul_s",
  "ea_Sınıf_s",
  "ayt_Genel_k",
  "ayt_İl_k",
  "ayt_İlçe_k",
  "ayt_Okul_k",
  "ayt_Sınıf_k",
];

export type SampleStudent = {
  studentNo: string;
  fullName: string;
  institutionCode: string;
  grade: string;
  section: string;
  subjects: number[][];
  score: number;
  ranks: number[];
};

function addTextRow(sheet: ExcelJS.Worksheet, values: unknown[]) {
  const row = sheet.addRow(values);
  row.eachCell((cell, colNumber) => {
    if ([1, 2, 3, 4, 5].includes(colNumber) && typeof cell.value === "string") {
      cell.numFmt = "@";
    }
  });
}

export async function buildLgsSample(students: SampleStudent[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("TopluSonuc");
  sheet.addRow(LGS_HEADERS);
  for (const student of students) {
    addTextRow(sheet, [
      student.studentNo,
      student.fullName,
      student.institutionCode,
      student.grade,
      student.section,
      ...student.subjects.flat(),
      student.score,
      ...student.ranks,
    ]);
  }
  return workbookToBuffer(workbook);
}

export async function buildTytSample(students: SampleStudent[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("TopluSonuc");
  sheet.addRow(TYT_HEADERS);
  for (const student of students) {
    addTextRow(sheet, [
      student.studentNo,
      student.fullName,
      student.institutionCode,
      student.grade,
      student.section,
      ...student.subjects.flat(),
      student.score,
      ...student.ranks,
    ]);
  }
  return workbookToBuffer(workbook);
}

export async function buildAytSample(students: SampleStudent[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("TopluSonuc");
  sheet.addRow(AYT_HEADERS);
  for (const student of students) {
    addTextRow(sheet, [
      student.studentNo,
      student.fullName,
      student.institutionCode,
      student.grade,
      student.section,
      ...student.subjects.flat(),
      0,
      0,
      0,
      0,
      student.score,
      ...student.ranks,
    ]);
  }
  return workbookToBuffer(workbook);
}

export function anonymousLgsStudent(
  overrides: Partial<SampleStudent> & Pick<SampleStudent, "studentNo" | "institutionCode">,
): SampleStudent {
  return {
    fullName: overrides.fullName ?? "Anonim 8A-01",
    grade: overrides.grade ?? "8",
    section: overrides.section ?? "A",
    subjects: overrides.subjects ?? [
      [14, 3, 3, 14],
      [7, 2, 1, 7],
      [8, 1, 1, 8],
      [6, 2, 2, 6],
      [12, 4, 4, 12],
      [13, 3, 4, 13],
    ],
    score: overrides.score ?? 412.5,
    ranks: overrides.ranks ?? [1200, 80, 20, 4, 2, 180000, 9000, 1200, 40, 20],
    studentNo: overrides.studentNo,
    institutionCode: overrides.institutionCode,
  };
}

export function anonymousTytStudent(
  overrides: Partial<SampleStudent> & Pick<SampleStudent, "studentNo" | "institutionCode">,
): SampleStudent {
  return {
    fullName: overrides.fullName ?? "Anonim 12A-01",
    grade: overrides.grade ?? "12",
    section: overrides.section ?? "A",
    subjects: overrides.subjects ?? [
      [28, 8, 4, 28],
      [12, 4, 4, 12],
      [22, 10, 8, 22],
      [11, 5, 4, 11],
    ],
    score: overrides.score ?? 368.2,
    ranks: overrides.ranks ?? [45000, 2100, 400, 8, 3, 1200000, 80000, 9000, 60, 30],
    studentNo: overrides.studentNo,
    institutionCode: overrides.institutionCode,
  };
}

export function anonymousAytStudent(
  overrides: Partial<SampleStudent> & Pick<SampleStudent, "studentNo" | "institutionCode">,
): SampleStudent {
  return {
    fullName: overrides.fullName ?? "Anonim 12A-01",
    grade: overrides.grade ?? "12",
    section: overrides.section ?? "A",
    subjects: overrides.subjects ?? [
      [16, 4, 4, 15],
      [6, 2, 2, 5.5],
      [4, 1, 1, 3.75],
      [5, 3, 3, 4.25],
      [6, 2, 3, 5.5],
      [7, 3, 2, 6.25],
      [4, 1, 1, 3.75],
      [22, 8, 10, 20],
      [8, 3, 3, 7.25],
      [7, 3, 3, 6.25],
      [8, 2, 3, 7.5],
    ],
    score: overrides.score ?? 412.8,
    ranks: overrides.ranks ?? [
      18000, 900, 120, 6, 2, 421.4, 42000, 2100, 300, 9, 4, 388.2, 25000, 1100, 180, 7, 3, 180000,
      12000, 1800, 40, 22,
    ],
    studentNo: overrides.studentNo,
    institutionCode: overrides.institutionCode,
  };
}

export function patternAnswerKey(length: number): string {
  return Array.from({ length }, (_, index) => "ABCDE"[index % 5]).join("");
}

export function answersFromCounts(key: string, correct: number, wrong: number, blank: number): string {
  return key
    .split("")
    .map((letter, index) => {
      if (index < correct) return letter;
      if (index < correct + wrong) return letter === "A" ? "B" : "A";
      return " ";
    })
    .join("");
}

const ANSWER_HEADERS: Record<ExamType, string[]> = {
  LGS: ["okul_no", "okul_kodu", "sinif", "sube", "ad_soyad", "kitapcik", "turkce", "sosyal", "din", "ing", "matematik", "fen"],
  TYT: ["okul_no", "okul_kodu", "sinif", "sube", "ad_soyad", "kitapcik", "turkce", "sosyal", "matematik", "fen"],
  AYT: [
    "okul_no",
    "okul_kodu",
    "sinif",
    "sube",
    "ad_soyad",
    "kitapcik",
    "alan",
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
  ],
};

export async function buildAnswerSheetSample(
  examType: ExamType,
  students: Array<SampleStudent & { booklet?: string; examArea?: string }>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const subjects = SUBJECTS_BY_EXAM[examType];
  const keys = Object.fromEntries(subjects.map((subject) => [subject.code, patternAnswerKey(subject.questionCount)]));
  const data = workbook.addWorksheet("Sayfa1");
  data.addRow(ANSWER_HEADERS[examType]);
  for (const student of students) {
    const booklet = student.booklet ?? "A";
    const answers = student.subjects.map((counts, index) =>
      answersFromCounts(keys[subjects[index].code], counts[0] ?? 0, counts[1] ?? 0, counts[2] ?? 0),
    );
    const baseRow = [
      student.studentNo,
      student.institutionCode,
      student.grade,
      student.section,
      student.fullName,
      booklet,
    ];
    
    // AYT için alan sütunu ekle
    if (examType === "AYT") {
      baseRow.push(student.examArea ?? "sayısal");
    }
    
    addTextRow(data, [...baseRow, ...answers]);
  }
  const keySheet = workbook.addWorksheet("CevapAnahtari");
  keySheet.addRow(["kitapcik", ...subjects.map((subject) => subject.code)]);
  addTextRow(keySheet, ["A", ...subjects.map((subject) => keys[subject.code])]);
  addTextRow(keySheet, ["B", ...subjects.map((subject) => keys[subject.code])]);
  return workbookToBuffer(workbook);
}
