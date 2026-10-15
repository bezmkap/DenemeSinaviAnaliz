"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { EXAM_TYPES, EXAM_AREA_LABELS, preferredAcademicYear, type AcademicYear, type ExamArea, type ExamSitting, type ExamType } from "@/lib/domain";
import { AYT_RANK_TRACKS, parseScoreTrack } from "@/lib/analiz/compute";
import { useIsClient } from "@/lib/utils";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

function FieldLabel({ children }: { children: string }) {
  return <p className="text-sm font-medium">{children}</p>;
}

export function NetworkFilters({
  years,
  sittings,
  cities,
  districts,
  defaultExamType,
  lockedPlace = null,
  moduleSlug,
  subjects = [],
  canManageYears = false,
}: {
  years: AcademicYear[];
  sittings: ExamSitting[];
  cities: string[];
  districts: string[];
  defaultExamType: ExamType;
  lockedPlace?: { city: string; district: string } | null;
  moduleSlug?: string;
  subjects?: Array<{ code: string; name: string }>;
  canManageYears?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const isClient = useIsClient();
  const defaultYear = preferredAcademicYear(years)?.id ?? "";
  const year = isClient ? (params.get("yil") ?? defaultYear) : defaultYear;
  const examType = (isClient ? (params.get("tur") as ExamType | null) : null) || defaultExamType;
  const sitting = isClient ? (params.get("sinav") ?? "") : "";
  const city = isClient ? (params.get("il") ?? "") : "";
  const district = isClient ? (params.get("ilce") ?? "") : "";
  const dateFrom = isClient ? (params.get("baslangic") ?? "") : "";
  const subject = isClient ? (params.get("ders") ?? "") : "";
  const examArea = isClient ? (params.get("alan") ?? "") : "";
  const visibleSittings = sittings.filter(
    (row) => row.examType === examType && (!year || row.academicYearId === year),
  );
  const showSubject = moduleSlug === "soru";
  const showExamArea = examType === "AYT";

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
      const current = sittings.find((row) => row.id === next.get("sinav"));
      if (current && value && current.academicYearId !== value) next.delete("sinav");
    }
    if (key === "il") next.delete("ilce");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6 rounded-xl border bg-card p-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="space-y-1">
        <FieldLabel>Akademik yıl</FieldLabel>
        <select className={selectClass} value={year} onChange={(e) => update("yil", e.target.value)}>
          {years.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        {canManageYears ? (
          <Link href="/yonetim/akademik-yillar" className="text-xs text-primary hover:underline">
            Yıl ekle veya değiştir
          </Link>
        ) : null}
      </div>
      <div className="space-y-1">
        <FieldLabel>Sınav türü</FieldLabel>
        <select className={selectClass} value={examType} onChange={(e) => update("tur", e.target.value)}>
          {EXAM_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <FieldLabel>Sınav</FieldLabel>
        <select className={selectClass} value={sitting} onChange={(e) => update("sinav", e.target.value)}>
          <option value="">Her okulun son {examType} sınavı</option>
          {visibleSittings.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {examType === "AYT" ? (
        <div className="space-y-1">
          <FieldLabel>Puan türü</FieldLabel>
          <select
            className={selectClass}
            value={parseScoreTrack(isClient ? params.get("puan") : null)}
            onChange={(e) => update("puan", e.target.value === "genel" ? "" : e.target.value)}
          >
            {AYT_RANK_TRACKS.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {showExamArea ? (
        <div className="space-y-1">
          <FieldLabel>Alan</FieldLabel>
          <select
            className={selectClass}
            value={examArea}
            onChange={(e) => update("alan", e.target.value)}
          >
            <option value="">Tüm alanlar</option>
            {(Object.entries(EXAM_AREA_LABELS) as [ExamArea, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="space-y-1">
        <FieldLabel>{lockedPlace ? "Kapsam" : "İl"}</FieldLabel>
        {lockedPlace ? (
          <p className="flex h-8 items-center rounded-lg border bg-muted/40 px-2.5 text-sm">
            {lockedPlace.district} / {lockedPlace.city}
          </p>
        ) : (
          <select className={selectClass} value={city} onChange={(e) => update("il", e.target.value)}>
            <option value="">Tüm iller</option>
            {cities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        )}
      </div>
      {lockedPlace ? null : (
        <div className="space-y-1">
          <FieldLabel>İlçe</FieldLabel>
          <select className={selectClass} value={district} onChange={(e) => update("ilce", e.target.value)}>
            <option value="">Tüm ilçeler</option>
            {districts.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1">
        <FieldLabel>Tarih (başlangıç)</FieldLabel>
        <input
          type="date"
          className={selectClass}
          value={dateFrom}
          onChange={(e) => update("baslangic", e.target.value)}
        />
      </div>
      {showSubject ? (
        <div className="space-y-1">
          <FieldLabel>Ders</FieldLabel>
          <select className={selectClass} value={subject} onChange={(e) => update("ders", e.target.value)}>
            <option value="">Tüm dersler</option>
            {subjects.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </form>
  );
}
