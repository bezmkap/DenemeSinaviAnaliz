"use client";

import { useRouter } from "next/navigation";
import type { ExamSitting, Institution } from "@/lib/domain";
import type { ClassReportCards } from "@/lib/analiz/compute";
import { StudentKarneSheet } from "@/components/student-report-card";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

export function ClassReportCardsScreen({
  institution,
  sittings,
  classes,
  selectedSittingId,
  selectedClass,
  report,
}: {
  institution: Institution | null;
  sittings: ExamSitting[];
  classes: Array<{ grade: string; section: string }>;
  selectedSittingId: string;
  selectedClass: string;
  report: ClassReportCards | null;
}) {
  const router = useRouter();

  function update(nextSitting: string, nextClass: string) {
    if (!institution) return;
    const params = new URLSearchParams();
    params.set("kurum", institution.id);
    if (nextSitting) params.set("sinav", nextSitting);
    if (nextClass) params.set("sinif", nextClass);
    router.push(`/karne?${params.toString()}`);
  }

  if (!institution) {
    return (
      <div className="max-w-3xl space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Öğrenci karnesi</h1>
        <p className="text-muted-foreground">Karneleri görmek için üstten bir okul seçin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl print:max-w-none">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight">Öğrenci karnesi</h1>
        <p className="mt-2 text-muted-foreground">
          Sınıf ve şube seçin. Her öğrenci karnesi 2 sayfadır; yazdırırken önlü arkalı tek kağıda
          sığar. Kazanım sonuçları ve soru detayı cevap anahtarından gelir.
        </p>
      </div>

      <div className="print:hidden grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1">
          <p className="text-sm font-medium">Sınav</p>
          <select
            className={selectClass}
            value={selectedSittingId}
            onChange={(event) => update(event.target.value, selectedClass)}
          >
            <option value="">Sınav seçin</option>
            {sittings.map((sitting) => (
              <option key={sitting.id} value={sitting.id}>
                {sitting.examType} · {sitting.name} · {sitting.examDate}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Sınıf / şube</p>
          <select
            className={selectClass}
            value={selectedClass}
            onChange={(event) => update(selectedSittingId, event.target.value)}
          >
            <option value="">Sınıf seçin</option>
            {classes.map((row) => (
              <option key={`${row.grade}-${row.section}`} value={`${row.grade}-${row.section}`}>
                {row.grade}-{row.section}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          onClick={() => window.print()}
          disabled={!report?.cards.length}
        >
          Sınıf karnelerini yazdır (2 sayfa / öğrenci)
        </button>
      </div>

      {!selectedSittingId || !selectedClass ? (
        <p className="print:hidden text-sm text-muted-foreground">
          Karneleri oluşturmak için sınav ve sınıf seçin.
        </p>
      ) : !report?.cards.length ? (
        <p className="print:hidden text-sm text-muted-foreground">
          Bu sınıf ve sınav için öğrenci sonucu yok.
        </p>
      ) : (
        <div className="space-y-8 print:space-y-0">
          <p className="print:hidden text-sm text-muted-foreground">
            {report.grade}-{report.section} · {report.cards.length} öğrenci · {report.sitting.name} ·
            her öğrenci 2 sayfa
          </p>
          {report.cards.map((card) => (
            <StudentKarneSheet
              key={card.student.id}
              schoolName={report.institution.name}
              schoolPlace={`${report.institution.city} / ${report.institution.district} · ${report.institution.code}`}
              examName={report.sitting.name}
              examDate={report.sitting.examDate}
              examType={report.sitting.examType}
              publisher={report.sitting.publisher}
              card={card}
            />
          ))}
        </div>
      )}
    </div>
  );
}
