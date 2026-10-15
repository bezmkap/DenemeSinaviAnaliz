import { randomUUID } from "crypto";
import {
  ANALYSIS_MODULES,
  IL_ANALIZI_SLUG,
  bestAytScore,
  calculateAytScores,
  calculateExamScore,
  calculateNet,
  type ExamType,
  type Institution,
  SUBJECTS_BY_EXAM,
} from "@/lib/domain";
import { hashPassword, type AppState } from "@/lib/store/app-store";

const YEAR_ID = "year-2025-2026";
const INST_A = "inst-a";
const INST_B = "inst-b";
const INST_C = "inst-c";
const USER_ADMIN = "user-admin";
const USER_ADMIN_BULENT = "user-admin-bulent";
const USER_A = "user-a";
const USER_B = "user-b";
const USER_C = "user-c";
const USER_DISTRICT_CANKAYA = "user-district-cankaya";

export const DEMO_PASSWORD = "Demo1234!";
export const ADMIN_BULENT_EMAIL = "bulent@demo.okul";
export const ADMIN_BULENT_PASSWORD = "20002020";
export const DEMO_IDS = {
  YEAR_ID,
  INST_A,
  INST_B,
  INST_C,
  USER_ADMIN,
  USER_ADMIN_BULENT,
  USER_A,
  USER_B,
  USER_C,
  USER_DISTRICT_CANKAYA,
};

function permissionsFor(
  institutionId: string,
  examTypes: ExamType[],
  enabledSlugs: string[],
) {
  const rows = [];
  for (const examType of examTypes) {
    for (const mod of ANALYSIS_MODULES) {
      rows.push({
        id: `${institutionId}-${mod.slug}-${examType}`,
        institutionId,
        moduleSlug: mod.slug,
        examType,
        enabled: enabledSlugs.includes(mod.slug),
      });
    }
    rows.push({
      id: `${institutionId}-${IL_ANALIZI_SLUG}-${examType}`,
      institutionId,
      moduleSlug: IL_ANALIZI_SLUG,
      examType,
      enabled: enabledSlugs.includes(IL_ANALIZI_SLUG),
    });
  }
  return rows;
}

function subjectBundle(
  examType: ExamType,
  resultId: string,
  values: Record<string, { d: number; y: number; b: number }>,
) {
  return SUBJECTS_BY_EXAM[examType].map((subject) => {
    const v = values[subject.code] ?? { d: 0, y: 0, b: 0 };
    const calculatedNet = calculateNet(v.d, v.y, examType);
    return {
      id: randomUUID(),
      resultId,
      subjectCode: subject.code,
      correct: v.d,
      wrong: v.y,
      blank: v.b,
      sourceNet: v.d,
      calculatedNet,
    };
  });
}

function netsFromValues(
  examType: ExamType,
  values: Record<string, { d: number; y: number }>,
) {
  const nets: Record<string, number> = {};
  for (const [code, row] of Object.entries(values)) {
    nets[code] = calculateNet(row.d, row.y, examType);
  }
  return nets;
}

function scoreFromValues(
  examType: ExamType,
  values: Record<string, { d: number; y: number }>,
) {
  return calculateExamScore(examType, netsFromValues(examType, values));
}

export function buildDemoState(): AppState {
  const now = "2026-03-20T09:00:00.000Z";
  const institutions: Institution[] = [
    {
      id: INST_A,
      code: "000101",
      name: "Atatürk Ortaokulu",
      city: "Ankara",
      district: "Çankaya",
      type: "ortaokul",
      types: ["ortaokul"],
      examTypePermissions: ["LGS"],
      createdAt: now,
    },
    {
      id: INST_B,
      code: "000202",
      name: "Cumhuriyet Anadolu Lisesi",
      city: "İzmir",
      district: "Konak",
      type: "lise",
      types: ["lise"],
      examTypePermissions: ["TYT", "AYT"],
      createdAt: now,
    },
    {
      id: INST_C,
      code: "000303",
      name: "Mehmet Akif Ortaokulu",
      city: "Bursa",
      district: "Osmangazi",
      type: "ortaokul",
      types: ["ortaokul"],
      examTypePermissions: ["LGS"],
      createdAt: now,
    },
  ];

  const hash = hashPassword(DEMO_PASSWORD);
  const bulentHash = hashPassword(ADMIN_BULENT_PASSWORD);
  const studentsA = [
    { no: "00001", name: "Anonim 8A-01", grade: "8", section: "A" },
    { no: "00002", name: "Anonim 8A-02", grade: "8", section: "A" },
    { no: "00003", name: "Anonim 8A-03", grade: "8", section: "A" },
    { no: "00004", name: "Anonim 8B-01", grade: "8", section: "B" },
    { no: "00005", name: "Anonim 8B-02", grade: "8", section: "B" },
    { no: "00006", name: "Anonim 8B-03", grade: "8", section: "B" },
  ].map((s) => ({
    id: `stu-a-${s.no}`,
    institutionId: INST_A,
    academicYearId: YEAR_ID,
    sourceStudentNo: s.no,
    fullName: s.name,
    grade: s.grade,
    section: s.section,
  }));

  const studentsB = [
    { no: "00011", name: "Anonim 12A-01", grade: "12", section: "A" },
    { no: "00012", name: "Anonim 12A-02", grade: "12", section: "A" },
    { no: "00013", name: "Anonim 12B-01", grade: "12", section: "B" },
    { no: "00014", name: "Anonim 12B-02", grade: "12", section: "B" },
  ].map((s) => ({
    id: `stu-b-${s.no}`,
    institutionId: INST_B,
    academicYearId: YEAR_ID,
    sourceStudentNo: s.no,
    fullName: s.name,
    grade: s.grade,
    section: s.section,
  }));

  const studentsC = [
    { no: "00021", name: "Anonim 8A-21", grade: "8", section: "A" },
    { no: "00022", name: "Anonim 8A-22", grade: "8", section: "A" },
    { no: "00023", name: "Anonim 8C-21", grade: "8", section: "C" },
    { no: "00024", name: "Anonim 8C-22", grade: "8", section: "C" },
  ].map((s) => ({
    id: `stu-c-${s.no}`,
    institutionId: INST_C,
    academicYearId: YEAR_ID,
    sourceStudentNo: s.no,
    fullName: s.name,
    grade: s.grade,
    section: s.section,
  }));

  const sittings = [
    {
      id: "sit-lgs-1",
      examType: "LGS" as const,
      name: "Ekim LGS Süreç Değerlendirmesi",
      examDate: "2025-10-12",
      academicYearId: YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-LGS-2025-10",
      createdBy: USER_ADMIN,
      createdAt: now,
    },
    {
      id: "sit-lgs-2",
      examType: "LGS" as const,
      name: "Aralık LGS Süreç Değerlendirmesi",
      examDate: "2025-12-07",
      academicYearId: YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-LGS-2025-12",
      createdBy: USER_ADMIN,
      createdAt: now,
    },
    {
      id: "sit-lgs-3",
      examType: "LGS" as const,
      name: "Mart LGS Süreç Değerlendirmesi",
      examDate: "2026-03-15",
      academicYearId: YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-LGS-2026-03",
      createdBy: USER_ADMIN,
      createdAt: now,
    },
    {
      id: "sit-tyt-1",
      examType: "TYT" as const,
      name: "Kasım TYT Süreç Değerlendirmesi",
      examDate: "2025-11-16",
      academicYearId: YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-TYT-2025-11",
      createdBy: USER_ADMIN,
      createdAt: now,
    },
    {
      id: "sit-tyt-2",
      examType: "TYT" as const,
      name: "Şubat TYT Süreç Değerlendirmesi",
      examDate: "2026-02-08",
      academicYearId: YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-TYT-2026-02",
      createdBy: USER_ADMIN,
      createdAt: now,
    },
    {
      id: "sit-ayt-1",
      examType: "AYT" as const,
      name: "Mart AYT Süreç Değerlendirmesi",
      examDate: "2026-03-22",
      academicYearId: YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-AYT-2026-03",
      createdBy: USER_ADMIN,
      createdAt: now,
      tytSittingId: "sit-tyt-2",
    },
  ];

  const results: AppState["results"] = [];
  const subjectResults: AppState["subjectResults"] = [];

  const lgsPattern = [
    { d: 11, y: 5, b: 4 },
    { d: 13, y: 4, b: 3 },
    { d: 15, y: 3, b: 2 },
  ];

  studentsA.forEach((student, studentIndex) => {
    sittings
      .filter((s) => s.examType === "LGS")
      .forEach((sitting, examIndex) => {
        const bump = examIndex + (studentIndex % 3);
        const turkce = {
          d: Math.min(20, lgsPattern[examIndex].d + (studentIndex % 2)),
          y: Math.max(0, lgsPattern[examIndex].y - (studentIndex === 5 && examIndex === 2 ? -3 : 0)),
          b: 2,
        };
        turkce.b = 20 - turkce.d - turkce.y;
        const values = {
          turkce,
          inkilap: { d: 6 + examIndex, y: 2, b: 2 - examIndex },
          din: { d: 7 + (examIndex > 0 ? 1 : 0), y: 1, b: 2 },
          ingilizce: { d: 5 + examIndex, y: 3, b: 2 },
          matematik: {
            d: Math.min(20, 9 + bump),
            y: Math.max(1, 6 - examIndex),
            b: 3,
          },
          fen: { d: Math.min(20, 10 + bump), y: 4 - examIndex, b: 3 },
        };
        for (const key of Object.keys(values) as (keyof typeof values)[]) {
          const subjectDef = SUBJECTS_BY_EXAM.LGS.find((s) => s.code === key)!;
          const row = values[key];
          row.b = Math.max(0, subjectDef.questionCount - row.d - row.y);
        }
        const totals = Object.values(values).reduce(
          (acc, v) => ({
            d: acc.d + v.d,
            y: acc.y + v.y,
            b: acc.b + v.b,
          }),
          { d: 0, y: 0, b: 0 },
        );
        const id = `res-${sitting.id}-${student.id}`;
        results.push({
          id,
          studentId: student.id,
          examSittingId: sitting.id,
          institutionId: INST_A,
          uploadId: "seed-lgs",
          totalCorrect: totals.d,
          totalWrong: totals.y,
          totalBlank: totals.b,
          sourceNet: totals.d,
          calculatedNet: calculateNet(totals.d, totals.y, "LGS"),
          score: scoreFromValues("LGS", values),
          scoreSay: null,
          scoreEa: null,
          scoreSoz: null,
          rankGeneral: 8000 + studentIndex * 400 - examIndex * 500,
          rankCity: 400 + studentIndex * 20,
          rankDistrict: 80 + studentIndex * 4,
          rankSchool: studentIndex + 1,
          rankClass: (studentIndex % 3) + 1,
          countGeneral: 180000,
          countCity: 9000,
          countDistrict: 1200,
          countSchool: 6,
          countClass: 3,
        });
        subjectResults.push(...subjectBundle("LGS", id, values));
      });
  });

  studentsC.forEach((student, studentIndex) => {
    sittings
      .filter((s) => s.examType === "LGS")
      .forEach((sitting, examIndex) => {
        const bump = examIndex + (studentIndex % 2);
        const values = {
          turkce: { d: Math.min(20, 9 + bump), y: 6, b: 3 },
          inkilap: { d: 5 + examIndex, y: 3, b: 2 },
          din: { d: 6 + examIndex, y: 2, b: 2 },
          ingilizce: { d: 4 + examIndex, y: 4, b: 2 },
          matematik: { d: Math.min(20, 7 + bump), y: 7 - examIndex, b: 4 },
          fen: { d: Math.min(20, 8 + bump), y: 5, b: 4 },
        };
        for (const key of Object.keys(values) as (keyof typeof values)[]) {
          const subjectDef = SUBJECTS_BY_EXAM.LGS.find((s) => s.code === key)!;
          const row = values[key];
          row.b = Math.max(0, subjectDef.questionCount - row.d - row.y);
        }
        const totals = Object.values(values).reduce(
          (acc, v) => ({
            d: acc.d + v.d,
            y: acc.y + v.y,
            b: acc.b + v.b,
          }),
          { d: 0, y: 0, b: 0 },
        );
        const id = `res-${sitting.id}-${student.id}`;
        results.push({
          id,
          studentId: student.id,
          examSittingId: sitting.id,
          institutionId: INST_C,
          uploadId: "seed-lgs",
          totalCorrect: totals.d,
          totalWrong: totals.y,
          totalBlank: totals.b,
          sourceNet: totals.d,
          calculatedNet: calculateNet(totals.d, totals.y, "LGS"),
          score: scoreFromValues("LGS", values),
          scoreSay: null,
          scoreEa: null,
          scoreSoz: null,
          rankGeneral: 14000 + studentIndex * 500 - examIndex * 400,
          rankCity: 700 + studentIndex * 25,
          rankDistrict: 120 + studentIndex * 5,
          rankSchool: studentIndex + 1,
          rankClass: (studentIndex % 2) + 1,
          countGeneral: 180000,
          countCity: 6000,
          countDistrict: 800,
          countSchool: 4,
          countClass: 2,
        });
        subjectResults.push(...subjectBundle("LGS", id, values));
      });
  });

  studentsB.forEach((student, studentIndex) => {
    sittings
      .filter((s) => s.examType === "TYT")
      .forEach((sitting, examIndex) => {
        const values = {
          turkce: { d: 24 + examIndex * 2 + studentIndex, y: 8, b: 4 },
          sosyal: { d: 11 + examIndex, y: 5, b: 3 },
          matematik: { d: 18 + examIndex * 3 + studentIndex, y: 10, b: 6 },
          fen: { d: 9 + examIndex, y: 6, b: 4 },
        };
        for (const key of Object.keys(values) as (keyof typeof values)[]) {
          const def = SUBJECTS_BY_EXAM.TYT.find((s) => s.code === key)!;
          const row = values[key];
          row.d = Math.min(def.questionCount, row.d);
          row.b = Math.max(0, def.questionCount - row.d - row.y);
        }
        const totals = Object.values(values).reduce(
          (acc, v) => ({ d: acc.d + v.d, y: acc.y + v.y, b: acc.b + v.b }),
          { d: 0, y: 0, b: 0 },
        );
        const id = `res-${sitting.id}-${student.id}`;
        results.push({
          id,
          studentId: student.id,
          examSittingId: sitting.id,
          institutionId: INST_B,
          uploadId: "seed-tyt",
          totalCorrect: totals.d,
          totalWrong: totals.y,
          totalBlank: totals.b,
          sourceNet: totals.d,
          calculatedNet: calculateNet(totals.d, totals.y, "TYT"),
          score: scoreFromValues("TYT", values),
          scoreSay: null,
          scoreEa: null,
          scoreSoz: null,
          rankGeneral: 60000 + studentIndex * 800,
          rankCity: 2500 + studentIndex * 40,
          rankDistrict: 500 + studentIndex * 10,
          rankSchool: studentIndex + 1,
          rankClass: (studentIndex % 2) + 1,
          countGeneral: 1200000,
          countCity: 80000,
          countDistrict: 9000,
          countSchool: 4,
          countClass: 2,
        });
        subjectResults.push(...subjectBundle("TYT", id, values));
      });
  });

  const aytSitting = sittings.find((sitting) => sitting.examType === "AYT")!;
  studentsB.forEach((student, studentIndex) => {
    const tytValues = {
      turkce: { d: 24 + 2 + studentIndex, y: 8, b: 4 },
      sosyal: { d: 12, y: 5, b: 3 },
      matematik: { d: 21 + studentIndex, y: 10, b: 6 },
      fen: { d: 10, y: 6, b: 4 },
    };
    for (const key of Object.keys(tytValues) as (keyof typeof tytValues)[]) {
      const def = SUBJECTS_BY_EXAM.TYT.find((s) => s.code === key)!;
      const row = tytValues[key];
      row.d = Math.min(def.questionCount, row.d);
      row.b = Math.max(0, def.questionCount - row.d - row.y);
    }
    const values = {
      turkdili: { d: 14 + studentIndex, y: 4, b: 0 },
      tarih1: { d: 6, y: 2, b: 0 },
      cografya1: { d: 4, y: 1, b: 0 },
      tarih2: { d: 6, y: 3, b: 0 },
      cografya2: { d: 6, y: 2, b: 0 },
      felsefe: { d: 7, y: 3, b: 0 },
      din: { d: 4, y: 1, b: 0 },
      matematik: { d: 20 + studentIndex * 2, y: 8, b: 0 },
      fizik: { d: 8, y: 3, b: 0 },
      kimya: { d: 7, y: 3, b: 0 },
      biyoloji: { d: 8, y: 2, b: 0 },
    };
    for (const key of Object.keys(values) as (keyof typeof values)[]) {
      const def = SUBJECTS_BY_EXAM.AYT.find((s) => s.code === key)!;
      const row = values[key];
      row.d = Math.min(def.questionCount, row.d);
      row.b = Math.max(0, def.questionCount - row.d - row.y);
    }
    const totals = Object.values(values).reduce(
      (acc, v) => ({ d: acc.d + v.d, y: acc.y + v.y, b: acc.b + v.b }),
      { d: 0, y: 0, b: 0 },
    );
    const scores = calculateAytScores(netsFromValues("AYT", values), netsFromValues("TYT", tytValues));
    const id = `res-${aytSitting.id}-${student.id}`;
    results.push({
      id,
      studentId: student.id,
      examSittingId: aytSitting.id,
      institutionId: INST_B,
      uploadId: "seed-ayt",
      totalCorrect: totals.d,
      totalWrong: totals.y,
      totalBlank: totals.b,
      sourceNet: totals.d,
      calculatedNet: calculateNet(totals.d, totals.y, "AYT"),
      score: bestAytScore(scores),
      scoreSay: scores.say,
      scoreEa: scores.ea,
      scoreSoz: scores.soz,
      rankGeneral: 18000 + studentIndex * 600,
      rankCity: 900 + studentIndex * 30,
      rankDistrict: 120 + studentIndex * 8,
      rankSchool: studentIndex + 1,
      rankClass: (studentIndex % 2) + 1,
      countGeneral: 180000,
      countCity: 12000,
      countDistrict: 1800,
      countSchool: 4,
      countClass: 2,
    });
    subjectResults.push(...subjectBundle("AYT", id, values));
  });

  return {
    schemaVersion: 24,
    institutions,
    users: [
      {
        id: USER_ADMIN,
        email: "yonetici@demo.okul",
        fullName: "Sistem Yöneticisi",
        role: "system_admin",
        passwordHash: hash,
        createdAt: now,
      },
      {
        id: USER_ADMIN_BULENT,
        email: ADMIN_BULENT_EMAIL,
        fullName: "Bülent",
        role: "system_admin",
        passwordHash: bulentHash,
        createdAt: now,
      },
      {
        id: USER_A,
        email: "okul.a@demo.okul",
        fullName: "Atatürk Ortaokulu Kullanıcısı",
        role: "school_user",
        passwordHash: hash,
        createdAt: now,
      },
      {
        id: USER_B,
        email: "okul.b@demo.okul",
        fullName: "Cumhuriyet Lisesi Kullanıcısı",
        role: "school_user",
        passwordHash: hash,
        createdAt: now,
      },
      {
        id: USER_C,
        email: "okul.c@demo.okul",
        fullName: "Mehmet Akif Ortaokulu Kullanıcısı",
        role: "school_user",
        passwordHash: hash,
        createdAt: now,
      },
      {
        id: USER_DISTRICT_CANKAYA,
        email: "cankaya@demo.ilce",
        fullName: "Çankaya İlçe Kullanıcısı",
        role: "district_admin",
        passwordHash: hash,
        city: "Ankara",
        district: "Çankaya",
        createdAt: now,
      },
    ],
    memberships: [
      { id: "mem-a", userId: USER_A, institutionId: INST_A },
      { id: "mem-b", userId: USER_B, institutionId: INST_B },
      { id: "mem-c", userId: USER_C, institutionId: INST_C },
    ],
    academicYears: [
      {
        id: YEAR_ID,
        label: "2025-2026",
        startsOn: "2025-09-08",
        endsOn: "2026-06-19",
        isActive: true,
      },
    ],
    permissions: [
      ...permissionsFor(
        INST_A,
        ["LGS"],
        ANALYSIS_MODULES.map((m) => m.slug),
      ),
      ...permissionsFor(
        INST_B,
        ["TYT", "AYT"],
        ANALYSIS_MODULES.map((m) => m.slug),
      ),
      ...permissionsFor(
        INST_C,
        ["LGS"],
        ANALYSIS_MODULES.map((m) => m.slug),
      ),
    ],
    capabilityGrants: [],
    sittings,
    students: [...studentsA, ...studentsB, ...studentsC],
    results,
    subjectResults,
    uploads: [
      {
        id: "seed-lgs",
        examSittingId: "sit-lgs-3",
        uploadedBy: USER_ADMIN,
        fileName: "anonim-lgs-ornek.xlsx",
        fileHash: "seed-lgs-hash",
        status: "committed",
        examType: "LGS",
        rowCount: 18,
        validCount: 18,
        errorCount: 0,
        createdAt: now,
        committedAt: now,
        rolledBackAt: null,
      },
      {
        id: "seed-tyt",
        examSittingId: "sit-tyt-2",
        uploadedBy: USER_ADMIN,
        fileName: "anonim-tyt-ornek.xlsx",
        fileHash: "seed-tyt-hash",
        status: "committed",
        examType: "TYT",
        rowCount: 8,
        validCount: 8,
        errorCount: 0,
        createdAt: now,
        committedAt: now,
        rolledBackAt: null,
      },
      {
        id: "seed-ayt",
        examSittingId: "sit-ayt-1",
        uploadedBy: USER_ADMIN,
        fileName: "anonim-ayt-ornek.xlsx",
        fileHash: "seed-ayt-hash",
        status: "committed",
        examType: "AYT",
        rowCount: 4,
        validCount: 4,
        errorCount: 0,
        createdAt: now,
        committedAt: now,
        rolledBackAt: null,
      },
    ],
    uploadErrors: [],
    auditLogs: [
      {
        id: "audit-seed",
        actorId: USER_ADMIN,
        actorEmail: "yonetici@demo.okul",
        action: "seed",
        institutionId: null,
        institutionName: null,
        moduleSlug: null,
        examType: null,
        oldValue: null,
        newValue: null,
        metadata: { note: "Anonim demo verisi yüklendi" },
        createdAt: now,
      },
    ],
  };
}
