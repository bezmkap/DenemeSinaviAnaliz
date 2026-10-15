import { formatDate, formatNumber } from "@/lib/format";
import type { KarneQuestion, OutcomeResult, StudentKarne } from "@/lib/analiz/compute";
import { RankTable } from "@/components/karne-rank-table";

function missingOutcome(row: OutcomeResult): boolean {
  return row.wrong + row.blank > 0;
}

const MARK_CLASS: Record<KarneQuestion["status"], string> = {
  correct: "bg-emerald-600 text-white",
  wrong: "bg-red-600 text-white",
  blank: "bg-sky-600 text-white",
  cancelled: "bg-muted text-muted-foreground",
};

type SheetMeta = {
  schoolName: string;
  schoolPlace: string;
  examName: string;
  examDate: string;
  examType: string;
  publisher: string;
};

export function StudentKarneSheet({
  schoolName,
  schoolPlace,
  examName,
  examDate,
  examType,
  publisher,
  card,
}: SheetMeta & { card: StudentKarne }) {
  const meta: SheetMeta = { schoolName, schoolPlace, examName, examDate, examType, publisher };
  const outcomes = card.outcomeResults ?? [];
  const questions = card.questions ?? [];
  return (
    <article className="karne-student">
      <section className="karne-page">
        <KarneBanner meta={meta} card={card} page={1} />
        <div className="karne-identity">
          <Info label="Ad soyad" value={card.student.name} />
          <Info label="Okul no" value={card.student.studentNo} mono />
          <Info label="Sınıf / şube" value={`${card.student.grade}-${card.student.section}`} />
          <Info label="Kitapçık" value={card.booklet} />
        </div>
        <div className="karne-front-grid">
          <SubjectResultsTable card={card} />
          <aside className="karne-panel karne-score-panel">
            <div>
              <p className="karne-kicker">Puan</p>
              {examType === "AYT" ? (
                <div className="karne-ayt-scores">
                  {(
                    [
                      ["Sayısal", "scoreSay", "say"],
                      ["EA", "scoreEa", "ea"],
                      ["Sözel", "scoreSoz", "soz"],
                    ] as const
                  ).map(([label, scoreKey, track]) => {
                    const set = card.totals.rankSets?.[track];
                    return (
                      <div key={track}>
                        <p className="karne-kicker">{label}</p>
                        <p className="karne-score-sm">{formatNumber(card.totals[scoreKey], 1)}</p>
                        <p className="karne-muted">
                          {set?.schoolRank != null
                            ? `Okul ${set.schoolRank}${set.schoolCount ? ` / ${set.schoolCount}` : ""}`
                            : "Okul —"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="karne-score">{formatNumber(card.totals.score, 0)}</p>
              )}
              <p className="karne-muted">Net {formatNumber(card.totals.net)}</p>
            </div>
            <RankTable card={card} examType={examType} />
          </aside>
        </div>
        <QuestionMarkSection subjects={card.subjects} questions={questions} />
      </section>
      <section className="karne-page">
        <KarneBanner meta={meta} card={card} page={2} compact />
        <CompactOutcomeTable subjects={card.subjects} rows={outcomes} />
      </section>
    </article>
  );
}

function KarneBanner({
  meta,
  card,
  page,
  compact,
}: {
  meta: SheetMeta;
  card: StudentKarne;
  page: number;
  compact?: boolean;
}) {
  return (
    <header className={`karne-banner ${compact ? "karne-banner-compact" : ""}`}>
      <div>
        <p className="karne-kicker">Öğrenci karnesi</p>
        {compact ? (
          <p className="karne-banner-title">
            {card.student.name} · {card.student.studentNo} · {card.student.grade}-{card.student.section}
          </p>
        ) : (
          <>
            <h2 className="karne-banner-title">{meta.schoolName}</h2>
            <p className="karne-muted">{meta.schoolPlace}</p>
          </>
        )}
        <p className="karne-exam-line">
          {meta.examName} · {formatDate(meta.examDate)} · {meta.examType}
          {meta.publisher ? ` · ${meta.publisher}` : ""}
        </p>
      </div>
      <p className="karne-page-no">
        {page} / 2
      </p>
    </header>
  );
}

function SubjectResultsTable({ card }: { card: StudentKarne }) {
  return (
    <section className="karne-panel">
      <p className="karne-kicker">Ders sonuçları</p>
      <table className="karne-table">
        <thead>
          <tr>
            <th>Ders</th>
            <th>D</th>
            <th>Y</th>
            <th>B</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody>
          {card.subjects.map((subject) => (
            <tr key={subject.code}>
              <td>{subject.name}</td>
              <td className="font-mono">{subject.correct}</td>
              <td className="font-mono">{subject.wrong}</td>
              <td className="font-mono">{subject.blank}</td>
              <td className="font-mono">{formatNumber(subject.net)}</td>
            </tr>
          ))}
          <tr className="karne-total">
            <td>Toplam</td>
            <td className="font-mono">{card.totals.correct}</td>
            <td className="font-mono">{card.totals.wrong}</td>
            <td className="font-mono">{card.totals.blank}</td>
            <td className="font-mono">{formatNumber(card.totals.net)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function QuestionMarkSection({
  subjects,
  questions,
}: {
  subjects: Array<{ code: string; name: string }>;
  questions: KarneQuestion[];
}) {
  if (!questions.length) {
    return (
      <section className="karne-questions">
        <h3 className="karne-section-title">Soru cevapları</h3>
        <p className="karne-muted">
          Soru detayı için öğrenci cevaplarının yüklü olması gerekir.
        </p>
      </section>
    );
  }
  const groups = subjects
    .map((subject) => ({
      ...subject,
      rows: questions.filter((row) => row.subjectCode === subject.code),
    }))
    .filter((group) => group.rows.length);
  const dense = questions.length > 90 || groups.length > 6;
  return (
    <section className="karne-questions">
      <div className="karne-q-head">
        <h3 className="karne-section-title">Soru cevapları</h3>
        <p className="karne-legend">Yeşil doğru · kırmızı yanlış · mavi boş · gri iptal</p>
      </div>
      <div className={`karne-q-groups${dense ? " is-dense" : ""}`}>
        {groups.map((group) => (
          <div key={group.code} className="karne-q-group">
            <p className="karne-q-subject">{group.name}</p>
            <div className="karne-q-grid">
              {group.rows.map((row) => (
                <span
                  key={`${row.subjectCode}-${row.questionNo}`}
                  title={`${row.questionNo}. ${row.outcome || "Kazanım yok"} · Doğru: ${row.correctAnswer || "—"}`}
                  className={`karne-q-cell ${MARK_CLASS[row.status]}`}
                >
                  <b>{row.questionNo}</b>
                  <em>
                    {row.status === "blank" ? "—" : row.status === "cancelled" ? "İ" : row.studentAnswer || "—"}
                  </em>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CompactOutcomeTable({
  subjects,
  rows,
}: {
  subjects: Array<{ code: string; name: string }>;
  rows: OutcomeResult[];
}) {
  const list = rows ?? [];
  const groups = subjects
    .map((subject) => ({
      ...subject,
      rows: list.filter((row) => row.subjectCode === subject.code),
    }))
    .filter((group) => group.rows.length);
  const known = new Set(subjects.map((subject) => subject.code));
  const leftover = list.filter((row) => !known.has(row.subjectCode));
  if (leftover.length) {
    groups.push({ code: "other", name: "Diğer", rows: leftover });
  }
  return (
    <section className="karne-outcomes">
      <h3 className="karne-section-title">Kazanım sonuçları</h3>
      {groups.length ? (
        <div className="karne-outcome-subjects">
          {groups.map((group) => (
            <div key={group.code} className="karne-outcome-block">
              <p className="karne-q-subject">{group.name}</p>
              <div className="karne-outcome-grid">
                {group.rows.map((row) => {
                  const missing = missingOutcome(row);
                  return (
                    <div
                      key={`${row.subjectCode}-${row.outcome}`}
                      className={`karne-outcome-row ${missing ? "is-missing" : ""}`}
                    >
                      <span className="karne-outcome-name">{row.outcome}</span>
                      <span className="font-mono">
                        D{row.correct} Y{row.wrong} B{row.blank}
                      </span>
                      <span className={missing ? "text-red-700" : "text-emerald-700"}>
                        {missing ? "Eksik" : "Tamam"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="karne-muted">
          Cevap anahtarına kazanım girildiyse her kazanımın doğru, yanlış ve boş sayısı burada görünür.
        </p>
      )}
    </section>
  );
}

export function OutcomeResultsTable({ rows }: { rows: OutcomeResult[] }) {
  const list = rows ?? [];
  const missing = list.filter(missingOutcome);
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-sm font-medium">Kazanım sonuçları</h3>
      {list.length ? (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1.5 pr-2 font-medium">Ders</th>
              <th className="py-1.5 pr-2 font-medium">Kazanım</th>
              <th className="py-1.5 pr-2 font-medium">D</th>
              <th className="py-1.5 pr-2 font-medium">Y</th>
              <th className="py-1.5 pr-2 font-medium">B</th>
              <th className="py-1.5 pr-2 font-medium">Soru</th>
              <th className="py-1.5 font-medium">Durum</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => {
              const missingRow = missingOutcome(row);
              return (
                <tr
                  key={`${row.subjectCode}-${row.outcome}`}
                  className={`border-b border-border/70 ${missingRow ? "bg-red-50" : ""}`}
                >
                  <td className="py-1.5 pr-2">{row.subjectName}</td>
                  <td className="py-1.5 pr-2">{row.outcome}</td>
                  <td className="py-1.5 pr-2 font-mono">{row.correct}</td>
                  <td className="py-1.5 pr-2 font-mono">{row.wrong}</td>
                  <td className="py-1.5 pr-2 font-mono">{row.blank}</td>
                  <td className="py-1.5 pr-2 font-mono">{row.questionNos.join(", ")}</td>
                  <td className={`py-1.5 font-medium ${missingRow ? "text-red-700" : "text-emerald-700"}`}>
                    {missingRow ? "Eksik" : "Tamam"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted-foreground">
          Cevap anahtarına kazanım girildiyse her kazanımın doğru, yanlış ve boş sayısı burada görünür.
        </p>
      )}
      {missing.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {missing.length} kazanımda yanlış veya boş cevap var. Öğrenci bu kazanımları tekrar çalışmalı.
        </p>
      ) : null}
    </section>
  );
}

export function SubjectQuestionTables({
  subjects,
  questions,
}: {
  subjects: Array<{ code: string; name: string }>;
  questions: KarneQuestion[];
}) {
  const list = questions ?? [];
  if (!list.length) {
    return (
      <p className="mt-5 text-sm text-muted-foreground">
        Soru ve kazanım detayı için öğrenci cevaplarının yüklü olması gerekir.
      </p>
    );
  }
  const groups = subjects
    .map((subject) => ({
      ...subject,
      rows: list.filter((row) => row.subjectCode === subject.code),
    }))
    .filter((group) => group.rows.length);
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-sm font-medium">Soru ve kazanım detayı</h3>
      <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
        {groups.map((group) => (
          <div key={group.code} className="overflow-hidden rounded-lg border">
            <p className="border-b bg-muted/50 px-3 py-1.5 text-sm font-medium">{group.name}</p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-1 font-medium">No</th>
                  <th className="px-2 py-1 font-medium">Dğr</th>
                  <th className="px-2 py-1 font-medium">Öğr</th>
                  <th className="px-2 py-1 font-medium">Konu / Kazanım</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={`${row.subjectCode}-${row.questionNo}`} className="border-b border-border/60">
                    <td className="px-2 py-1 font-mono">
                      {row.questionNo}
                      {row.sourceQuestionNo ? ` (A:${row.sourceQuestionNo})` : ""}
                    </td>
                    <td className="px-2 py-1 font-mono">{row.correctAnswer || "—"}</td>
                    <td className="px-2 py-1">
                      <span
                        className={`inline-flex min-w-6 justify-center rounded px-1 font-mono ${MARK_CLASS[row.status]}`}
                      >
                        {row.status === "blank" ? "—" : row.status === "cancelled" ? "İ" : row.studentAnswer || "—"}
                      </span>
                    </td>
                    <td className="px-2 py-1">{row.outcome || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="karne-kicker">{label}</p>
      <p className={mono ? "font-mono font-medium" : "font-medium"}>{value}</p>
    </div>
  );
}
