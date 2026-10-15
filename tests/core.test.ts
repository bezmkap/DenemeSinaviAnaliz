import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { lgsImporter, tytImporter, aytImporter } from "@/lib/import/importers";
import { buildPreview } from "@/lib/import/pipeline";
import {
  anonymousAytStudent,
  anonymousLgsStudent,
  anonymousTytStudent,
  buildAnswerSheetSample,
  buildAytSample,
  buildLgsSample,
  buildTytSample,
} from "@/lib/import/sample-files";
import { workbookToBuffer } from "@/lib/import/workbook";
import { createAppStore, migrateAppState } from "@/lib/store/app-store";
import { buildDemoState, DEMO_IDS, DEMO_PASSWORD, ADMIN_BULENT_EMAIL, ADMIN_BULENT_PASSWORD } from "@/lib/store/seed";
import { AppError } from "@/lib/errors";
import { calculateNet, calculateExamScore, calculateAytScores, AYT_TRACK_COEFFICIENTS, LGS_2026_NORMS, TYT_2026_NORMS, TYT_BASE_SCORE, TYT_NET_COEFFICIENTS, findInstitutionByCode, institutionCodesEqual, formatInstitutionTypes, sanitizeExamTypes, ANALYSIS_MODULES, MODULE_GROUPS, IL_ANALIZI_SLUG, IL_ANALYSIS_MODULES, IL_MODULE_GROUPS, withKeptQuery, panelPath, parseClassPlacement, normalizeStudentIdentity, preferredAcademicYear, suggestNextAcademicYear, type ExamResult } from "@/lib/domain";
import { pageSectionFromPath } from "@/lib/page-titles";
import { buildSchoolEvaluation, buildProvinceEvaluation, trafficFromScore } from "@/lib/analiz/evaluation";
import { aggregateOutcomeResults, buildKarneRankSets } from "@/lib/analiz/compute";

function demoStore() {
  return createAppStore(buildDemoState());
}

describe("sınav puanı hesaplama", () => {
  it("LGS tam doğru 500 verir, boş kâğıt tabanda kalır ve ana ders katsayısı daha yüksektir", () => {
    const full = {
      turkce: 20,
      inkilap: 10,
      din: 10,
      ingilizce: 10,
      matematik: 20,
      fen: 20,
    };
    const empty = calculateExamScore("LGS", {
      turkce: 0,
      inkilap: 0,
      din: 0,
      ingilizce: 0,
      matematik: 0,
      fen: 0,
    });
    expect(calculateExamScore("LGS", full)).toBe(500);
    expect(empty).toBeGreaterThanOrEqual(100);
    expect(empty).toBeLessThan(220);
    const onlyTurkce = calculateExamScore("LGS", { ...full, inkilap: 0, din: 0, ingilizce: 0, matematik: 0, fen: 0, turkce: 20 });
    const onlyInkilap = calculateExamScore("LGS", { ...full, turkce: 0, din: 0, ingilizce: 0, matematik: 0, fen: 0, inkilap: 10 });
    expect(onlyTurkce).toBeGreaterThan(onlyInkilap);
  });

  it("TYT puanı taban artı net katsayılarıyla hesaplanır", () => {
    const full = { turkce: 40, sosyal: 20, matematik: 40, fen: 20 };
    const empty = { turkce: 0, sosyal: 0, matematik: 0, fen: 0 };
    expect(calculateExamScore("TYT", full)).toBe(500);
    expect(calculateExamScore("TYT", empty)).toBe(TYT_BASE_SCORE);
  });

  it("AYT puanı önceki TYT netleriyle üç türde hesaplanır", () => {
    const tyt = { turkce: 40, sosyal: 20, matematik: 40, fen: 20 };
    const sayNets = { matematik: 40, fizik: 14, kimya: 13, biyoloji: 13 };
    const sozNets = {
      turkdili: 24,
      tarih1: 10,
      cografya1: 6,
      tarih2: 11,
      cografya2: 11,
      felsefe: 12,
      din: 6,
    };
    const scores = calculateAytScores(sayNets, tyt);
    const expectedSay =
      Math.round(
        (AYT_TRACK_COEFFICIENTS.say.base +
          AYT_TRACK_COEFFICIENTS.say.tyt.turkce * 40 +
          AYT_TRACK_COEFFICIENTS.say.tyt.sosyal * 20 +
          AYT_TRACK_COEFFICIENTS.say.tyt.matematik * 40 +
          AYT_TRACK_COEFFICIENTS.say.tyt.fen * 20 +
          AYT_TRACK_COEFFICIENTS.say.ayt.matematik * 40 +
          AYT_TRACK_COEFFICIENTS.say.ayt.fizik * 14 +
          AYT_TRACK_COEFFICIENTS.say.ayt.kimya * 13 +
          AYT_TRACK_COEFFICIENTS.say.ayt.biyoloji * 13) *
          10,
      ) / 10;
    expect(scores.say).toBe(Math.min(500, expectedSay));
    expect(scores.say).toBe(500);
    expect(scores.ea).toBeGreaterThan(100);
    expect(scores.soz).toBeGreaterThan(100);
    expect(calculateExamScore("AYT", sayNets)).toBeNull();
    expect(calculateExamScore("AYT", sayNets, tyt)).toBe(500);
    const soz = calculateAytScores(sozNets, tyt);
    expect(soz.soz).toBeGreaterThan(soz.say);
    expect(soz.soz).toBeGreaterThan(soz.ea);
  });

  it("2026 Türkiye ortalamasındaki netler orta bantta puan verir", () => {
    const lgs = calculateExamScore("LGS", {
      turkce: LGS_2026_NORMS.turkce.mean,
      inkilap: LGS_2026_NORMS.inkilap.mean,
      din: LGS_2026_NORMS.din.mean,
      ingilizce: LGS_2026_NORMS.ingilizce.mean,
      matematik: LGS_2026_NORMS.matematik.mean,
      fen: LGS_2026_NORMS.fen.mean,
    });
    const tyt = calculateExamScore("TYT", {
      turkce: TYT_2026_NORMS.turkce.mean,
      sosyal: TYT_2026_NORMS.sosyal.mean,
      matematik: TYT_2026_NORMS.matematik.mean,
      fen: TYT_2026_NORMS.fen.mean,
    });
    expect(lgs).toBe(300);
    expect(tyt).toBe(264.1);
  });

  it("2026'da zor testte aynı net daha yüksek puan üretir", () => {
    const atMean = {
      turkce: LGS_2026_NORMS.turkce.mean,
      inkilap: LGS_2026_NORMS.inkilap.mean,
      din: LGS_2026_NORMS.din.mean,
      ingilizce: LGS_2026_NORMS.ingilizce.mean,
      matematik: LGS_2026_NORMS.matematik.mean,
      fen: LGS_2026_NORMS.fen.mean,
    };
    const mathTen = calculateExamScore("LGS", { ...atMean, matematik: 10 });
    const turkceTen = calculateExamScore("LGS", { ...atMean, turkce: 10 });
    expect(mathTen).toBeGreaterThan(300);
    expect(turkceTen).toBeGreaterThan(300);
    expect(mathTen).toBeGreaterThan(turkceTen);
  });

  it("yüklemede dosyadaki puan yerine kurala göre hesaplar", async () => {
    const buffer = await buildLgsSample([
      anonymousLgsStudent({ studentNo: "00001", institutionCode: "000101", score: 412.5 }),
    ]);
    const preview = await buildPreview({ buffer, examType: "LGS" });
    expect(preview.rows[0].score).not.toBe(412.5);
    expect(preview.rows[0].score).toBe(
      calculateExamScore("LGS", {
        turkce: calculateNet(14, 3, "LGS"),
        inkilap: calculateNet(7, 2, "LGS"),
        din: calculateNet(8, 1, "LGS"),
        ingilizce: calculateNet(6, 2, "LGS"),
        matematik: calculateNet(12, 4, "LGS"),
        fen: calculateNet(13, 3, "LGS"),
      }),
    );
  });
});

describe("importer ayrımı", () => {
  it("LGS, TYT ve AYT importer'ları ayrıdır", () => {
    expect(lgsImporter).not.toBe(tytImporter);
    expect(lgsImporter.examType).toBe("LGS");
    expect(tytImporter.examType).toBe("TYT");
    expect(aytImporter.examType).toBe("AYT");
    expect(lgsImporter.subjects.map((s) => s.code)).toEqual([
      "turkce",
      "inkilap",
      "din",
      "ingilizce",
      "matematik",
      "fen",
    ]);
    expect(tytImporter.subjects.map((s) => s.code)).toEqual([
      "turkce",
      "sosyal",
      "matematik",
      "fen",
    ]);
    expect(aytImporter.subjects.map((s) => s.code)).toEqual([
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
    ]);
    expect(() => aytImporter.assertReady()).not.toThrow();
  });
});

describe("AYT içe aktarma", () => {
  it("ayrı AYT dosyasındaki ders sütunlarını eşler", async () => {
    const buffer = await buildAytSample([
      anonymousAytStudent({ studentNo: "00021", institutionCode: "000202" }),
    ]);
    const preview = await buildPreview({ buffer, examType: "AYT" });
    const codes = preview.mapping.subjects.filter((s) => s.confirmed).map((s) => s.subjectCode);
    expect(codes).toEqual([
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
    ]);
    expect(preview.mapping.subjects.some((s) => s.prefix.startsWith("tyt"))).toBe(false);
    expect(preview.rows[0]?.institutionCode).toBe("000202");
    expect(preview.rows[0]?.errors).toEqual([]);
  });
});

describe("kurum izolasyonu", () => {
  it("Okul A kullanıcısı Okul B verisini göremez", () => {
    const store = demoStore();
    const a = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const b = store.authenticate("okul.b@demo.okul", DEMO_PASSWORD)!;
    expect(a.institutionIds).toEqual([DEMO_IDS.INST_A]);
    expect(store.listInstitutions(a).map((i) => i.id)).toEqual([DEMO_IDS.INST_A]);
    expect(() => store.getInstitution(a, DEMO_IDS.INST_B)).toThrow(AppError);
    expect(() =>
      store.getAnalysis(a, DEMO_IDS.INST_B, "okul-ozeti", {}),
    ).toThrow(/erişemezsiniz|erişim/i);

    const payload = store.getAnalysis(a, DEMO_IDS.INST_A, "okul-ozeti", {});
    const rankings = payload.rankings as Array<{ studentNo: string }>;
    expect(rankings.every((r) => r.studentNo.startsWith("0000"))).toBe(true);
    expect(rankings.some((r) => r.studentNo === "00011")).toBe(false);

    const bPayload = store.getAnalysis(b, DEMO_IDS.INST_B, "okul-ozeti", {});
    const bRanks = bPayload.rankings as Array<{ studentNo: string }>;
    expect(bRanks.some((r) => r.studentNo === "00001")).toBe(false);
  });
});

describe("öğrenci profili okul sırası", () => {
  it("sınav geçmişinde okul puan sırasını gösterir", () => {
    const store = demoStore();
    const a = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const overview = store.getAnalysis(a, DEMO_IDS.INST_A, "okul-ozeti", {});
    const rankings = overview.rankings as Array<{
      studentId: string;
      schoolRank: number;
      score: number | null;
      net: number;
    }>;
    expect(rankings.length).toBeGreaterThan(1);
    for (let i = 1; i < rankings.length; i++) {
      expect(rankings[i - 1].score ?? Number.NEGATIVE_INFINITY).toBeGreaterThanOrEqual(
        rankings[i].score ?? Number.NEGATIVE_INFINITY,
      );
    }
    const lastInSchool = rankings[rankings.length - 1];
    const profile = store.getAnalysis(a, DEMO_IDS.INST_A, "ogrenci-profili", {
      studentId: lastInSchool.studentId,
    });
    const history = (
      profile.studentProfile as {
        examHistory: Array<{
          schoolRank: number | null;
          schoolCount: number | null;
          cityRank: number | null;
          cityCount: number | null;
          districtRank: number | null;
          districtCount: number | null;
        }>;
      }
    ).examHistory;
    const latest = history[history.length - 1];
    expect(latest.schoolRank).toBe(lastInSchool.schoolRank);
    expect(latest.schoolCount).toBe(rankings.length);
    expect(latest.schoolRank).toBeGreaterThan(1);
    expect(latest.cityRank).toBe(latest.schoolRank);
    expect(latest.cityCount).toBe(latest.schoolCount);
    expect(latest.districtRank).toBe(latest.schoolRank);
    expect(latest.districtCount).toBe(latest.schoolCount);
  });

  it("şube filtresi kalsa bile okul sırasını şubeye indirmez", () => {
    const store = demoStore();
    const a = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const overview = store.getAnalysis(a, DEMO_IDS.INST_A, "okul-ozeti", {});
    const rankings = overview.rankings as Array<{
      studentId: string;
      schoolRank: number;
      grade: string;
      section: string;
    }>;
    const lastInSchool = rankings[rankings.length - 1];
    const profile = store.getAnalysis(a, DEMO_IDS.INST_A, "ogrenci-profili", {
      studentId: lastInSchool.studentId,
      grade: lastInSchool.grade,
      section: lastInSchool.section,
    });
    const latest = (
      profile.studentProfile as {
        examHistory: Array<{ schoolRank: number | null; schoolCount: number | null }>;
      }
    ).examHistory.at(-1);
    expect(latest?.schoolRank).toBe(lastInSchool.schoolRank);
    expect(latest?.schoolCount).toBe(rankings.length);
  });

  it("aynı süreç değerlendirme ayrı oturumlara bölünse de okul sırasını birleştirir", () => {
    const store = demoStore();
    const state = store.getState();
    const mart = state.sittings.find((row) => row.name === "Mart LGS Süreç Değerlendirmesi");
    expect(mart).toBeTruthy();
    const splitId = "sit-mart-split-c";
    state.sittings.push({
      ...mart!,
      id: splitId,
      examCode: `${mart!.examCode}-C`,
    });
    const sectionB = new Set(
      state.students
        .filter((row) => row.institutionId === DEMO_IDS.INST_A && row.section === "B")
        .map((row) => row.id),
    );
    for (const result of state.results) {
      if (result.examSittingId === mart!.id && sectionB.has(result.studentId)) {
        result.examSittingId = splitId;
      }
    }

    const a = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const overview = store.getAnalysis(a, DEMO_IDS.INST_A, "okul-ozeti", {
      examSittingId: mart!.id,
      examType: "LGS",
    });
    const rankings = overview.rankings as Array<{
      studentId: string;
      section: string;
      score: number | null;
    }>;
    const sectionA = rankings.find((row) => row.section === "A");
    expect(sectionA).toBeTruthy();
    const profile = store.getAnalysis(a, DEMO_IDS.INST_A, "ogrenci-profili", {
      studentId: sectionA!.studentId,
      examSittingId: mart!.id,
      examType: "LGS",
    });
    const martHistory = (
      profile.studentProfile as {
        examHistory: Array<{
          examName: string;
          schoolRank: number | null;
          schoolCount: number | null;
          score: number | null;
        }>;
      }
    ).examHistory.find((row) => row.examName === "Mart LGS Süreç Değerlendirmesi");
    expect(martHistory?.schoolCount).toBeGreaterThan(rankings.length);
    const betterInSchool = state.results.filter((row) => {
      const sitting = state.sittings.find((item) => item.id === row.examSittingId);
      return (
        row.institutionId === DEMO_IDS.INST_A &&
        sitting?.name === "Mart LGS Süreç Değerlendirmesi" &&
        (row.score ?? Number.NEGATIVE_INFINITY) > (martHistory?.score ?? Number.NEGATIVE_INFINITY)
      );
    }).length;
    expect(martHistory?.schoolRank).toBe(betterInSchool + 1);
  });
});

describe("ilçe kullanıcısı", () => {
  it("yalnızca kendi ilçesindeki okulları görür ve okul ekleyemez", () => {
    const store = demoStore();
    const district = store.authenticate("cankaya@demo.ilce", DEMO_PASSWORD)!;
    expect(district.role).toBe("district_admin");
    expect(district.city).toBe("Ankara");
    expect(district.district).toBe("Çankaya");
    expect(store.listInstitutions(district).map((row) => row.id)).toEqual([DEMO_IDS.INST_A]);
    expect(() => store.getInstitution(district, DEMO_IDS.INST_B)).toThrow(AppError);
    expect(() => store.getAnalysis(district, DEMO_IDS.INST_B, "okul-ozeti", {})).toThrow(
      /erişemezsiniz|erişim/i,
    );
    expect(() =>
      store.createInstitution(district, {
        code: "000808",
        name: "İlçe Okulu",
        city: "Ankara",
        district: "Çankaya",
        type: "ortaokul",
        examTypePermissions: ["LGS"],
      }),
    ).toThrow(/yetkisi yok|Kurum ekleme/i);
    expect(store.canViewNetworkAnalysis(district)).toBe(true);
    const lgs = store.getNetworkAnalysis(district, { examType: "LGS" });
    expect(lgs.schools.map((row) => row.id)).toEqual([DEMO_IDS.INST_A]);
    expect(lgs.schools.every((row) => row.district === "Çankaya")).toBe(true);
    expect(store.getAnalysis(district, DEMO_IDS.INST_A, "okul-ozeti", {}).empty).toBe(false);
  });

  it("yönetici ilçe hesabı açar, okul kullanıcısı açamaz", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const school = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    expect(() =>
      store.createDistrictUser(school, {
        email: "konak@demo.ilce",
        fullName: "Konak İlçe",
        password: DEMO_PASSWORD,
        city: "İzmir",
        district: "Konak",
      }),
    ).toThrow(/yalnızca yönetici/i);
    const created = store.createDistrictUser(admin, {
      email: "konak@demo.ilce",
      fullName: "Konak İlçe",
      password: DEMO_PASSWORD,
      city: "İzmir",
      district: "Konak",
    });
    expect(created.login).toEqual({ email: "konak@demo.ilce", password: DEMO_PASSWORD });
    const konak = store.authenticate("konak@demo.ilce", DEMO_PASSWORD)!;
    expect(konak.role).toBe("district_admin");
    expect(store.listInstitutions(konak).map((row) => row.id)).toEqual([DEMO_IDS.INST_B]);
    const tyt = store.getNetworkAnalysis(konak, { examType: "TYT" });
    expect(tyt.schools.map((row) => row.id)).toEqual([DEMO_IDS.INST_B]);
    expect(store.listDistrictUsers(admin).some((row) => row.email === "konak@demo.ilce")).toBe(true);
    const updated = store.updateDistrictUser(admin, created.user.id, {
      email: "konak@ornek.ilce",
      fullName: "Konak Yeni",
      city: "İzmir",
      district: "Karşıyaka",
      password: "YeniSifre1",
    });
    expect(updated.fullName).toBe("Konak Yeni");
    expect(store.authenticate("konak@demo.ilce", DEMO_PASSWORD)).toBeNull();
    const relocated = store.authenticate("konak@ornek.ilce", "YeniSifre1")!;
    expect(relocated.district).toBe("Karşıyaka");
    expect(store.listInstitutions(relocated).every((row) => row.district === "Karşıyaka")).toBe(true);
    store.updateDistrictUser(admin, created.user.id, {
      email: "konak@ornek.ilce",
      fullName: "Konak Yeni",
      city: "İzmir",
      district: "Konak",
      password: "",
    });
    expect(store.authenticate("konak@ornek.ilce", "YeniSifre1")?.district).toBe("Konak");
    expect(() =>
      store.updateDistrictUser(school, created.user.id, {
        email: "konak@ornek.ilce",
        fullName: "Konak Yeni",
        city: "İzmir",
        district: "Konak",
      }),
    ).toThrow(/yalnızca yönetici/i);
  });

  it("okul, ilçe ve il öğrenci ortalaması raporunu üretir", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const school = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const district = store.authenticate("cankaya@demo.ilce", DEMO_PASSWORD)!;
    const schoolReport = store.buildStudentAveragesReport(school, {
      scope: "okul",
      institutionId: DEMO_IDS.INST_A,
      filters: { examType: "LGS" },
    });
    expect(schoolReport.scope).toBe("okul");
    expect(schoolReport.students.length).toBeGreaterThan(0);
    expect(schoolReport.summaries.some((row) => row.label.includes("İLİ"))).toBe(true);
    expect(schoolReport.summaries.some((row) => row.label === "OKUL")).toBe(true);
    expect(schoolReport.students[0].schoolRank).toBe(1);
    const districtReport = store.buildStudentAveragesReport(district, {
      filters: { examType: "LGS" },
    });
    expect(districtReport.scope).toBe("ilce");
    expect(districtReport.students.every((row) => row.district === "Çankaya")).toBe(true);
    expect(districtReport.schools.length).toBeGreaterThan(0);
    const cityReport = store.buildStudentAveragesReport(admin, {
      scope: "il",
      filters: { examType: "LGS", city: "Ankara" },
    });
    expect(cityReport.scope).toBe("il");
    expect(cityReport.students.every((row) => row.city === "Ankara")).toBe(true);
    expect(cityReport.districts.length).toBeGreaterThan(0);
    expect(() =>
      store.buildStudentAveragesReport(district, {
        scope: "il",
        filters: { examType: "LGS" },
      }),
    ).toThrow(/il raporu/i);
  });

  it("eski canlı kayıtta eksik ilçe hesaplarını okullardan üretir", () => {
    const state = buildDemoState();
    state.schemaVersion = 9;
    state.users = state.users.filter((user) => user.role !== "district_admin");
    const { state: next, changed } = migrateAppState(state);
    expect(changed).toBe(true);
    expect(next.schemaVersion).toBe(26);
    const emails = next.users
      .filter((user) => user.role === "district_admin")
      .map((user) => user.email)
      .sort();
    expect(emails).toEqual([
      "cankaya.ankara@ilce.local",
      "konak.izmir@ilce.local",
      "osmangazi.bursa@ilce.local",
    ]);
    const store = createAppStore(next);
    const cankaya = store.authenticate("cankaya.ankara@ilce.local", "Çankaya")!;
    expect(cankaya.role).toBe("district_admin");
    expect(cankaya.district).toBe("Çankaya");
    expect(store.listInstitutions(cankaya).map((row) => row.id)).toEqual([DEMO_IDS.INST_A]);
  });

  it("şema 10 olsa bile eksik ilçe hesaplarını yeniden üretir", () => {
    const state = buildDemoState();
    state.schemaVersion = 10;
    state.users = state.users.filter((user) => user.role !== "district_admin");
    const { state: next } = migrateAppState(state);
    expect(next.users.some((user) => user.role === "district_admin")).toBe(true);
    expect(next.schemaVersion).toBe(26);
  });

  it("silinmiş Bülent yöneticisini geri yükler", () => {
    const state = buildDemoState();
    state.schemaVersion = 25;
    state.users = state.users.filter((user) => user.email !== "bulent@demo.okul");
    const { state: next } = migrateAppState(state);
    const store = createAppStore(next);
    expect(store.authenticate("bulent", "20002020")?.role).toBe("system_admin");
    expect(store.authenticate("bulent@demo.okul", "20002020")?.id).toBe("user-admin-bulent");
  });

  it("demo hesaplarını kayıttan çıkarır, Bülent yöneticisini tutar", () => {
    const { state: next } = migrateAppState(buildDemoState());
    expect(next.users.some((user) => user.email === "yonetici@demo.okul")).toBe(false);
    expect(next.users.some((user) => user.email === "bulent@demo.okul")).toBe(true);
    const restored = createAppStore(next);
    expect(restored.authenticate("bulent", "20002020")?.role).toBe("system_admin");
    expect(next.schemaVersion).toBe(26);
  });

  it("eski Denemesi oturum adlarını süreç değerlendirmeye taşır", () => {
    const state = buildDemoState();
    state.schemaVersion = 22;
    const sitting = state.sittings.find((row) => row.id === "sit-lgs-3")!;
    sitting.name = "Mart LGS Denemesi";
    const { state: next } = migrateAppState(state);
    expect(next.schemaVersion).toBe(26);
    expect(next.sittings.find((row) => row.id === "sit-lgs-3")?.name).toBe(
      "Mart LGS Süreç Değerlendirmesi",
    );
  });
});

describe("cevap anahtarı yetkisi", () => {
  it("okul ve ilçe anahtarı görür ama değiştiremez", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const school = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const district = store.authenticate("cankaya@demo.ilce", DEMO_PASSWORD)!;
    const sittingId = "sit-lgs-3";
    const keys = structuredClone(store.getState().sittings.find((row) => row.id === sittingId)?.questionKeys ?? { A: {} });
    expect(admin.canEditAnswerKeys).toBe(true);
    expect(school.canEditAnswerKeys).toBe(false);
    expect(district.canEditAnswerKeys).toBe(false);
    expect(store.listAnswerKeySittings(school).some((row) => row.id === sittingId)).toBe(true);
    expect(store.listAnswerKeySittings(district).some((row) => row.id === sittingId)).toBe(true);
    expect(store.listAnswerKeySittings(admin).some((row) => row.id === sittingId)).toBe(true);
    expect(store.saveExamQuestionKeys(admin, sittingId, keys).id).toBe(sittingId);
    expect(() => store.saveExamQuestionKeys(school, sittingId, keys)).toThrow(/yalnızca sistem yöneticisi/i);
    expect(() => store.saveExamQuestionKeys(district, sittingId, keys)).toThrow(/yalnızca sistem yöneticisi/i);
  });

  it("okul yalnız kendi sınavının anahtarını görür", () => {
    const store = demoStore();
    const schoolA = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const schoolB = store.authenticate("okul.b@demo.okul", DEMO_PASSWORD)!;
    const lgsId = "sit-lgs-3";
    const tytId = "sit-tyt-1";
    const keys = structuredClone(store.getState().sittings.find((row) => row.id === lgsId)?.questionKeys ?? { A: {} });
    expect(store.listAnswerKeySittings(schoolA).some((row) => row.id === lgsId)).toBe(true);
    expect(store.listAnswerKeySittings(schoolA).some((row) => row.id === tytId)).toBe(false);
    expect(store.listAnswerKeySittings(schoolB).some((row) => row.id === lgsId)).toBe(false);
    expect(store.listAnswerKeySittings(schoolB).some((row) => row.id === tytId)).toBe(true);
    expect(() => store.saveExamQuestionKeys(schoolA, lgsId, keys)).toThrow(/yalnızca sistem yöneticisi/i);
    expect(() => store.setAnswerKeyGrants(schoolA, { schoolIds: [DEMO_IDS.INST_B], enabled: true })).toThrow(
      /yetki/i,
    );
  });

  it("ilçe yalnız kendi okullarının sınav anahtarını görür", () => {
    const store = demoStore();
    const district = store.authenticate("cankaya@demo.ilce", DEMO_PASSWORD)!;
    const lgsId = "sit-lgs-3";
    const tytId = "sit-tyt-1";
    const lgsKeys = structuredClone(store.getState().sittings.find((row) => row.id === lgsId)?.questionKeys ?? { A: {} });
    const tytKeys = structuredClone(store.getState().sittings.find((row) => row.id === tytId)?.questionKeys ?? { A: {} });
    expect(district.canEditAnswerKeys).toBe(false);
    expect(store.listAnswerKeySittings(district).some((row) => row.id === lgsId)).toBe(true);
    expect(store.listAnswerKeySittings(district).some((row) => row.id === tytId)).toBe(false);
    expect(() => store.saveExamQuestionKeys(district, lgsId, lgsKeys)).toThrow(/yalnızca sistem yöneticisi/i);
    expect(() => store.saveExamQuestionKeys(district, tytId, tytKeys)).toThrow(/yalnızca sistem yöneticisi/i);
  });
});

describe("genel ağ analizi", () => {
  it("sistem yöneticisi tüm okulları ve illeri birlikte görür", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const school = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    expect(() => store.getNetworkAnalysis(school, {})).toThrow(/kapalı/);
    expect(store.canViewNetworkAnalysis(school)).toBe(false);
    expect(store.isModuleEnabled(DEMO_IDS.INST_A, IL_ANALIZI_SLUG)).toBe(false);

    const lgs = store.getNetworkAnalysis(admin, { examType: "LGS" });
    expect(lgs.empty).toBe(false);
    expect(lgs.examType).toBe("LGS");
    expect(lgs.schools.map((s) => s.id)).toContain(DEMO_IDS.INST_A);
    expect(lgs.schools.map((s) => s.id)).toContain(DEMO_IDS.INST_C);
    expect(lgs.schools.map((s) => s.id)).not.toContain(DEMO_IDS.INST_B);
    expect(lgs.schools.every((s) => s.examType === "LGS")).toBe(true);
    expect(lgs.cities.some((c) => c.city === "Ankara")).toBe(true);
    expect(lgs.cities.some((c) => c.city === "Bursa")).toBe(true);
    expect(lgs.lastTotals.schoolCount).toBe(2);
    expect(lgs.subjects.length).toBeGreaterThan(0);
    expect(lgs.subjects.some((s) => s.code === "matematik" && s.avgNet != null)).toBe(true);
    expect(lgs.sections.some((s) => s.grade === "8" && (s.section === "A" || s.section === "B"))).toBe(
      true,
    );
    expect(lgs.classes.some((c) => c.grade === "8")).toBe(true);

    const tyt = store.getNetworkAnalysis(admin, { examType: "TYT" });
    expect(tyt.schools.map((s) => s.id)).toContain(DEMO_IDS.INST_B);
    expect(tyt.schools.map((s) => s.id)).not.toContain(DEMO_IDS.INST_A);
    expect(tyt.schools.every((s) => s.examType === "TYT")).toBe(true);
    expect(tyt.cities.some((c) => c.city === "İzmir")).toBe(true);

    const ankaraOnly = store.getNetworkAnalysis(admin, { city: "Ankara", examType: "LGS" });
    expect(ankaraOnly.schools.every((s) => s.city === "Ankara")).toBe(true);
    const cankayaOnly = store.getNetworkAnalysis(admin, {
      city: "Ankara",
      district: "Çankaya",
      examType: "LGS",
    });
    expect(cankayaOnly.schools.length).toBeGreaterThan(0);
    expect(cankayaOnly.schools.every((s) => s.district === "Çankaya")).toBe(true);
  });

  it("yönetici izin verirse okul müdürü il analizini görür, başka okulu açamaz", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const school = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    store.setModulePermissions(admin, {
      institutionIds: [DEMO_IDS.INST_A],
      moduleSlugs: [IL_ANALIZI_SLUG],
      examTypes: ["LGS"],
      enabled: true,
    });
    expect(store.canViewNetworkAnalysis(school)).toBe(true);
    const payload = store.getNetworkAnalysis(school, { examType: "LGS" });
    expect(payload.empty).toBe(false);
    expect(payload.schools.map((row) => row.id)).toContain(DEMO_IDS.INST_A);
    expect(() => store.getAnalysis(school, DEMO_IDS.INST_B, "okul-ozeti", {})).toThrow(
      /erişemezsiniz|erişim/i,
    );
    const other = store.authenticate("okul.b@demo.okul", DEMO_PASSWORD)!;
    expect(store.canViewNetworkAnalysis(other)).toBe(false);
    expect(() => store.getNetworkAnalysis(other, { examType: "TYT" })).toThrow(/kapalı/);
  });
});

describe("sınav türü izolasyonu", () => {
  it("LGS ile TYT aynı sıralamada veya trendde karışmaz", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const mixed = store.getNetworkAnalysis(admin, {});
    expect(mixed.examType).toBeTruthy();
    expect(mixed.schools.every((s) => s.examType === mixed.examType)).toBe(true);
    expect(mixed.yearTrend.every((row) => row.examType === mixed.examType)).toBe(true);

    const a = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const b = store.authenticate("okul.b@demo.okul", DEMO_PASSWORD)!;
    const aPayload = store.getAnalysis(a, DEMO_IDS.INST_A, "okul-ozeti", {});
    const aTrend = aPayload.yearTrend as Array<{ examType: string }>;
    expect((aPayload.lastExam as { examType: string }).examType).toBe("LGS");
    expect(aTrend.length).toBeGreaterThan(1);
    expect(aTrend.every((row) => row.examType === "LGS")).toBe(true);

    const bPayload = store.getAnalysis(b, DEMO_IDS.INST_B, "okul-ozeti", {});
    const bTrend = bPayload.yearTrend as Array<{ examType: string }>;
    expect((bPayload.lastExam as { examType: string }).examType).toBe("AYT");
    expect(bTrend.every((row) => row.examType === "AYT")).toBe(true);
    const bTyt = store.getAnalysis(b, DEMO_IDS.INST_B, "okul-ozeti", { examType: "TYT" });
    expect((bTyt.lastExam as { examType: string }).examType).toBe("TYT");
  });
});

describe("analiz yetkileri", () => {
  it("demo okullarında tüm analiz modülleri açıktır", () => {
    const store = demoStore();
    expect(store.enabledModules(DEMO_IDS.INST_A)).toHaveLength(ANALYSIS_MODULES.length);
    expect(store.enabledModules(DEMO_IDS.INST_B)).toHaveLength(ANALYSIS_MODULES.length);
    expect(store.enabledModules(DEMO_IDS.INST_C)).toHaveLength(ANALYSIS_MODULES.length);
    const b = store.authenticate("okul.b@demo.okul", DEMO_PASSWORD)!;
    expect(store.getAnalysis(b, DEMO_IDS.INST_B, "ders-analizi", {}).empty).toBe(false);
    const c = store.authenticate("okul.c@demo.okul", DEMO_PASSWORD)!;
    expect(store.getAnalysis(c, DEMO_IDS.INST_C, "sube-karsilastirma", {}).empty).toBe(false);
  });

  it("eski kapalı varsayılan yetkileri tüm analizlere açar", () => {
    const state = buildDemoState();
    state.schemaVersion = 0;
    for (const permission of state.permissions) {
      permission.enabled = permission.moduleSlug === "okul-ozeti";
    }
    const { state: next } = migrateAppState(state);
    const store = createAppStore(next);
    expect(store.enabledModules(DEMO_IDS.INST_B)).toHaveLength(ANALYSIS_MODULES.length);
    expect(store.enabledModules(DEMO_IDS.INST_C)).toHaveLength(ANALYSIS_MODULES.length);
    expect(store.isModuleEnabled(DEMO_IDS.INST_A, IL_ANALIZI_SLUG)).toBe(false);
    expect(store.isModuleEnabled(DEMO_IDS.INST_B, IL_ANALIZI_SLUG)).toBe(false);
  });

  it("kapalı modüle erişimi reddeder", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    store.setModulePermissions(admin, {
      institutionIds: [DEMO_IDS.INST_B],
      moduleSlugs: ["ders-analizi"],
      examTypes: ["TYT", "AYT"],
      enabled: false,
    });
    const b = store.authenticate("okul.b@demo.okul", DEMO_PASSWORD)!;
    expect(store.isModuleEnabled(DEMO_IDS.INST_B, "ders-analizi")).toBe(false);
    expect(() =>
      store.getAnalysis(b, DEMO_IDS.INST_B, "ders-analizi", {}),
    ).toThrow(/kapalı/);
  });

  it("hiç modül açılmamış okulu boş bırakır", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    store.setModulePermissions(admin, {
      institutionIds: [DEMO_IDS.INST_C],
      moduleSlugs: ANALYSIS_MODULES.map((m) => m.slug),
      examTypes: ["LGS"],
      enabled: false,
    });
    expect(store.enabledModules(DEMO_IDS.INST_C)).toHaveLength(0);
  });

  it("yönetici tek okul ve toplu okul düzeyinde yetki değiştirir", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    store.setModulePermissions(admin, {
      institutionIds: [DEMO_IDS.INST_B],
      moduleSlugs: ["ders-analizi"],
      examTypes: ["TYT"],
      enabled: true,
    });
    expect(store.isModuleEnabled(DEMO_IDS.INST_B, "ders-analizi", "TYT")).toBe(true);

    store.setModulePermissions(admin, {
      institutionIds: "all",
      moduleSlugs: ["sinav-analizi"],
      examTypes: ["LGS", "TYT"],
      enabled: true,
    });
    expect(store.isModuleEnabled(DEMO_IDS.INST_A, "sinav-analizi", "LGS")).toBe(true);
    expect(store.isModuleEnabled(DEMO_IDS.INST_C, "sinav-analizi", "LGS")).toBe(true);

    const logs = store.listAudit(admin);
    expect(logs.some((l) => l.action === "module.permission" && l.oldValue && l.newValue)).toBe(
      true,
    );
    expect(logs.some((l) => l.institutionId === DEMO_IDS.INST_B && l.moduleSlug === "ders-analizi")).toBe(
      true,
    );
  });
});

describe("cevap dizisi içe aktarma", () => {
  it("ders cevaplarını anahtarla D/Y/B yapar ve okul koduyla eşler", async () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const buffer = await buildAnswerSheetSample("LGS", [
      anonymousLgsStudent({
        studentNo: "00079",
        institutionCode: "000101",
        fullName: "AHMET DEDECAN",
        grade: "8",
        section: "C",
      }),
    ]);
    const preview = await store.previewUpload(admin, {
      buffer,
      fileName: "cevap.xlsx",
      examType: "LGS",
    });
    expect(preview.mapping.format).toBe("answers");
    expect(preview.mapping.subjects.map((row) => row.subjectCode)).toEqual([
      "turkce",
      "inkilap",
      "din",
      "ingilizce",
      "matematik",
      "fen",
    ]);
    expect(preview.rows[0].errors).toEqual([]);
    expect(preview.rows[0].subjects.turkce.correct).toBe(14);
    expect(preview.rows[0].subjects.turkce.wrong).toBe(3);
    expect(preview.rows[0].subjects.turkce.blank).toBe(3);
    expect(preview.rows[0].booklet).toBe("A");
    const committed = await store.commitUpload(admin, {
      previewId: preview.previewId,
      mapping: preview.mapping,
      examName: "Nisan LGS cevap",
      examDate: "2026-04-10",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-LGS-2026-CEVAP",
    });
    expect(committed.imported).toBe(1);
    const result = store.getState().results.find((row) => row.booklet === "A" && row.uploadId);
    expect(result?.totalCorrect).toBe(14 + 7 + 8 + 6 + 12 + 13);
    expect(store.getState().sittings.some((row) => row.answerKeys?.A?.turkce)).toBe(true);
  });

  it("anahtar yoksa cevabı yine de kaydeder", async () => {
    const ExcelJS = await import("exceljs");
    const { workbookToBuffer } = await import("@/lib/import/workbook");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sayfa1");
    sheet.addRow(["okul_no", "okul_kodu", "sinif", "sube", "ad_soyad", "kitapcik", "turkce", "sosyal", "din", "ing", "matematik", "fen"]);
    sheet.addRow(["79", "000101", "8", "C", "AHMET DEDECAN", "A", "AAAAAAAAAAAAAAAAAAAA", "AAAAAAAAAA", "AAAAAAAAAA", "AAAAAAAAAA", "AAAAAAAAAAAAAAAAAAAA", "AAAAAAAAAAAAAAAAAAAA"]);
    const buffer = await workbookToBuffer(workbook);
    const preview = await buildPreview({ buffer, examType: "LGS" });
    expect(preview.mapping.format).toBe("answers");
    expect(preview.rows[0].errors).toEqual([]);
    expect(preview.rows[0].subjects.turkce.answers).toBe("AAAAAAAAAAAAAAAAAAAA");
    expect(preview.rows[0].subjects.turkce.correct).toBe(0);
    expect(preview.mappingIssues.some((issue) => issue.level === "warning" && /cevap anahtarı/i.test(issue.message))).toBe(true);
  });

  it("cevap anahtarına girilen kazanım öğrenci karnesinde görünür", async () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const school = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const buffer = await buildAnswerSheetSample("LGS", [
      anonymousLgsStudent({
        studentNo: "00088",
        institutionCode: "000101",
        fullName: "KARNE ÖĞRENCİ",
        grade: "8",
        section: "A",
      }),
    ]);
    const preview = await store.previewUpload(admin, {
      buffer,
      fileName: "karne.xlsx",
      examType: "LGS",
    });
    await store.commitUpload(admin, {
      previewId: preview.previewId,
      mapping: preview.mapping,
      examName: "Karne LGS",
      examDate: "2026-04-11",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-LGS-KARNE",
    });
    const sitting = store.listExamSittings().find((row) => row.examCode === "MDS-LGS-KARNE")!;
    const keys = structuredClone(sitting.questionKeys!);
    keys.A.turkce[14].outcome = "8.1.2. Metindeki ana fikri belirler";
    store.saveExamQuestionKeys(admin, sitting.id, keys);
    const student = store.getState().students.find((row) => row.sourceStudentNo === "00088")!;
    const profile = store.getAnalysis(school, DEMO_IDS.INST_A, "ogrenci-profili", {
      studentId: student.id,
    });
    const card = profile.studentProfile as {
      reportCard: { missingOutcomes: Array<{ outcome: string; subjectName: string }> };
    };
    expect(card.reportCard.missingOutcomes.some((row) => row.outcome.includes("ana fikri"))).toBe(true);
  });

  it("A 10. soruyu B 20. soruya bağlayınca B öğrencisini ona göre skorlar", async () => {
    const ExcelJS = await import("exceljs");
    const { workbookToBuffer } = await import("@/lib/import/workbook");
    const { identityQuestionMap } = await import("@/lib/import/answers");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sayfa1");
    sheet.addRow(["okul_no", "okul_kodu", "sinif", "sube", "ad_soyad", "kitapcik", "turkce", "sosyal", "din", "ing", "matematik", "fen"]);
    const rest = ["AAAAAAAAAA", "AAAAAAAAAA", "AAAAAAAAAA", "AAAAAAAAAAAAAAAAAAAA", "AAAAAAAAAAAAAAAAAAAA"];
    const allA = "AAAAAAAAAAAAAAAAAAAA";
    sheet.addRow(["81", "000101", "8", "A", "A GRUBU", "A", allA, ...rest]);
    sheet.addRow(["82", "000101", "8", "A", "B GRUBU", "B", allA, ...rest]);
    const buffer = await workbookToBuffer(workbook);
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const school = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const preview = await store.previewUpload(admin, { buffer, fileName: "ab.xlsx", examType: "LGS" });
    expect(preview.rows.every((row) => row.errors.length === 0)).toBe(true);
    await store.commitUpload(admin, {
      previewId: preview.previewId,
      mapping: preview.mapping,
      examName: "A B karsilik",
      examDate: "2026-04-12",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-LGS-AB",
    });
    const sitting = store.listExamSittings().find((row) => row.examCode === "MDS-LGS-AB")!;
    const keys = structuredClone(sitting.questionKeys!);
    keys.A.turkce = keys.A.turkce.map((row, index) => ({
      ...row,
      answer: index === 9 ? "D" : "A",
      outcome: index === 9 ? "A10 kazanimi" : "",
    }));
    const turkceMap = identityQuestionMap(20);
    turkceMap[9] = 20;
    turkceMap[19] = 10;
    store.saveExamQuestionKeys(admin, sitting.id, keys, { B: { turkce: turkceMap } });
    const bStudent = store.getState().students.find((row) => row.sourceStudentNo === "82")!;
    const bResult = store
      .getState()
      .results.find((row) => row.studentId === bStudent.id && row.examSittingId === sitting.id)!;
    const bTurkce = store
      .getState()
      .subjectResults.find((row) => row.resultId === bResult.id && row.subjectCode === "turkce")!;
    expect(bTurkce.correct).toBe(19);
    expect(bTurkce.wrong).toBe(1);
    const profile = store.getAnalysis(school, DEMO_IDS.INST_A, "ogrenci-profili", {
      studentId: bStudent.id,
    });
    const questions = (
      profile.studentProfile as {
        examHistory: Array<{
          questions: Array<{ questionNo: number; sourceQuestionNo: number | null; status: string; outcome: string }>;
        }>;
      }
    ).examHistory[0].questions;
    const q20 = questions.find((row) => row.questionNo === 20 && row.outcome.includes("A10"));
    expect(q20?.status).toBe("wrong");
    expect(q20?.sourceQuestionNo).toBe(10);
  });
});

describe("soru analizi ve iptal", () => {
  it("iptal edilen soruyu herkese doğru sayar", async () => {
    const { scoreAnswers, keyReadyForScoring } = await import("@/lib/import/answers");
    const scored = scoreAnswers("A  ", "ABC", 3, [false, true, false]);
    expect(scored.correct).toBe(2);
    expect(scored.wrong).toBe(0);
    expect(scored.blank).toBe(1);
    expect(keyReadyForScoring("A C", 3, [false, true, false])).toBe(true);
    expect(keyReadyForScoring("A  ", 3)).toBe(false);
  });

  it("soru iptal edilince puan verilir, karneye eksik yazılmaz ve soru analizi oluşur", async () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const school = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const buffer = await buildAnswerSheetSample("LGS", [
      anonymousLgsStudent({
        studentNo: "00091",
        institutionCode: "000101",
        fullName: "İPTAL ÖĞRENCİ",
        grade: "8",
        section: "A",
      }),
    ]);
    const preview = await store.previewUpload(admin, {
      buffer,
      fileName: "iptal.xlsx",
      examType: "LGS",
    });
    await store.commitUpload(admin, {
      previewId: preview.previewId,
      mapping: preview.mapping,
      examName: "İptal LGS",
      examDate: "2026-04-20",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-LGS-IPTAL",
    });
    const sitting = store.listExamSittings().find((row) => row.examCode === "MDS-LGS-IPTAL")!;
    const student = store.getState().students.find((row) => row.sourceStudentNo === "00091")!;
    const result = store
      .getState()
      .results.find((row) => row.studentId === student.id && row.examSittingId === sitting.id)!;
    const turkce = store
      .getState()
      .subjectResults.find((row) => row.resultId === result.id && row.subjectCode === "turkce")!;
    expect(turkce.correct).toBe(14);
    expect(turkce.wrong).toBe(3);

    const keys = structuredClone(sitting.questionKeys!);
    keys.A.turkce[14].outcome = "İptal edilen kazanım";
    keys.A.turkce[14].cancelled = true;
    store.saveExamQuestionKeys(admin, sitting.id, keys);

    const rescored = store
      .getState()
      .subjectResults.find((row) => row.resultId === result.id && row.subjectCode === "turkce")!;
    expect(rescored.correct).toBe(15);
    expect(rescored.wrong).toBe(2);

    const profile = store.getAnalysis(school, DEMO_IDS.INST_A, "ogrenci-profili", {
      studentId: student.id,
      examSittingId: sitting.id,
    });
    const card = profile.studentProfile as {
      reportCard: { missingOutcomes: Array<{ outcome: string }> };
      examHistory: Array<{ questions: Array<{ questionNo: number; status: string; outcome: string }> }>;
    };
    expect(card.reportCard.missingOutcomes.some((row) => row.outcome.includes("İptal edilen"))).toBe(
      false,
    );
    expect(
      card.examHistory[0].questions.find((row) => row.questionNo === 15 && row.outcome.includes("İptal"))
        ?.status,
    ).toBe("cancelled");

    const analysis = store.getAnalysis(school, DEMO_IDS.INST_A, "soru-analizi", {
      examSittingId: sitting.id,
      subjectCode: "turkce",
    });
    const payload = analysis.questionAnalysis as {
      hasAnswers: boolean;
      cancelledCount: number;
      participantCount: number;
      sittingName: string;
      subjects: Array<{
        code: string;
        questions: Array<{
          questionNo: number;
          bQuestionNo: number | null;
          cancelled: boolean;
          wrong: number;
          correct: number;
          correctPct: number;
          difficulty: string;
        }>;
      }>;
    };
    expect(payload.hasAnswers).toBe(true);
    expect(payload.cancelledCount).toBe(1);
    expect(payload.participantCount).toBe(1);
    expect(payload.sittingName).toMatch(/İptal/i);
    const q15 = payload.subjects[0].questions.find((row) => row.questionNo === 15);
    expect(q15?.cancelled).toBe(true);
    expect(q15?.wrong).toBe(1);
    expect(q15?.difficulty).toBe("iptal");
    expect(q15).toHaveProperty("bQuestionNo");
    expect(q15).toHaveProperty("correctPct");
  });

  it("okul, ilçe ve il soru analizini kendi kapsamında üretir", async () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const school = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const district = store.authenticate("cankaya@demo.ilce", DEMO_PASSWORD)!;
    store.createDistrictUser(admin, {
      email: "osmangazi@demo.ilce",
      fullName: "Osmangazi İlçe",
      password: DEMO_PASSWORD,
      city: "Bursa",
      district: "Osmangazi",
    });
    const bursa = store.authenticate("osmangazi@demo.ilce", DEMO_PASSWORD)!;
    const buffer = await buildAnswerSheetSample("LGS", [
      anonymousLgsStudent({
        studentNo: "00093",
        institutionCode: "000101",
        fullName: "SORU ANKARA",
        grade: "8",
        section: "A",
      }),
      anonymousLgsStudent({
        studentNo: "00094",
        institutionCode: "000303",
        fullName: "SORU BURSA",
        grade: "8",
        section: "A",
      }),
    ]);
    const preview = await store.previewUpload(admin, {
      buffer,
      fileName: "soru-kapsam.xlsx",
      examType: "LGS",
    });
    await store.commitUpload(admin, {
      previewId: preview.previewId,
      mapping: preview.mapping,
      examName: "Soru Kapsam LGS",
      examDate: "2026-05-02",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-LGS-SORU-KAPSAM",
    });
    const sitting = store.listExamSittings().find((row) => row.examCode === "MDS-LGS-SORU-KAPSAM")!;
    const keys = structuredClone(sitting.questionKeys!);
    keys.A.turkce[0].outcome = "Metindeki ana fikri belirler";
    store.saveExamQuestionKeys(admin, sitting.id, keys);

    const schoolPayload = store.getAnalysis(school, DEMO_IDS.INST_A, "soru-analizi", {
      examSittingId: sitting.id,
      subjectCode: "turkce",
    }).questionAnalysis as {
      hasAnswers: boolean;
      participantCount: number;
      subjects: Array<{
        code: string;
        questions: Array<{ questionNo: number; correct: number; outcome: string; correctPct: number }>;
      }>;
    };
    expect(schoolPayload.hasAnswers).toBe(true);
    expect(schoolPayload.participantCount).toBe(1);
    expect(schoolPayload.subjects).toHaveLength(1);
    expect(schoolPayload.subjects[0].questions[0].outcome).toMatch(/ana fikri/i);

    const filters = { examType: "LGS" as const, examSittingId: sitting.id, subjectCode: "turkce" };
    const cankayaNet = store.getNetworkAnalysis(district, filters);
    expect(cankayaNet.schools.map((row) => row.id)).toEqual([DEMO_IDS.INST_A]);
    expect(cankayaNet.questionAnalysis?.participantCount).toBe(1);
    expect(cankayaNet.questionAnalysis?.hasAnswers).toBe(true);

    const bursaNet = store.getNetworkAnalysis(bursa, filters);
    expect(bursaNet.schools.map((row) => row.id)).toEqual([DEMO_IDS.INST_C]);
    expect(bursaNet.questionAnalysis?.participantCount).toBe(1);

    const provinceNet = store.getNetworkAnalysis(admin, filters);
    expect(provinceNet.questionAnalysis?.participantCount).toBe(2);
    expect(provinceNet.schools.map((row) => row.id).sort()).toEqual(
      [DEMO_IDS.INST_A, DEMO_IDS.INST_C].sort(),
    );

    const ankaraNet = store.getNetworkAnalysis(admin, { ...filters, city: "Ankara" });
    expect(ankaraNet.questionAnalysis?.participantCount).toBe(1);
    expect(ankaraNet.schools.every((row) => row.city === "Ankara")).toBe(true);
  });
});

describe("öğrenci karnesi", () => {
  it("okul müdürü şube için tüm öğrenci karnelerini üretir", () => {
    const store = demoStore();
    const school = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const report = store.listClassReportCards(school, DEMO_IDS.INST_A, {
      sittingId: "sit-lgs-3",
      grade: "8",
      section: "A",
    });
    expect(report?.institution.name).toMatch(/Atatürk/i);
    expect(report?.cards.map((row) => row.student.studentNo)).toEqual(["00001", "00002", "00003"]);
    expect(report?.cards[0].subjects.some((row) => row.name.includes("Türkçe"))).toBe(true);
    expect(report?.cards[0].totals.net).toBeGreaterThan(0);
    expect(report?.cards[0].totals.cityRank).toBe(report?.cards[0].totals.schoolRank);
    expect(report?.cards[0].totals.districtRank).toBe(report?.cards[0].totals.schoolRank);
    expect(report?.cards[0].totals.cityCount).toBe(report?.cards[0].totals.schoolCount);
  });

  it("sözel ve sayısal sıralamaları farklı puanlara göre üretir", () => {
    const a = {
      score: 400,
      scoreSay: 450,
      scoreEa: 400,
      scoreSoz: 300,
    } as ExamResult;
    const b = {
      score: 420,
      scoreSay: 350,
      scoreEa: 410,
      scoreSoz: 420,
    } as ExamResult;
    const setsA = buildKarneRankSets([a, b], [a, b], [a, b], a);
    expect(setsA.say.schoolRank).toBe(1);
    expect(setsA.soz.schoolRank).toBe(2);
    expect(setsA.genel.schoolRank).toBe(2);
    expect(setsA.ea.schoolRank).toBe(2);
  });

  it("AYT karnesinde puan türüne göre sıralama kümeleri üretir", () => {
    const store = demoStore();
    const school = store.authenticate("okul.b@demo.okul", DEMO_PASSWORD)!;
    const report = store.listClassReportCards(school, DEMO_IDS.INST_B, {
      sittingId: "sit-ayt-1",
      grade: "12",
      section: "A",
    });
    const card = report?.cards[0];
    expect(card?.totals.rankSets.genel.schoolRank).toBe(card?.totals.schoolRank);
    expect(card?.totals.rankSets.soz.schoolCount).toBe(4);
    expect(card?.totals.rankSets.say.schoolCount).toBe(4);
  });

  it("aynı sınavın puansız kopyası karne sırasını şişirmez", () => {
    const store = demoStore();
    const school = store.authenticate("okul.b@demo.okul", DEMO_PASSWORD)!;
    const before = store.listClassReportCards(school, DEMO_IDS.INST_B, {
      sittingId: "sit-ayt-1",
      grade: "12",
      section: "A",
    });
    const state = store.getState();
    const sitting = state.sittings.find((row) => row.id === "sit-ayt-1")!;
    const copyId = "sit-ayt-1-kopya";
    state.sittings.push({ ...sitting, id: copyId, examCode: `${sitting.examCode}-KOPYA` });
    for (const result of state.results.filter((row) => row.examSittingId === sitting.id)) {
      const copyResultId = `${result.id}-kopya`;
      state.results.push({
        ...result,
        id: copyResultId,
        examSittingId: copyId,
        score: null,
        scoreSay: null,
        scoreEa: null,
        scoreSoz: null,
      });
      for (const subject of state.subjectResults.filter((row) => row.resultId === result.id)) {
        state.subjectResults.push({ ...subject, id: `${subject.id}-kopya`, resultId: copyResultId });
      }
    }

    const report = store.listClassReportCards(school, DEMO_IDS.INST_B, {
      sittingId: copyId,
      grade: "12",
      section: "A",
    });
    expect(report?.cards.length).toBe(before?.cards.length);
    expect(report?.cards.every((row) => row.totals.scoreSoz != null || row.totals.scoreSay != null)).toBe(
      true,
    );
    expect(report?.cards[0].totals.schoolCount).toBe(before?.cards[0].totals.schoolCount);
    expect(report?.cards[0].totals.cityCount).toBe(before?.cards[0].totals.cityCount);
    expect(report?.cards[0].totals.districtCount).toBe(before?.cards[0].totals.districtCount);
    const schoolPeers = state.results.filter(
      (row) => row.examSittingId === sitting.id && row.institutionId === DEMO_IDS.INST_B,
    );
    const best = [...(report?.cards ?? [])].sort(
      (a, b) => (b.totals.scoreSoz ?? 0) - (a.totals.scoreSoz ?? 0),
    )[0];
    const expectedRank =
      schoolPeers.filter((row) => (row.scoreSoz ?? Number.NEGATIVE_INFINITY) > (best?.totals.scoreSoz ?? 0))
        .length + 1;
    expect(best?.totals.rankSets.soz.schoolRank).toBe(expectedRank);
    expect(best?.totals.rankSets.soz.schoolCount).toBe(new Set(schoolPeers.map((row) => row.studentId)).size);
    expect(best?.totals.cityCount).toBe(best?.totals.rankSets.soz.schoolCount);
  });

  it("sayısal ve sözel puanlara göre ayrı okul sırası üretir", () => {
    const store = demoStore();
    const school = store.authenticate("okul.b@demo.okul", DEMO_PASSWORD)!;
    const payload = store.getAnalysis(school, DEMO_IDS.INST_B, "basari-sirasi", {
      examType: "AYT",
    });
    const rankings = payload.rankings as Array<{
      studentNo: string;
      schoolRank: number;
      rankSay: number;
      rankSoz: number;
      scoreSay: number | null;
      scoreSoz: number | null;
    }>;
    expect(rankings.length).toBe(4);
    expect(rankings.every((row) => row.rankSay >= 1 && row.rankSoz >= 1)).toBe(true);
    const bySay = [...rankings].sort((a, b) => a.rankSay - b.rankSay);
    const bySoz = [...rankings].sort((a, b) => a.rankSoz - b.rankSoz);
    expect(bySay[0].scoreSay ?? 0).toBeGreaterThanOrEqual(bySay.at(-1)?.scoreSay ?? 0);
    expect(bySoz[0].scoreSoz ?? 0).toBeGreaterThanOrEqual(bySoz.at(-1)?.scoreSoz ?? 0);
  });

  it("karnede kazanım bazlı doğru yanlış boş sonuçları üretir", async () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const school = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const buffer = await buildAnswerSheetSample("LGS", [
      anonymousLgsStudent({
        studentNo: "00092",
        institutionCode: "000101",
        fullName: "KAZANIM ÖĞRENCİ",
        grade: "8",
        section: "B",
      }),
    ]);
    const preview = await store.previewUpload(admin, {
      buffer,
      fileName: "kazanim-karne.xlsx",
      examType: "LGS",
    });
    await store.commitUpload(admin, {
      previewId: preview.previewId,
      mapping: preview.mapping,
      examName: "Kazanım karnesi",
      examDate: "2026-04-21",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-LGS-KAZANIM",
    });
    const sitting = store.listExamSittings().find((row) => row.examCode === "MDS-LGS-KAZANIM")!;
    const keys = structuredClone(sitting.questionKeys!);
    keys.A.turkce[0].outcome = "Metindeki ana fikri belirler";
    keys.A.turkce[14].outcome = "Görsellerle ilgili soruları çözer";
    store.saveExamQuestionKeys(admin, sitting.id, keys);
    const report = store.listClassReportCards(school, DEMO_IDS.INST_A, {
      sittingId: sitting.id,
      grade: "8",
      section: "B",
    });
    const card = report?.cards.find((row) => row.student.studentNo === "00092");
    expect(card?.questions.some((row) => row.questionNo === 1 && row.outcome.includes("ana fikri"))).toBe(
      true,
    );
    const missing = card?.outcomeResults.find((row) => row.outcome.includes("Görsellerle"));
    const gained = card?.outcomeResults.find((row) => row.outcome.includes("ana fikri"));
    expect(missing?.wrong).toBe(1);
    expect(missing?.correct).toBe(0);
    expect(gained?.correct).toBe(1);
    expect(gained?.wrong).toBe(0);
  });

  it("kazanım sonuçlarını LGS ve TYT ders sırasına göre dizer", () => {
    const base = {
      sourceQuestionNo: null,
      studentAnswer: "A",
      correctAnswer: "B",
    };
    const lgs = aggregateOutcomeResults(
      [
        { ...base, subjectCode: "fen", subjectName: "Fen Bilimleri", questionNo: 1, outcome: "F.8.1", status: "wrong" },
        { ...base, subjectCode: "din", subjectName: "Din Kültürü ve Ahlak Bilgisi", questionNo: 1, outcome: "8.1.2", status: "wrong" },
        { ...base, subjectCode: "turkce", subjectName: "Türkçe", questionNo: 2, outcome: "T2", status: "correct" },
        { ...base, subjectCode: "turkce", subjectName: "Türkçe", questionNo: 1, outcome: "T1", status: "wrong" },
        { ...base, subjectCode: "matematik", subjectName: "Matematik", questionNo: 1, outcome: "M1", status: "blank" },
      ],
      "LGS",
    );
    expect(lgs.map((row) => row.subjectCode)).toEqual(["turkce", "turkce", "din", "matematik", "fen"]);
    const tyt = aggregateOutcomeResults(
      [
        { ...base, subjectCode: "fen", subjectName: "Fen Bilimleri", questionNo: 1, outcome: "Fen", status: "wrong" },
        { ...base, subjectCode: "matematik", subjectName: "Temel Matematik", questionNo: 1, outcome: "Mat", status: "correct" },
        { ...base, subjectCode: "sosyal", subjectName: "Sosyal Bilimler", questionNo: 1, outcome: "Sos", status: "blank" },
        { ...base, subjectCode: "turkce", subjectName: "Türkçe", questionNo: 1, outcome: "Tur", status: "correct" },
      ],
      "TYT",
    );
    expect(tyt.map((row) => row.subjectCode)).toEqual(["turkce", "sosyal", "matematik", "fen"]);
  });
});

describe("içe aktarma", () => {
  it("öğrenci ve kurum kodlarındaki baştaki sıfırları korur", async () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const buffer = await buildLgsSample([
      anonymousLgsStudent({
        studentNo: "00007",
        institutionCode: "000101",
        fullName: "Anonim 8C-01",
        grade: "8",
        section: "C",
      }),
    ]);
    const preview = await store.previewUpload(admin, {
      buffer,
      fileName: "lgs.xlsx",
      examType: "LGS",
    });
    expect(preview.rows[0].studentNo).toBe("00007");
    expect(preview.rows[0].institutionCode).toBe("000101");
    const committed = await store.commitUpload(admin, {
      previewId: preview.previewId,
      mapping: preview.mapping,
      examName: "Nisan LGS",
      examDate: "2026-04-10",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-LGS-2026-04",
    });
    expect(committed.imported).toBe(1);
    const student = store
      .getState()
      .students.find((s) => s.sourceStudentNo === "00007");
    expect(student?.sourceStudentNo).toBe("00007");
    expect(student?.institutionId).toBe(DEMO_IDS.INST_A);
  });

  it("bilinmeyen kurum kodunu reddeder", async () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const buffer = await buildLgsSample([
      anonymousLgsStudent({ studentNo: "00008", institutionCode: "009999" }),
    ]);
    const preview = await store.previewUpload(admin, {
      buffer,
      fileName: "unknown.xlsx",
      examType: "LGS",
    });
    const committed = await store.commitUpload(admin, {
      previewId: preview.previewId,
      mapping: preview.mapping,
      examName: "Mayıs LGS",
      examDate: "2026-05-02",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-LGS-2026-05",
    });
    expect(committed.imported).toBe(0);
    expect(committed.errors[0].message).toMatch(/Kurum kodu (veritabanında bulunamadı|kayıtlı okullarda yok)/);
    expect(committed.errors[0].rowNumber).toBe(2);
  });

  it("TYT yinelenen sosyal sütunlarını onaysız içe aktarmaz", async () => {
    const buffer = await buildTytSample([
      anonymousTytStudent({ studentNo: "00011", institutionCode: "000202" }),
    ]);
    const preview = await buildPreview({ buffer, examType: "TYT" });
    const math = preview.mapping.subjects.find((s) => s.suggestion === "Muhtemel Matematik");
    expect(math).toBeTruthy();
    expect(math?.confirmed).toBe(false);
    expect(math?.needsConfirmation).toBe(true);
    expect(preview.mappingIssues.some((i) => i.message.includes("Muhtemel Matematik"))).toBe(
      true,
    );

    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const sessionPreview = await store.previewUpload(admin, {
      buffer,
      fileName: "tyt.xlsx",
      examType: "TYT",
    });
    await expect(
      store.commitUpload(admin, {
        previewId: sessionPreview.previewId,
        mapping: sessionPreview.mapping,
        examName: "Mart TYT",
        examDate: "2026-03-01",
        academicYearId: DEMO_IDS.YEAR_ID,
        publisher: "Örnek Yayın",
        examCode: "MDS-TYT-2026-03",
      }),
    ).rejects.toThrow(/onay|Matematik|eşlenmedi/i);

    const confirmed = {
      ...sessionPreview.mapping,
      subjects: sessionPreview.mapping.subjects.map((subject) =>
        subject.suggestion === "Muhtemel Matematik"
          ? {
              ...subject,
              subjectCode: "matematik",
              label: "Temel Matematik",
              confirmed: true,
              needsConfirmation: false,
            }
          : subject,
      ),
    };
    const confirmedPreview = await store.previewUpload(admin, {
      buffer,
      fileName: "tyt-onay.xlsx",
      examType: "TYT",
    });
    const imported = await store.commitUpload(admin, {
      previewId: confirmedPreview.previewId,
      mapping: confirmed,
      examName: "Mart TYT Onaylı",
      examDate: "2026-03-02",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-TYT-2026-03B",
    });
    expect(imported.imported).toBe(1);
  });

  it("kaynak net ile hesaplanan net uyuşmazlığını gösterir", async () => {
    const buffer = await buildLgsSample([
      anonymousLgsStudent({ studentNo: "00001", institutionCode: "000101" }),
    ]);
    const preview = await buildPreview({ buffer, examType: "LGS" });
    expect(preview.mismatchCount).toBeGreaterThan(0);
    expect(preview.rows[0].netMismatch).toBe(true);
    expect(preview.rows[0].sourceNet).not.toBe(preview.rows[0].calculatedNet);
    const turkce = preview.rows[0].subjects.turkce;
    expect(turkce.sourceNet).toBe(14);
    expect(turkce.calculatedNet).toBe(calculateNet(14, 3, "LGS"));
  });

  it("aynı dosyanın tekrar yüklenmesi mükerrer sonuç üretmez", async () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const buffer = await buildLgsSample([
      anonymousLgsStudent({
        studentNo: "00009",
        institutionCode: "000101",
        fullName: "Anonim 8D-01",
        section: "D",
      }),
    ]);
    const first = await store.previewUpload(admin, {
      buffer,
      fileName: "dup.xlsx",
      examType: "LGS",
    });
    const result = await store.commitUpload(admin, {
      previewId: first.previewId,
      mapping: first.mapping,
      examName: "Haziran LGS",
      examDate: "2026-06-01",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-LGS-2026-06",
    });
    expect(result.imported).toBe(1);
    const second = await store.previewUpload(admin, {
      buffer,
      fileName: "dup.xlsx",
      examType: "LGS",
    });
    await expect(
      store.commitUpload(admin, {
        previewId: second.previewId,
        mapping: second.mapping,
        examName: "Haziran LGS",
        examDate: "2026-06-01",
        academicYearId: DEMO_IDS.YEAR_ID,
        publisher: "Örnek Yayın",
        examCode: "MDS-LGS-2026-06-B",
      }),
    ).rejects.toThrow(/daha önce yüklenmiş|mükerrer/i);
    const copies = store
      .getState()
      .results.filter((r) => r.studentId.startsWith("stu-") === false)
      .filter((r) => {
        const student = store.getState().students.find((s) => s.id === r.studentId);
        return student?.sourceStudentNo === "00009";
      });
    expect(copies).toHaveLength(1);
  });

  it("sistem yöneticisinin okulu yoktur ve tüm yüklemeleri görür", async () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    expect(admin.role).toBe("system_admin");
    expect(admin.institutionIds).toEqual([]);
    expect(store.listInstitutions(admin).map((row) => row.code).sort()).toEqual([
      "000101",
      "000202",
      "000303",
    ]);
    const names = store.listUploads(admin).map((row) => row.fileName);
    expect(names).toEqual(expect.arrayContaining(["anonim-lgs-ornek.xlsx", "anonim-tyt-ornek.xlsx"]));

    const bulent = store.authenticate("bulent", ADMIN_BULENT_PASSWORD)!;
    expect(bulent.role).toBe("system_admin");
    expect(bulent.fullName).toBe("Bülent");
    expect(bulent.institutionIds).toEqual([]);
    expect(store.authenticate(ADMIN_BULENT_EMAIL, ADMIN_BULENT_PASSWORD)?.id).toBe(bulent.id);
  });

  it("okul kullanıcısı sonuç yükleyemez", async () => {
    const store = demoStore();
    const schoolA = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const buffer = await buildLgsSample([
      anonymousLgsStudent({ studentNo: "00001", institutionCode: "000101" }),
    ]);
    await expect(
      store.previewUpload(schoolA, {
        buffer,
        fileName: "okul.xlsx",
        examType: "LGS",
      }),
    ).rejects.toThrow(/yalnızca sistem yöneticisine/i);
  });

  it("yönetici dosyadaki kurum kodlarına göre birden fazla okula yazar", async () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const buffer = await buildLgsSample([
      anonymousLgsStudent({ studentNo: "00091", institutionCode: "000101", fullName: "Anonim A" }),
      anonymousLgsStudent({ studentNo: "00092", institutionCode: "000303", fullName: "Anonim C" }),
    ]);
    const preview = await store.previewUpload(admin, {
      buffer,
      fileName: "coklu.xlsx",
      examType: "LGS",
    });
    const committed = await store.commitUpload(admin, {
      previewId: preview.previewId,
      mapping: preview.mapping,
      examName: "Ortak LGS",
      examDate: "2026-05-10",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-LGS-2026-COKLU",
    });
    expect(committed.imported).toBe(2);
    const results = store.getState().results.filter((row) => row.uploadId === committed.upload.id);
    const schoolIds = new Set(results.map((row) => row.institutionId));
    expect(schoolIds).toEqual(new Set([DEMO_IDS.INST_A, DEMO_IDS.INST_C]));
  });
});

describe("okul kaydı ve kurum kodu girişi", () => {
  it("yeni okul kurum kodu ile girer ve şifresini onaysız değiştirir", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const created = store.createInstitution(admin, {
      code: "000404",
      name: "Yeni Ortaokul",
      city: "Ankara",
      district: "Çankaya",
      type: "ortaokul",
      examTypePermissions: ["LGS"],
    });
    expect(created.login).toEqual({ code: "000404", password: "000404" });
    const school = store.authenticate("000404", "000404");
    expect(school?.role).toBe("school_user");
    expect(school?.institutionIds).toEqual([created.institution.id]);

    store.changePassword(school!, "000404", "YeniSifre1");
    expect(store.authenticate("000404", "000404")).toBeNull();
    expect(store.hasStoredPassword("000404")).toBe(true);
    expect(store.authenticate("000404", "YeniSifre1")?.id).toBe(school?.id);
  });

  it("şifre değişince aynı okulun diğer giriş hesabı da eski şifreyi bırakır", () => {
    const store = demoStore();
    const school = store.authenticate("000101", DEMO_PASSWORD)!;
    store.getState().users.push({
      id: "duplicate-school-login",
      email: "000101@okul.local",
      fullName: "Kopya giriş",
      role: "school_user",
      passwordHash: store.getState().users.find((row) => row.id === school.id)!.passwordHash,
      createdAt: new Date().toISOString(),
    });
    store.getState().memberships.push({
      id: "mem-duplicate-school-login",
      userId: "duplicate-school-login",
      institutionId: DEMO_IDS.INST_A,
    });
    store.changePassword(school, DEMO_PASSWORD, "YeniSifre1");
    expect(store.authenticate("000101", DEMO_PASSWORD)).toBeNull();
    expect(store.authenticate("000101@okul.local", DEMO_PASSWORD)).toBeNull();
    expect(store.authenticate("000101", "YeniSifre1")?.id).toBe("duplicate-school-login");
    expect(store.authenticate("okul.a@demo.okul", "YeniSifre1")?.id).toBe(school.id);
  });

  it("kayıtlı demo okul da kurum kodu ile girer", () => {
    const store = demoStore();
    const byCode = store.authenticate("000101", DEMO_PASSWORD);
    const byEmail = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD);
    expect(byCode?.id).toBe(byEmail?.id);
    expect(byCode?.institutionIds).toEqual([DEMO_IDS.INST_A]);
  });

  it("sınav satırındaki kurum kodunu kayıtlı okulla eşler", () => {
    const store = demoStore();
    const inst = store.getState().institutions.find((row) => row.id === DEMO_IDS.INST_A)!;
    expect(findInstitutionByCode(store.getState().institutions, "000101")?.id).toBe(inst.id);
    expect(findInstitutionByCode(store.getState().institutions, "101")?.id).toBe(inst.id);
    expect(institutionCodesEqual("000101", "101")).toBe(true);
    expect(institutionCodesEqual("000101", "000202")).toBe(false);
  });

  it("okul bilgilerini günceller ve kod değişince yeni kodla girilir", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const created = store.createInstitution(admin, {
      code: "000404",
      name: "Yeni Ortaokul",
      city: "Ankara",
      district: "Çankaya",
      type: "ortaokul",
      examTypePermissions: ["LGS"],
    });
    const updated = store.updateInstitution(admin, created.institution.id, {
      code: "000505",
      name: "Güncel Ortaokul",
      city: "Ankara",
      district: "Keçiören",
      type: "ortaokul",
      examTypePermissions: ["LGS"],
    });
    expect(updated.name).toBe("Güncel Ortaokul");
    expect(updated.code).toBe("000505");
    expect(updated.district).toBe("Keçiören");
    expect(store.authenticate("000404", "000404")).toBeNull();
    expect(store.authenticate("000505", "000404")?.institutionIds).toEqual([created.institution.id]);
  });

  it("aynı kurum kodunu başka okula vermez", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const created = store.createInstitution(admin, {
      code: "000404",
      name: "Yeni Ortaokul",
      city: "Ankara",
      district: "Çankaya",
      type: "ortaokul",
      examTypePermissions: ["LGS"],
    });
    expect(() =>
      store.updateInstitution(admin, created.institution.id, { code: "000101" }),
    ).toThrow(AppError);
    expect(() => store.updateInstitution(admin, created.institution.id, { code: "101" })).toThrow(
      AppError,
    );
  });

  it("okulu ve bağlı öğrenci sonuçlarını siler", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    expect(store.authenticate("000101", DEMO_PASSWORD)?.role).toBe("school_user");
    expect(store.getState().students.some((row) => row.institutionId === DEMO_IDS.INST_A)).toBe(true);
    expect(store.getState().results.some((row) => row.institutionId === DEMO_IDS.INST_A)).toBe(true);

    store.deleteInstitution(admin, DEMO_IDS.INST_A);

    expect(store.getState().institutions.some((row) => row.id === DEMO_IDS.INST_A)).toBe(false);
    expect(store.getState().students.some((row) => row.institutionId === DEMO_IDS.INST_A)).toBe(false);
    expect(store.getState().results.some((row) => row.institutionId === DEMO_IDS.INST_A)).toBe(false);
    expect(store.getState().permissions.some((row) => row.institutionId === DEMO_IDS.INST_A)).toBe(
      false,
    );
    expect(store.authenticate("000101", DEMO_PASSWORD)).toBeNull();
    expect(store.getState().institutions.some((row) => row.id === DEMO_IDS.INST_B)).toBe(true);
    expect(store.getState().students.some((row) => row.institutionId === DEMO_IDS.INST_B)).toBe(true);
  });

  it("okul kullanıcısı kurum düzenleyemez veya silemez", () => {
    const store = demoStore();
    const school = store.authenticate("000101", DEMO_PASSWORD)!;
    expect(() => store.updateInstitution(school, DEMO_IDS.INST_A, { name: "Hack" })).toThrow(
      AppError,
    );
    expect(() => store.deleteInstitution(school, DEMO_IDS.INST_A)).toThrow(AppError);
    expect(store.getInstitution(school, DEMO_IDS.INST_A).name).not.toBe("Hack");
  });

  it("okul hem ortaokul hem lise olabilir", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const created = store.createInstitution(admin, {
      code: "000909",
      name: "Karma Kampüs",
      city: "Ankara",
      district: "Keçiören",
      types: ["lise", "ortaokul"],
      examTypePermissions: [],
    });
    expect(created.institution.types).toEqual(["ortaokul", "lise"]);
    expect(created.institution.type).toBe("ortaokul");
    expect(created.institution.examTypePermissions).toEqual(["LGS", "TYT", "AYT"]);
    expect(formatInstitutionTypes(created.institution)).toBe("Ortaokul, Lise");
    expect(
      store.listInstitutions(admin, { type: "ortaokul" }).some((row) => row.id === created.institution.id),
    ).toBe(true);
    expect(
      store.listInstitutions(admin, { type: "lise" }).some((row) => row.id === created.institution.id),
    ).toBe(true);

    const updated = store.updateInstitution(admin, created.institution.id, {
      types: ["lise"],
      examTypePermissions: ["TYT"],
    });
    expect(updated.types).toEqual(["lise"]);
    expect(
      store.listInstitutions(admin, { type: "ortaokul" }).some((row) => row.id === created.institution.id),
    ).toBe(false);
  });

  it("eski tek tür kaydını çoklu türe taşır", () => {
    const state = buildDemoState();
    state.schemaVersion = 5;
    delete (state.institutions[0] as { types?: string[] }).types;
    const { state: next } = migrateAppState(state);
    expect(next.schemaVersion).toBe(26);
    expect(next.institutions[0].types).toEqual(["ortaokul"]);
  });
});

describe("AYT yükleme görünürlüğü", () => {
  it("yalnızca AYT yüklendiğinde analiz boş TYT gibi görünmez", async () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const created = store.createInstitution(admin, {
      code: "000808",
      name: "AYT Lisesi",
      city: "İzmir",
      district: "Konak",
      type: "lise",
      examTypePermissions: ["TYT", "AYT"],
    });
    const school = store.authenticate("000808", "000808")!;
    const buffer = await buildAytSample([
      anonymousAytStudent({ studentNo: "00021", institutionCode: "000808" }),
    ]);
    const preview = await store.previewUpload(admin, {
      buffer,
      fileName: "ornek-ayt-anonim.xlsx",
      examType: "AYT",
    });
    expect(preview.mappingIssues.some((issue) => issue.level === "error")).toBe(false);
    const committed = await store.commitUpload(admin, {
      previewId: preview.previewId,
      mapping: preview.mapping,
      examName: "Nisan AYT",
      examDate: "2026-04-12",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-AYT-2026-04",
    });
    expect(committed.imported).toBe(1);
    const aytOnly = store
      .getState()
      .results.find((row) => row.institutionId === created.institution.id);
    expect(aytOnly?.score).toBeNull();
    expect(aytOnly?.scoreSay).toBeNull();

    const payload = store.getAnalysis(school, created.institution.id, "okul-ozeti", {});
    expect(payload.empty).toBe(false);
    expect((payload.lastExam as { examType: string }).examType).toBe("AYT");

    const tytView = store.getAnalysis(school, created.institution.id, "okul-ozeti", {
      examType: "TYT",
    });
    expect(tytView.empty).toBe(true);
    expect(tytView.otherExamTypes).toEqual(["AYT"]);
  });

  it("AYT dosyası TYT olarak okununca uyarı verir", async () => {
    const buffer = await buildAytSample([
      anonymousAytStudent({ studentNo: "00021", institutionCode: "000202" }),
    ]);
    const preview = await buildPreview({ buffer, examType: "TYT" });
    expect(preview.mappingIssues[0]?.message).toMatch(/Sınav türünü AYT/i);
  });

  it("önce TYT sonra AYT yüklenince üç puan türü dolar", async () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const created = store.createInstitution(admin, {
      code: "000818",
      name: "TYT-AYT Lisesi",
      city: "İzmir",
      district: "Konak",
      type: "lise",
      examTypePermissions: ["AYT"],
    });
    expect(created.institution.examTypePermissions).toEqual(["TYT", "AYT"]);
    const tytBuffer = await buildAnswerSheetSample("TYT", [
      anonymousTytStudent({ studentNo: "00031", institutionCode: "000818", fullName: "Anonim 12C-01" }),
    ]);
    const tytPreview = await store.previewUpload(admin, {
      buffer: tytBuffer,
      fileName: "tyt-once.xlsx",
      examType: "TYT",
    });
    await store.commitUpload(admin, {
      previewId: tytPreview.previewId,
      mapping: tytPreview.mapping,
      examName: "Mart TYT",
      examDate: "2026-03-01",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-TYT-2026-03-818",
    });
    const aytBuffer = await buildAytSample([
      anonymousAytStudent({ studentNo: "00031", institutionCode: "000818", fullName: "Anonim 12C-01" }),
    ]);
    const aytPreview = await store.previewUpload(admin, {
      buffer: aytBuffer,
      fileName: "ayt-sonra.xlsx",
      examType: "AYT",
    });
    const committed = await store.commitUpload(admin, {
      previewId: aytPreview.previewId,
      mapping: aytPreview.mapping,
      examName: "Nisan AYT",
      examDate: "2026-04-12",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-AYT-2026-04-818",
    });
    expect(committed.imported).toBe(1);
    const result = store
      .getState()
      .results.find((row) => row.examSittingId === committed.sitting.id);
    expect(result?.scoreSay).toBeGreaterThan(100);
    expect(result?.scoreEa).toBeGreaterThan(100);
    expect(result?.scoreSoz).toBeGreaterThan(100);
    expect(result?.score).toBe(
      Math.max(result!.scoreSay!, result!.scoreEa!, result!.scoreSoz!),
    );
    const school = store.authenticate("000818", "000818")!;
    const payload = store.getAnalysis(school, created.institution.id, "okul-ozeti", {
      examType: "AYT",
    });
    const rankings = payload.rankings as Array<{ scoreSay: number | null; score: number | null }>;
    expect(rankings[0]?.scoreSay).toBe(result?.scoreSay);
    expect(rankings[0]?.score).toBe(result?.score);
  });

  it("AYT önce yüklenirse TYT gelince puanları yeniden hesaplar", async () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    store.createInstitution(admin, {
      code: "000828",
      name: "Gecikmeli TYT Lisesi",
      city: "İzmir",
      district: "Konak",
      type: "lise",
    });
    const aytBuffer = await buildAytSample([
      anonymousAytStudent({ studentNo: "00032", institutionCode: "000828" }),
    ]);
    const aytPreview = await store.previewUpload(admin, {
      buffer: aytBuffer,
      fileName: "ayt-once.xlsx",
      examType: "AYT",
    });
    const aytCommit = await store.commitUpload(admin, {
      previewId: aytPreview.previewId,
      mapping: aytPreview.mapping,
      examName: "Nisan AYT",
      examDate: "2026-04-12",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-AYT-2026-04-828",
    });
    const before = store.getState().results.find((row) => row.examSittingId === aytCommit.sitting.id);
    expect(before?.score).toBeNull();
    const tytBuffer = await buildAnswerSheetSample("TYT", [
      anonymousTytStudent({ studentNo: "00032", institutionCode: "000828" }),
    ]);
    const tytPreview = await store.previewUpload(admin, {
      buffer: tytBuffer,
      fileName: "tyt-sonra.xlsx",
      examType: "TYT",
    });
    await store.commitUpload(admin, {
      previewId: tytPreview.previewId,
      mapping: tytPreview.mapping,
      examName: "Mart TYT",
      examDate: "2026-03-01",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-TYT-2026-03-828",
    });
    const after = store.getState().results.find((row) => row.examSittingId === aytCommit.sitting.id);
    expect(after?.score).not.toBeNull();
    expect(after?.scoreSay).toBeGreaterThan(100);
  });

  it("AYT puanı seçilen TYT oturumuna göre hesaplanır", async () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    store.createInstitution(admin, {
      code: "000838",
      name: "TYT Seçimli Lise",
      city: "İzmir",
      district: "Konak",
      type: "lise",
    });
    const weakTyt = await store.previewUpload(admin, {
      buffer: await buildAnswerSheetSample("TYT", [
        anonymousTytStudent({
          studentNo: "00033",
          institutionCode: "000838",
          fullName: "Anonim 12C-01",
          subjects: [
            [8, 20, 12, 3],
            [4, 10, 6, 1.5],
            [6, 20, 14, 1],
            [3, 10, 7, 0.5],
          ],
        }),
      ]),
      fileName: "tyt-zayif.xlsx",
      examType: "TYT",
    });
    const weakCommit = await store.commitUpload(admin, {
      previewId: weakTyt.previewId,
      mapping: weakTyt.mapping,
      examName: "Zayıf TYT",
      examDate: "2026-02-01",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-TYT-2026-02-838",
    });
    const strongTyt = await store.previewUpload(admin, {
      buffer: await buildAnswerSheetSample("TYT", [
        anonymousTytStudent({
          studentNo: "00033",
          institutionCode: "000838",
          fullName: "Anonim 12C-01",
        }),
      ]),
      fileName: "tyt-guclu.xlsx",
      examType: "TYT",
    });
    const strongCommit = await store.commitUpload(admin, {
      previewId: strongTyt.previewId,
      mapping: strongTyt.mapping,
      examName: "Güçlü TYT",
      examDate: "2026-03-01",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-TYT-2026-03-838",
    });
    const aytWeakPreview = await store.previewUpload(admin, {
      buffer: await buildAytSample([
        anonymousAytStudent({
          studentNo: "00033",
          institutionCode: "000838",
          fullName: "Anonim 12C-01",
        }),
      ]),
      fileName: "ayt-zayif-tyt.xlsx",
      examType: "AYT",
    });
    const aytWeak = await store.commitUpload(admin, {
      previewId: aytWeakPreview.previewId,
      mapping: aytWeakPreview.mapping,
      examName: "Nisan AYT zayıf TYT",
      examDate: "2026-04-12",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-AYT-2026-04-838-A",
      tytSittingId: weakCommit.sitting.id,
    });
    const aytStrongPreview = await store.previewUpload(admin, {
      buffer: await buildAytSample([
        anonymousAytStudent({
          studentNo: "00033",
          institutionCode: "000838",
          fullName: "Anonim 12C-02",
        }),
      ]),
      fileName: "ayt-guclu-tyt.xlsx",
      examType: "AYT",
    });
    const aytStrong = await store.commitUpload(admin, {
      previewId: aytStrongPreview.previewId,
      mapping: aytStrongPreview.mapping,
      examName: "Nisan AYT güçlü TYT",
      examDate: "2026-04-13",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-AYT-2026-04-838-B",
      tytSittingId: strongCommit.sitting.id,
    });
    expect(aytWeak.sitting.tytSittingId).toBe(weakCommit.sitting.id);
    expect(aytStrong.sitting.tytSittingId).toBe(strongCommit.sitting.id);
    const weakScore = store
      .getState()
      .results.find((row) => row.examSittingId === aytWeak.sitting.id)?.scoreSay;
    const strongScore = store
      .getState()
      .results.find((row) => row.examSittingId === aytStrong.sitting.id)?.scoreSay;
    expect(weakScore).toBeGreaterThan(100);
    expect(strongScore).toBeGreaterThan(weakScore!);
  });

  it("okul raporu seçilen AYT puan türüne göre sıralar", () => {
    const store = demoStore();
    const aytResults = store.getState().results.filter((row) => row.examSittingId === "sit-ayt-1");
    for (const row of aytResults) {
      row.scoreSay = 100;
      row.scoreEa = 100;
      row.scoreSoz = 100;
      row.score = 100;
    }
    const byStudent = new Map(aytResults.map((row) => [row.studentId, row]));
    const first = byStudent.get("stu-b-00011")!;
    const second = byStudent.get("stu-b-00012")!;
    first.scoreSay = 500;
    first.scoreSoz = 200;
    first.score = 500;
    second.scoreSay = 200;
    second.scoreSoz = 490;
    second.score = 490;
    const school = store.authenticate("okul.b@demo.okul", DEMO_PASSWORD)!;
    const soz = store.buildStudentAveragesReport(school, {
      scope: "okul",
      institutionId: DEMO_IDS.INST_B,
      filters: { examType: "AYT", scoreTrack: "soz" },
    });
    const say = store.buildStudentAveragesReport(school, {
      scope: "okul",
      institutionId: DEMO_IDS.INST_B,
      filters: { examType: "AYT", scoreTrack: "say" },
    });
    expect(soz.students).toHaveLength(byStudent.size);
    expect(soz.students[0]?.studentNo).toBe("00012");
    expect(soz.students[0]?.score).toBe(490);
    expect(say.students[0]?.studentNo).toBe("00011");
    expect(say.students[0]?.score).toBe(500);
    const sozRanked = store.getAnalysis(school, DEMO_IDS.INST_B, "basari-sirasi", {
      examType: "AYT",
      scoreTrack: "soz",
    });
    const rankings = sozRanked.rankings as Array<{ studentNo: string; rankSoz: number }>;
    expect(rankings[0]?.studentNo).toBe("00012");
    expect(rankings[0]?.rankSoz).toBe(1);
    const copy = { ...store.getState().sittings.find((row) => row.id === "sit-ayt-1")! };
    copy.id = "sit-ayt-1-kopya";
    store.getState().sittings.push(copy);
    for (const result of aytResults) {
      const id = `${result.id}-kopya`;
      store.getState().results.push({
        ...result,
        id,
        examSittingId: copy.id,
        score: null,
        scoreSay: null,
        scoreEa: null,
        scoreSoz: null,
      });
      for (const subject of store.getState().subjectResults.filter((row) => row.resultId === result.id)) {
        store.getState().subjectResults.push({ ...subject, id: `${subject.id}-kopya`, resultId: id });
      }
    }
    const once = store.buildStudentAveragesReport(school, {
      scope: "okul",
      institutionId: DEMO_IDS.INST_B,
      filters: { examType: "AYT", examSittingId: "sit-ayt-1", scoreTrack: "soz" },
    });
    expect(once.students).toHaveLength(byStudent.size);
    expect(new Set(once.students.map((row) => row.studentNo)).size).toBe(byStudent.size);
    expect(once.summaries.find((row) => row.label === "OKUL")?.participants).toBe(byStudent.size);
    expect(once.students.every((row) => row.score != null)).toBe(true);
  });

  it("LGS liseye, TYT ortaokula yüklenmez", async () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const lgsOnLise = await store.previewUpload(admin, {
      buffer: await buildLgsSample([
        anonymousLgsStudent({ studentNo: "00041", institutionCode: "000202" }),
      ]),
      fileName: "lgs-lise.xlsx",
      examType: "LGS",
    });
    const lgsCommit = await store.commitUpload(admin, {
      previewId: lgsOnLise.previewId,
      mapping: lgsOnLise.mapping,
      examName: "Hatalı LGS",
      examDate: "2026-04-01",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-LGS-2026-04-B",
    });
    expect(lgsCommit.imported).toBe(0);
    expect(lgsCommit.errors[0]?.message).toMatch(/LGS yalnızca ortaokullara/i);

    const tytOnOrta = await store.previewUpload(admin, {
      buffer: await buildAnswerSheetSample("TYT", [
        anonymousTytStudent({ studentNo: "00042", institutionCode: "000101" }),
      ]),
      fileName: "tyt-orta.xlsx",
      examType: "TYT",
    });
    const tytCommit = await store.commitUpload(admin, {
      previewId: tytOnOrta.previewId,
      mapping: tytOnOrta.mapping,
      examName: "Hatalı TYT",
      examDate: "2026-04-01",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-TYT-2026-04-A",
    });
    expect(tytCommit.imported).toBe(0);
    expect(tytCommit.errors[0]?.message).toMatch(/TYT yalnızca liselere/i);
  });

  it("ortaokul AYT yetkisi alamaz, lise LGS yetkisi alamaz", () => {
    expect(sanitizeExamTypes(["ortaokul"], ["AYT", "TYT"])).toEqual(["LGS"]);
    expect(sanitizeExamTypes(["lise"], ["LGS", "AYT"])).toEqual(["TYT", "AYT"]);
    expect(sanitizeExamTypes(["lise"], ["TYT"])).toEqual(["TYT"]);
  });
});

describe("analiz menü ağacı", () => {
  it("gruplar tüm analiz modüllerini tek kez kapsar", () => {
    const grouped = MODULE_GROUPS.flatMap((group) => group.slugs);
    expect(grouped.sort()).toEqual(ANALYSIS_MODULES.map((row) => row.slug).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(ANALYSIS_MODULES.every((row) => row.navLabel.length > 0)).toBe(true);
  });

  it("il analizi grupları tüm il modüllerini tek kez kapsar", () => {
    const grouped = IL_MODULE_GROUPS.flatMap((group) => group.slugs);
    expect(grouped.sort()).toEqual(IL_ANALYSIS_MODULES.map((row) => row.slug).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("okul paneli linkleri kurum ve sınav filtresini korur", () => {
    const query = new URLSearchParams("kurum=inst-a&yil=year-1&tur=LGS");
    expect(withKeptQuery(panelPath("mudahale-onerileri", "inst-a"), query)).toBe(
      "/panel/mudahale-onerileri?kurum=inst-a&yil=year-1&tur=LGS",
    );
    expect(withKeptQuery("/panel/ders-analizi", query)).toBe(
      "/panel/ders-analizi?kurum=inst-a&yil=year-1&tur=LGS",
    );
  });

  it("sayfa başlığı hangi menü grubunda olduğunu gösterir", () => {
    expect(pageSectionFromPath("/yukle")).toBe("İşlemler");
    expect(pageSectionFromPath("/panel/sinif-karsilastirma")).toBe("Okul analizi");
    expect(pageSectionFromPath("/il-analizi/ders")).toBe("İl analizi");
    expect(pageSectionFromPath("/il-analizi/ders", "district_admin")).toBe("İlçe analizi");
    expect(pageSectionFromPath("/yonetim/yuklemeler")).toBe("Yönetim");
  });
});

describe("ölçme ve değerlendirme", () => {
  it("il altında kalan okulu müdahale bandına alır", () => {
    const evaluation = buildSchoolEvaluation({
      schoolAvgNet: 8,
      provinceAvgNet: 20,
      previousAvgNet: 14,
      studentNets: [2, 4, 6, 22, 24],
      subjects: [
        { code: "matematik", name: "Matematik", avgNet: 3 },
        { code: "turkce", name: "Türkçe", avgNet: 12 },
      ],
      peerRank: 4,
      peerCount: 4,
    });
    expect(evaluation.traffic).toBe("mudahale");
    expect(evaluation.vsProvince).toBe(-12);
    expect(evaluation.peerRank).toBe(4);
    expect(evaluation.interventions.length).toBeGreaterThan(0);
  });

  it("il röntgeni zayıf okulları işaretler", () => {
    const evaluation = buildProvinceEvaluation({
      provinceAvgNet: 18,
      previousAvgNet: 21,
      studentNets: [4, 6, 18, 30, 32],
      subjects: [
        { code: "matematik", name: "Matematik", avgNet: 8 },
        { code: "fen", name: "Fen", avgNet: 16 },
      ],
      schools: [
        { id: "a", name: "A", avgNet: 28 },
        { id: "b", name: "B", avgNet: 6 },
      ],
    });
    expect(trafficFromScore(evaluation.compositeScore)).toBe(evaluation.traffic);
    expect(evaluation.urgentSchools.some((row) => row.id === "b")).toBe(true);
    expect(evaluation.successSchools.some((row) => row.id === "a")).toBe(true);
  });

  it("okul analiz yükünde röntgen üretir", () => {
    const store = demoStore();
    const school = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const payload = store.getAnalysis(school, DEMO_IDS.INST_A, "olcme-degerlendirme", {
      examType: "LGS",
    });
    expect(payload.empty).toBe(false);
    const evaluation = payload.evaluation as { traffic: string; peerCount: number };
    expect(evaluation.traffic).toMatch(/guclu|izle|mudahale/);
    expect(evaluation.peerCount).toBeGreaterThan(0);
  });

  it("il analiz yükünde röntgen üretir", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const payload = store.getNetworkAnalysis(admin, { examType: "LGS" });
    expect(payload.evaluation).not.toBeNull();
    expect(payload.evaluation?.urgentSchools).toBeDefined();
    expect(payload.schoolProgress.length).toBe(payload.schools.length);
  });
});

describe("sınıf/şube yazımı", () => {
  it("8 / 8.0 / 8A / 8-A yazımlarını aynı sınıfa indirir", () => {
    expect(parseClassPlacement("8", "A")).toEqual({ grade: "8", section: "A" });
    expect(parseClassPlacement(8.0, "A")).toEqual({ grade: "8", section: "A" });
    expect(parseClassPlacement("8.0", "")).toEqual({ grade: "8", section: "" });
    expect(parseClassPlacement("08", "a")).toEqual({ grade: "8", section: "A" });
    expect(parseClassPlacement("8A", "")).toEqual({ grade: "8", section: "A" });
    expect(parseClassPlacement("8-A", "")).toEqual({ grade: "8", section: "A" });
    expect(parseClassPlacement("8. Sınıf", "B")).toEqual({ grade: "8", section: "B" });
    expect(parseClassPlacement("", "8-C")).toEqual({ grade: "8", section: "C" });
  });

  it("birleşik hücre ve boş sınıf satırlarını üst/alt satırdan doldurur", async () => {
    const buffer = await buildLgsSample([
      anonymousLgsStudent({ studentNo: "10001", institutionCode: "000101", fullName: "Bos 1", grade: "", section: "" }),
      anonymousLgsStudent({ studentNo: "10002", institutionCode: "000101", fullName: "Bos 2", grade: "", section: "" }),
      anonymousLgsStudent({ studentNo: "10003", institutionCode: "000101", fullName: "Bos 3", grade: "", section: "" }),
      anonymousLgsStudent({ studentNo: "10004", institutionCode: "000101", fullName: "Dolu", grade: "8", section: "A" }),
    ]);
    const preview = await buildPreview({ buffer, examType: "LGS" });
    expect(preview.errorCount).toBe(0);
    expect(preview.rows).toHaveLength(4);
    expect(preview.rows.every((row) => row.grade === "8" && row.section === "A")).toBe(true);
  });

  it("sınıf hücresindeki 8A yazımından şubeyi çıkarır", async () => {
    const buffer = await buildLgsSample([
      anonymousLgsStudent({ studentNo: "10005", institutionCode: "000101", fullName: "Birlesik", grade: "8A", section: "" }),
    ]);
    const preview = await buildPreview({ buffer, examType: "LGS" });
    expect(preview.rows[0].errors).toEqual([]);
    expect(preview.rows[0].grade).toBe("8");
    expect(preview.rows[0].section).toBe("A");
  });

  it("Excel sayısal 8.0 sınıfını 8 olarak okur", async () => {
    const base = await buildLgsSample([
      anonymousLgsStudent({ studentNo: "10006", institutionCode: "000101", fullName: "Sayisal", grade: "8", section: "E" }),
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(base as unknown as ArrayBuffer);
    workbook.worksheets[0].getRow(2).getCell(4).value = 8.0;
    const preview = await buildPreview({ buffer: await workbookToBuffer(workbook), examType: "LGS" });
    expect(preview.rows[0].grade).toBe("8");
    expect(preview.rows[0].section).toBe("E");
    expect(preview.rows[0].errors).toEqual([]);
  });

  it("birleşik sınıf hücresindeki değeri tüm satırlara yayar", async () => {
    const base = await buildLgsSample([
      anonymousLgsStudent({ studentNo: "10007", institutionCode: "000101", fullName: "M1", grade: "8", section: "F" }),
      anonymousLgsStudent({ studentNo: "10008", institutionCode: "000101", fullName: "M2", grade: "8", section: "F" }),
      anonymousLgsStudent({ studentNo: "10009", institutionCode: "000101", fullName: "M3", grade: "8", section: "F" }),
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(base as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    sheet.mergeCells(2, 4, 4, 4);
    sheet.mergeCells(2, 5, 4, 5);
    const preview = await buildPreview({ buffer: await workbookToBuffer(workbook), examType: "LGS" });
    expect(preview.rows).toHaveLength(3);
    expect(preview.rows.every((row) => row.grade === "8" && row.section === "F")).toBe(true);
    expect(preview.errorCount).toBe(0);
  });

  it("okul özetinde 8.0 ve 8A öğrencilerini 8. sınıfa katar", () => {
    const store = demoStore();
    const state = store.getState();
    const schoolStudents = state.students.filter((student) => student.institutionId === DEMO_IDS.INST_A);
    schoolStudents[0].grade = "8.0";
    schoolStudents[1].grade = "8A";
    schoolStudents[1].section = "";
    const school = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const payload = store.getAnalysis(school, DEMO_IDS.INST_A, "okul-ozeti", {});
    const classes = payload.classComparison as Array<{ grade: string; count: number }>;
    expect(classes).toEqual([expect.objectContaining({ grade: "8", count: schoolStudents.length })]);
  });

  it("eski 8.0 sınıf yazımını 8 yapar", () => {
    const state = buildDemoState();
    state.schemaVersion = 19;
    state.students[0].grade = "8.0";
    state.students[1].grade = "08";
    const { state: next } = migrateAppState(state);
    expect(next.schemaVersion).toBe(26);
    expect(next.students[0].grade).toBe("8");
    expect(next.students[1].grade).toBe("8");
  });
});

describe("bozuk ad ve yıldız karakteri", () => {
  it("* ve boş adları Adsız yapar, * numaraları satır ile ayırır", () => {
    expect(normalizeStudentIdentity("*", "*", 12)).toEqual({
      studentNo: "SATIR-12",
      fullName: "Adsız SATIR-12",
      summary: false,
    });
    expect(normalizeStudentIdentity("10010", "***", 2)).toEqual({
      studentNo: "10010",
      fullName: "Adsız 10010",
      summary: false,
    });
    expect(normalizeStudentIdentity("10011", "AHMET ****", 3)).toEqual({
      studentNo: "10011",
      fullName: "AHMET",
      summary: false,
    });
    expect(normalizeStudentIdentity("", "TOPLAM", 99).summary).toBe(true);
  });

  it("yıldız adlı üç öğrenciyi ayrı kayıt olarak okur", async () => {
    const buffer = await buildLgsSample([
      anonymousLgsStudent({ studentNo: "*", institutionCode: "000101", fullName: "*", grade: "8", section: "A" }),
      anonymousLgsStudent({ studentNo: "*", institutionCode: "000101", fullName: "***", grade: "8", section: "A" }),
      anonymousLgsStudent({ studentNo: "*", institutionCode: "000101", fullName: "", grade: "8", section: "B" }),
    ]);
    const preview = await buildPreview({ buffer, examType: "LGS" });
    expect(preview.errorCount).toBe(0);
    expect(preview.rows).toHaveLength(3);
    expect(new Set(preview.rows.map((row) => row.studentNo)).size).toBe(3);
    expect(preview.rows.every((row) => row.fullName.startsWith("Adsız "))).toBe(true);
  });

  it("yıldız adlı öğrencileri sınava kaydeder", async () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const buffer = await buildLgsSample([
      anonymousLgsStudent({ studentNo: "*", institutionCode: "000101", fullName: "*", section: "C" }),
      anonymousLgsStudent({ studentNo: "*", institutionCode: "000101", fullName: "*", section: "C" }),
      anonymousLgsStudent({ studentNo: "*", institutionCode: "000101", fullName: "*", section: "C" }),
    ]);
    const preview = await store.previewUpload(admin, {
      buffer,
      fileName: "yildiz.xlsx",
      examType: "LGS",
    });
    const result = await store.commitUpload(admin, {
      previewId: preview.previewId,
      mapping: preview.mapping,
      examName: "Yıldız LGS",
      examDate: "2026-06-12",
      academicYearId: DEMO_IDS.YEAR_ID,
      publisher: "Örnek Yayın",
      examCode: "MDS-LGS-2026-YILDIZ",
    });
    expect(result.imported).toBe(3);
    const school = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    const payload = store.getAnalysis(school, DEMO_IDS.INST_A, "okul-ozeti", {
      examSittingId: result.sitting.id,
    });
    const classes = payload.classComparison as Array<{ grade: string; count: number }>;
    expect(classes[0]?.count).toBeGreaterThanOrEqual(3);
  });
});

describe("akademik yıl", () => {
  it("yönetici yeni yıl ekler ve varsayılan yılı değiştirir", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const created = store.createAcademicYear(admin, {
      label: "2026/2027",
      startsOn: "2026-09-07",
      endsOn: "2027-06-18",
      isActive: true,
    });
    expect(created.label).toBe("2026-2027");
    const years = store.listAcademicYears();
    expect(years.map((year) => year.label)).toEqual(["2026-2027", "2025-2026"]);
    expect(years.find((year) => year.id === DEMO_IDS.YEAR_ID)?.isActive).toBe(false);
    expect(preferredAcademicYear(years)?.id).toBe(created.id);
    expect(suggestNextAcademicYear(years).label).toBe("2027-2028");

    const updated = store.updateAcademicYear(admin, created.id, {
      label: "2026-2027",
      startsOn: "2026-09-14",
      endsOn: "2027-06-11",
      isActive: false,
    });
    expect(updated.startsOn).toBe("2026-09-14");
    expect(updated.isActive).toBe(false);
    expect(preferredAcademicYear(store.listAcademicYears())?.id).toBe(DEMO_IDS.YEAR_ID);
  });

  it("okul kullanıcısı yıl ekleyemez, kayıtlı yıl silinemez, boş yıl silinir", () => {
    const store = demoStore();
    const admin = store.authenticate("yonetici@demo.okul", DEMO_PASSWORD)!;
    const school = store.authenticate("okul.a@demo.okul", DEMO_PASSWORD)!;
    expect(() =>
      store.createAcademicYear(school, {
        label: "2027-2028",
        startsOn: "2027-09-06",
        endsOn: "2028-06-16",
      }),
    ).toThrow(/yalnızca yönetici/);
    expect(() => store.deleteAcademicYear(admin, DEMO_IDS.YEAR_ID)).toThrow(/kalmalıdır/);
    expect(() =>
      store.createAcademicYear(admin, {
        label: "2026-2028",
        startsOn: "2026-09-07",
        endsOn: "2028-06-18",
      }),
    ).toThrow(/ardışık/);

    const extra = store.createAcademicYear(admin, {
      label: "2027-2028",
      startsOn: "2027-09-06",
      endsOn: "2028-06-16",
    });
    expect(() => store.deleteAcademicYear(admin, DEMO_IDS.YEAR_ID)).toThrow(/silemezsiniz/);
    expect(store.deleteAcademicYear(admin, extra.id).label).toBe("2027-2028");
    expect(store.listAcademicYears().some((year) => year.id === extra.id)).toBe(false);
    expect(store.getState().sittings.every((row) => row.academicYearId === DEMO_IDS.YEAR_ID)).toBe(
      true,
    );
  });
});
