"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { preferredAcademicYear, type AcademicYear, type ExamSitting, type ExamType, EXAM_AREA_LABELS, type ExamArea } from "@/lib/domain";
import { AYT_RANK_TRACKS, parseScoreTrack } from "@/lib/analiz/compute";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

type FilterKey =
  | "yil"
  | "tur"
  | "sinav"
  | "baslangic"
  | "bitis"
  | "sinif"
  | "sube"
  | "ders"
  | "ogrenci";

const PINNED_BY_MODULE: Record<string, FilterKey[]> = {
  "ogrenci-profili": ["ogrenci"],
  "ders-analizi": ["ders"],
  "soru-analizi": ["ders"],
  "akran-karsilastirma": ["ogrenci"],
};

const EXTRA_BY_MODULE: Record<string, FilterKey[]> = {
  "okul-ozeti": [],
  "olcme-degerlendirme": [],
  "sinav-analizi": [],
  "ogrenci-sonuclari": ["sinif", "sube", "ogrenci"],
  "sinif-karsilastirma": ["sinif"],
  "sube-karsilastirma": ["sinif", "sube"],
  "ders-analizi": [],
  "dybn-analizi": ["ders"],
  "soru-analizi": ["sinif", "sube"],
  "puan-dagilim": [],
  "sinavlar-arasi-gelisim": ["baslangic", "bitis"],
  "ogrenci-performans": ["sinif", "sube", "ogrenci"],
  "basari-sirasi": ["sinif", "sube"],
  "risk-analizi": ["sinif", "sube"],
  "gelisim-trendi": ["baslangic", "bitis"],
  "akran-karsilastirma": ["sinif", "sube"],
  "sinif-detay-analizi": ["sinif", "sube"],
  "ogrenci-profili": [],
  "mudahale-onerileri": ["sinif", "sube"],
};

export function AnalysisFilters({
  years,
  sittings,
  grades,
  sections,
  students,
  subjects,
  allowedExamTypes,
  defaultExamType,
  moduleSlug,
  canManageYears = false,
}: {
  years: AcademicYear[];
  sittings: ExamSitting[];
  grades: string[];
  sections: string[];
  students: Array<{ id: string; fullName: string; sourceStudentNo: string }>;
  subjects: Array<{ code: string; name: string }>;
  allowedExamTypes: ExamType[];
  defaultExamType: ExamType;
  moduleSlug?: string;
  canManageYears?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const examType = (params.get("tur") as ExamType) || defaultExamType;
  const selectedYear = params.get("yil") ?? preferredAcademicYear(years)?.id ?? "";
  const visibleSittings = sittings.filter(
    (s) => s.examType === examType && (!selectedYear || s.academicYearId === selectedYear),
  );
  const pinned = PINNED_BY_MODULE[moduleSlug ?? ""] ?? [];
  const extras = EXTRA_BY_MODULE[moduleSlug ?? ""] ?? [
    "baslangic",
    "bitis",
    "sinif",
    "sube",
    "ders",
    "ogrenci",
  ];
  const extrasHaveValue = extras.some((key) => Boolean(params.get(key)));
  const [openExtra, setOpenExtra] = useState(extrasHaveValue);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "tur") {
      next.delete("sinav");
      next.delete("ders");
      if (value !== "AYT") {
        next.delete("puan");
        next.delete("alan");
      }
    }
    if (key === "yil") {
      const sitting = sittings.find((row) => row.id === next.get("sinav"));
      if (sitting && value && sitting.academicYearId !== value) next.delete("sinav");
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  function field(key: FilterKey) {
    if (key === "yil") {
      return (
        <div key={key} className="space-y-1">
          <Label>Akademik yıl</Label>
          <select
            className={selectClass}
            value={selectedYear}
            onChange={(e) => update("yil", e.target.value)}
          >
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.label}
              </option>
            ))}
          </select>
          {canManageYears ? (
            <Link href="/yonetim/akademik-yillar" className="text-xs text-primary hover:underline">
              Yıl ekle veya değiştir
            </Link>
          ) : null}
        </div>
      );
    }
    if (key === "tur") {
      return (
        <div key={key} className="space-y-1">
          <Label>Sınav türü</Label>
          <select
            className={selectClass}
            value={examType}
            onChange={(e) => update("tur", e.target.value)}
          >
            {allowedExamTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (key === "sinav") {
      return (
        <div key={key} className="space-y-1">
          <Label>Sınav</Label>
          <select
            className={selectClass}
            value={params.get("sinav") ?? ""}
            onChange={(e) => update("sinav", e.target.value)}
          >
            <option value="">Son {examType} sınavı</option>
            {visibleSittings.map((sitting) => (
              <option key={sitting.id} value={sitting.id}>
                {sitting.name}
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (key === "baslangic") {
      return (
        <div key={key} className="space-y-1">
          <Label>Tarih (başlangıç)</Label>
          <Input
            type="date"
            value={params.get("baslangic") ?? ""}
            onChange={(e) => update("baslangic", e.target.value)}
          />
        </div>
      );
    }
    if (key === "bitis") {
      return (
        <div key={key} className="space-y-1">
          <Label>Tarih (bitiş)</Label>
          <Input
            type="date"
            value={params.get("bitis") ?? ""}
            onChange={(e) => update("bitis", e.target.value)}
          />
        </div>
      );
    }
    if (key === "sinif") {
      return (
        <div key={key} className="space-y-1">
          <Label>Sınıf</Label>
          <select
            className={selectClass}
            value={params.get("sinif") ?? ""}
            onChange={(e) => update("sinif", e.target.value)}
          >
            <option value="">Tümü</option>
            {grades.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (key === "sube") {
      return (
        <div key={key} className="space-y-1">
          <Label>Şube</Label>
          <select
            className={selectClass}
            value={params.get("sube") ?? ""}
            onChange={(e) => update("sube", e.target.value)}
          >
            <option value="">Tümü</option>
            {sections.map((section) => (
              <option key={section} value={section}>
                {section}
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (key === "ders") {
      return (
        <div key={key} className="space-y-1">
          <Label>Ders</Label>
          <select
            className={selectClass}
            value={params.get("ders") ?? ""}
            onChange={(e) => update("ders", e.target.value)}
          >
            <option value="">Tümü</option>
            {subjects.map((subject) => (
              <option key={subject.code} value={subject.code}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>
      );
    }
    return (
      <div key={key} className="space-y-1 sm:col-span-2 xl:col-span-1">
        <Label>Öğrenci</Label>
        <select
          className={selectClass}
          value={params.get("ogrenci") ?? ""}
          onChange={(e) => update("ogrenci", e.target.value)}
        >
          <option value="">{moduleSlug === "ogrenci-profili" ? "Öğrenci seçin" : "Tümü"}</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.sourceStudentNo} · {student.fullName}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <form className="rounded-xl border bg-card p-4" onSubmit={(event) => event.preventDefault()}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(["yil", "tur", "sinav"] as FilterKey[]).concat(pinned).map(field)}
        {examType === "AYT" ? (
          <>
            <div className="space-y-1">
              <Label>Puan türü</Label>
              <select
                className={selectClass}
                value={parseScoreTrack(params.get("puan"))}
                onChange={(e) => update("puan", e.target.value === "genel" ? "" : e.target.value)}
              >
                {AYT_RANK_TRACKS.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Alan</Label>
              <select
                className={selectClass}
                value={params.get("alan") ?? ""}
                onChange={(e) => update("alan", e.target.value)}
              >
                <option value="">Tüm alanlar</option>
                {(Object.entries(EXAM_AREA_LABELS) as [ExamArea, string][]).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}
      </div>
      {extras.length ? (
        <div className="mt-3">
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => setOpenExtra((value) => !value)}
          >
            {openExtra ? "Ek filtreleri gizle" : "Daha fazla filtre"}
          </button>
          {openExtra ? <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{extras.map(field)}</div> : null}
        </div>
      ) : null}
    </form>
  );
}
