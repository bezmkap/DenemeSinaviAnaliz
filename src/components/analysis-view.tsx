"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deltaLabel, formatDate, formatNumber } from "@/lib/format";
import { ANALYSIS_MODULES, MODULE_GROUPS, panelPath } from "@/lib/domain";
import { SchoolEvaluationPanel } from "@/components/evaluation-panels";
import type { SchoolEvaluation } from "@/lib/analiz/evaluation";
import {
  AYT_RANK_TRACKS,
  parseScoreTrack,
  type KarneQuestion,
  type KarneRankTrack,
  type OutcomeResult,
  type QuestionAnalysisPayload,
} from "@/lib/analiz/compute";
import { OutcomeResultsTable, SubjectQuestionTables } from "@/components/student-report-card";
import { QuestionAnalysisPanel } from "@/components/question-analysis-panel";
import Link from "next/link";

type Payload = Record<string, unknown>;

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {hint ? <CardContent className="text-xs text-muted-foreground">{hint}</CardContent> : null}
    </Card>
  );
}

type SchoolRankingRow = {
  studentNo: string;
  name: string;
  grade: string;
  section: string;
  net: number;
  score: number | null;
  scoreSay: number | null;
  scoreEa: number | null;
  scoreSoz: number | null;
  schoolRank: number;
  rankSay: number;
  rankEa: number;
  rankSoz: number;
  correct: number;
  wrong: number;
  blank: number;
};

function rankForTrack(row: SchoolRankingRow, track: KarneRankTrack): number {
  if (track === "say") return row.rankSay;
  if (track === "ea") return row.rankEa;
  if (track === "soz") return row.rankSoz;
  return row.schoolRank;
}

function SchoolRankingTable({
  examType,
  rankings,
  scoreTrack,
}: {
  examType?: string;
  rankings: SchoolRankingRow[];
  scoreTrack?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isAyt = examType === "AYT";
  const track = isAyt ? parseScoreTrack(scoreTrack) : "genel";
  const active = AYT_RANK_TRACKS.find((tab) => tab.id === track);
  const rows = useMemo(() => {
    if (!isAyt) return rankings;
    return [...rankings].sort((a, b) => rankForTrack(a, track) - rankForTrack(b, track));
  }, [isAyt, rankings, track]);

  function setTrack(id: KarneRankTrack) {
    const next = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    if (id === "genel") next.delete("puan");
    else next.set("puan", id);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Okul içi başarı sırası</CardTitle>
        {isAyt ? (
          <CardDescription>{active?.hint ?? "Puana göre okul içi sıra"}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {isAyt ? (
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Sıralama puan türü">
            {AYT_RANK_TRACKS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={track === tab.id}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                  track === tab.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground"
                }`}
                onClick={() => setTrack(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sıra</TableHead>
              <TableHead>No</TableHead>
              <TableHead>Ad</TableHead>
              <TableHead>Şube</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>{isAyt ? "SAY / EA / SÖZ" : "Puan"}</TableHead>
              <TableHead>D / Y / B</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.studentNo}>
                <TableCell>{isAyt ? rankForTrack(row, track) : row.schoolRank}</TableCell>
                <TableCell className="font-mono">{row.studentNo}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>
                  {row.grade}-{row.section}
                </TableCell>
                <TableCell>{formatNumber(row.net)}</TableCell>
                <TableCell>
                  {isAyt
                    ? `${formatNumber(row.scoreSay)} / ${formatNumber(row.scoreEa)} / ${formatNumber(row.scoreSoz)}`
                    : formatNumber(row.score)}
                </TableCell>
                <TableCell>
                  {row.correct}/{row.wrong}/{row.blank}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

type StudentReportProfile = {
  student: { name: string; studentNo: string; grade: string; section: string };
  examHistory: Array<{
    examName: string;
    date: string;
    subjects: Array<{ code: string; name: string }>;
    questions: KarneQuestion[];
    missingOutcomes: Array<{ outcome: string; subjectName: string; count: number }>;
    outcomeResults: OutcomeResult[];
  }>;
  reportCard: {
    missingOutcomes: Array<{ outcome: string; subjectName: string; count: number }>;
    gainedOutcomes: Array<{ outcome: string; subjectName: string; count: number }>;
  };
};

function StudentReportCard({ profile }: { profile: StudentReportProfile }) {
  const missing = profile.reportCard?.missingOutcomes ?? [];
  const exams = (profile.examHistory ?? []).filter((exam) => exam.questions?.length);
  const latest = exams.at(-1);
  return (
    <Card className="print:border-0 print:shadow-none">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Öğrenci karnesi</CardTitle>
          <CardDescription>
            {profile.student.name} · {profile.student.grade}-{profile.student.section} · No{" "}
            {profile.student.studentNo}
          </CardDescription>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-lg border px-3 text-sm print:hidden"
          onClick={() => window.print()}
        >
          Karneyi yazdır
        </button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="mb-2 text-sm font-medium">Geliştirilmesi gereken kazanımlar</h3>
          {missing.length ? (
            <ul className="space-y-1 text-sm">
              {missing.map((row) => (
                <li key={`${row.subjectName}-${row.outcome}`}>
                  <span className="text-muted-foreground">{row.subjectName}:</span> {row.outcome}
                  {row.count > 1 ? ` (${row.count} soru)` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Cevap anahtarına kazanım girildiyse ve öğrencinin cevapları yüklendiyse eksik kazanımlar burada görünür.
            </p>
          )}
        </div>
        {latest ? (
          <>
            <OutcomeResultsTable rows={latest.outcomeResults ?? []} />
            <SubjectQuestionTables subjects={latest.subjects ?? []} questions={latest.questions} />
          </>
        ) : null}
        {exams.length > 1
          ? exams.slice(0, -1).map((exam) => (
              <div key={`${exam.examName}-${exam.date}`}>
                <h3 className="mb-2 text-sm font-medium">
                  {exam.examName} · {formatDate(exam.date)}
                </h3>
                <OutcomeResultsTable rows={exam.outcomeResults ?? []} />
              </div>
            ))
          : null}
      </CardContent>
    </Card>
  );
}

export function AnalysisView({
  data,
  moduleSlug,
  institutionId,
  canUpload = false,
  scoreTrack,
}: {
  data: Payload;
  moduleSlug: string;
  institutionId?: string | null;
  canUpload?: boolean;
  scoreTrack?: string | null;
}) {
  const lastExam = data.lastExam as
    | { name: string; date: string; examType: string; publisher: string }
    | null;
  const totals = data.lastTotals as {
    participants: number;
    averageScore: number | null;
    averageNet: number | null;
    totalCorrect: number;
    totalWrong: number;
    totalBlank: number;
    averageSourceNet: number | null;
  };
  const subjects = (data.subjectAverages ?? []) as Array<{
    code: string;
    name: string;
    avgNet: number | null;
    avgCorrect: number | null;
    avgWrong: number | null;
    avgBlank: number | null;
  }>;
  const classes = (data.classComparison ?? []) as Array<{
    grade: string;
    count: number;
    avgNet: number | null;
    avgScore: number | null;
  }>;
  const sections = (data.sectionComparison ?? []) as Array<{
    grade: string;
    section: string;
    count: number;
    avgNet: number | null;
  }>;
  const trend = (data.yearTrend ?? []) as Array<{
    examName: string;
    date: string;
    avgNet: number | null;
    avgScore: number | null;
  }>;
  const rankings = (data.rankings ?? []) as Array<{
    studentNo: string;
    name: string;
    grade: string;
    section: string;
    net: number;
    score: number | null;
    scoreSay: number | null;
    scoreEa: number | null;
    scoreSoz: number | null;
    schoolRank: number;
    rankSay: number;
    rankEa: number;
    rankSoz: number;
    correct: number;
    wrong: number;
    blank: number;
  }>;
  const improved = (data.mostImproved ?? []) as Array<{
    name: string;
    netDelta: number;
    previousNet: number;
    net: number;
  }>;
  const support = (data.needsSupport ?? []) as Array<{
    name: string;
    net: number;
    reason: string;
  }>;
  const vsPrevious = data.vsPrevious as
    | { previousName: string; netDelta: number | null; scoreDelta: number | null }
    | null;
  const buckets = (data.scoreBuckets ?? []) as Array<{ label: string; count: number }>;
  const changes = (data.changes ?? []) as Array<{
    name: string;
    studentNo: string;
    netDelta: number | null;
  }>;

  if (data.empty && moduleSlug !== "soru-analizi") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Henüz sonuç yok</CardTitle>
          <CardDescription>
            {Array.isArray(data.otherExamTypes) && data.otherExamTypes.length
              ? `${(data.otherExamTypes as string[]).join(", ")} sonuçları yüklü. Sınav türünü o türe çevirin; LGS, TYT ve AYT ayrı bakılır.`
              : "Bu okul ve filtreler için yüklenmiş bir süreç değerlendirme sonucu bulunamadı."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canUpload ? (
            <Link
              href="/yukle"
              className="inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Sonuç yükle
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sonuçları sistem yöneticisi yükler. Yükleme sonrası bu ekran dolacaktır.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (moduleSlug === "ogrenci-profili" && !data.studentProfile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Öğrenci seçin</CardTitle>
          <CardDescription>
            Bireysel profil için yukarıdaki öğrenci listesinden bir kişi seçin.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const moduleTitle =
    ANALYSIS_MODULES.find((m) => m.slug === moduleSlug)?.name ?? "Analiz";
  const showOverviewStats =
    moduleSlug !== "ogrenci-profili" &&
    moduleSlug !== "olcme-degerlendirme" &&
    moduleSlug !== "soru-analizi";

  if (moduleSlug === "olcme-degerlendirme" && data.evaluation) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">{moduleTitle}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-balance break-words">
            {lastExam ? lastExam.name : "Okul röntgeni"}
          </h1>
          {lastExam ? (
            <p className="text-muted-foreground mt-1">
              {formatDate(lastExam.date)} · {lastExam.examType} · {lastExam.publisher}
            </p>
          ) : null}
        </div>
        <SchoolEvaluationPanel data={data.evaluation as SchoolEvaluation} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{moduleTitle}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-balance break-words">
          {lastExam ? lastExam.name : "Okul analizi"}
        </h1>
        {lastExam ? (
          <p className="text-muted-foreground mt-1">
            {formatDate(lastExam.date)} · {lastExam.examType} · {lastExam.publisher}
          </p>
        ) : null}
      </div>

      {showOverviewStats ? (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Katılan öğrenci" value={formatNumber(totals.participants, 0)} />
        <Stat
          label="Ortalama puan"
          value={formatNumber(totals.averageScore)}
          hint={
            vsPrevious?.scoreDelta != null
              ? `Önceki süreç değerlendirmeye göre ${deltaLabel(vsPrevious.scoreDelta)}`
              : undefined
          }
        />
        <Stat
          label="Hesaplanan ortalama net"
          value={formatNumber(totals.averageNet)}
          hint={
            vsPrevious?.netDelta != null
              ? `${vsPrevious.previousName}: ${deltaLabel(vsPrevious.netDelta)}`
              : "Kaynak net ayrı tutulur"
          }
        />
      </div>
      ) : null}

      {moduleSlug === "soru-analizi" ? (
        <QuestionAnalysisPanel
          data={(data.questionAnalysis ?? null) as QuestionAnalysisPayload | null}
          scopeHint="Yalnızca bu okulun öğrencileri"
        />
      ) : null}

      {["okul-ozeti", "sinavlar-arasi-gelisim", "sinav-analizi"].includes(moduleSlug) ? (
        <Card>
          <CardHeader>
            <CardTitle>Eğitim yılı boyunca okul ortalaması</CardTitle>
            <CardDescription>
              {lastExam
                ? `Yalnızca ${lastExam.examType} süreç değerlendirmelerinin hesaplanan net ortalaması`
                : "Hesaplanan net ortalamasının süreç değerlendirmeler arasındaki seyri"}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="examName" hide={trend.length > 5} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="avgNet" name="Ort. net" stroke="var(--primary)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}

      {["okul-ozeti", "ders-analizi", "dybn-analizi", "sinav-analizi"].includes(moduleSlug) ? (
        <Card>
          <CardHeader>
            <CardTitle>Ders ortalamaları</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjects}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" interval={0} tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgNet" name="Ort. net" fill="var(--chart-1)" radius={4} />
                <Bar dataKey="avgCorrect" name="Ort. doğru" fill="var(--chart-2)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {["okul-ozeti", "sinif-karsilastirma"].includes(moduleSlug) ? (
          <Card>
            <CardHeader>
              <CardTitle>Sınıf karşılaştırması</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sınıf</TableHead>
                    <TableHead>Öğrenci</TableHead>
                    <TableHead>Ort. net</TableHead>
                    <TableHead>Ort. puan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((row) => (
                    <TableRow key={row.grade}>
                      <TableCell>{row.grade}</TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell>{formatNumber(row.avgNet)}</TableCell>
                      <TableCell>{formatNumber(row.avgScore)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
        {["okul-ozeti", "sube-karsilastirma"].includes(moduleSlug) ? (
          <Card>
            <CardHeader>
              <CardTitle>Şube karşılaştırması</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Şube</TableHead>
                    <TableHead>Öğrenci</TableHead>
                    <TableHead>Ort. net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sections.map((row) => (
                    <TableRow key={`${row.grade}-${row.section}`}>
                      <TableCell>
                        {row.grade}-{row.section}
                      </TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell>{formatNumber(row.avgNet)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {["okul-ozeti", "puan-dagilim"].includes(moduleSlug) ? (
        <Card>
          <CardHeader>
            <CardTitle>Puan dağılımı</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Öğrenci" fill="var(--chart-3)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {["okul-ozeti", "ogrenci-performans"].includes(moduleSlug) ? (
          <Card>
            <CardHeader>
              <CardTitle>En fazla gelişim gösterenler</CardTitle>
              <CardDescription>Önceki süreç değerlendirmeye göre hesaplanan net farkı</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {improved.length === 0 ? (
                <p className="text-sm text-muted-foreground">Karşılaştırılacak önceki sınav yok.</p>
              ) : (
                improved.map((row) => (
                  <div key={row.name} className="flex items-center justify-between gap-3 text-sm">
                    <span>{row.name}</span>
                    <Badge variant={row.netDelta >= 0 ? "default" : "destructive"}>
                      {deltaLabel(row.netDelta)}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}
        {["okul-ozeti", "ogrenci-performans"].includes(moduleSlug) ? (
          <Card>
            <CardHeader>
              <CardTitle>Desteğe ihtiyaç duyabilecek öğrenciler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {support.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bu ölçüte giren öğrenci yok.</p>
              ) : (
                support.map((row) => (
                  <div key={row.name} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span>{row.name}</span>
                      <span className="text-muted-foreground">{formatNumber(row.net)} net</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{row.reason}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {["okul-ozeti", "ogrenci-sonuclari", "basari-sirasi", "dybn-analizi"].includes(
        moduleSlug,
      ) ? (
        <SchoolRankingTable
          examType={lastExam?.examType}
          rankings={rankings}
          scoreTrack={scoreTrack}
        />
      ) : null}

      {moduleSlug === "ogrenci-performans" && changes.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Öğrenci performans değişimi</CardTitle>
            <CardDescription>İlk ve son süreç değerlendirme arasındaki net farkı</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead>Net farkı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changes.map((row) => (
                  <TableRow key={row.studentNo}>
                    <TableCell className="font-mono">{row.studentNo}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{deltaLabel(row.netDelta)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {moduleSlug === "okul-ozeti" ? (
        <Card>
          <CardHeader>
            <CardTitle>Analiz ekranları</CardTitle>
            <CardDescription>
              Soldaki menüden de aynı yerlere gidebilirsiniz. Gruplar nereye bakacağınızı gösterir.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {MODULE_GROUPS.map((group) => {
              const items = group.slugs
                .map((slug) =>
                  ((data.openModules as Array<{ slug: string; name: string }> | undefined) ?? []).find(
                    (mod) => mod.slug === slug && mod.slug !== "okul-ozeti",
                  ),
                )
                .filter((mod): mod is { slug: string; name: string } => Boolean(mod));
              if (!items.length) return null;
              return (
                <div key={group.id}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((mod) => (
                      <ButtonLink
                        key={mod.slug}
                        slug={mod.slug}
                        label={mod.name}
                        institutionId={institutionId}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {moduleSlug === "risk-analizi" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Risk Dağılımı</CardTitle>
              <CardDescription>Öğrencilerin risk seviyelerine göre dağılımı</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(data.riskDistribution as Array<{ level: string; count: number; color: string }> | undefined) ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Öğrenci Sayısı" radius={4}>
                    {((data.riskDistribution as Array<{ level: string; count: number; color: string }> | undefined) ?? []).map((entry, index) => (
                      <rect key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk Altındaki Öğrenciler</CardTitle>
              <CardDescription>Yüksek ve kritik risk seviyesindeki öğrenciler</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Ad</TableHead>
                    <TableHead>Şube</TableHead>
                    <TableHead>Risk Seviyesi</TableHead>
                    <TableHead>Risk Skoru</TableHead>
                    <TableHead>Trend</TableHead>
                    <TableHead>Son Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((data.riskProfiles as Array<{
                    studentNo: string;
                    name: string;
                    grade: string;
                    section: string;
                    riskLevel: string;
                    riskScore: number;
                    trend: string;
                    lastExamNet: number;
                  }> | undefined) ?? [])
                    .filter((r) => r.riskLevel === "high" || r.riskLevel === "critical")
                    .slice(0, 20)
                    .map((row) => (
                      <TableRow key={row.studentNo}>
                        <TableCell className="font-mono">{row.studentNo}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>
                          {row.grade}-{row.section}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.riskLevel === "critical"
                                ? "destructive"
                                : row.riskLevel === "high"
                                  ? "destructive"
                                  : "default"
                            }
                          >
                            {row.riskLevel === "critical"
                              ? "Kritik"
                              : row.riskLevel === "high"
                                ? "Yüksek"
                                : row.riskLevel === "medium"
                                  ? "Orta"
                                  : "Düşük"}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.riskScore}</TableCell>
                        <TableCell>
                          <Badge variant={row.trend === "declining" ? "destructive" : "default"}>
                            {row.trend === "declining"
                              ? "Düşüş"
                              : row.trend === "improving"
                                ? "İyileşme"
                                : "Stabil"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatNumber(row.lastExamNet)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      {moduleSlug === "gelisim-trendi" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Genel Gelişim Trendi</CardTitle>
              <CardDescription>Sınavlar arası ortalama net değişimi ve standart sapma</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={(data.trendAnalysis as Array<{
                  examName: string;
                  date: string;
                  avgNet: number | null;
                  medianNet: number | null;
                  stdDev: number | null;
                }> | undefined) ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="examName" hide={(data.trendAnalysis as unknown[])?.length > 5} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgNet" name="Ortalama" stroke="var(--primary)" strokeWidth={2} />
                  <Line type="monotone" dataKey="medianNet" name="Medyan" stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Öğrenci Performans Tahminleri</CardTitle>
              <CardDescription>Mevcut trende göre sonraki sınav tahminleri (ilk 20 öğrenci)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Ad</TableHead>
                    <TableHead>Mevcut Net</TableHead>
                    <TableHead>Tahmini Net</TableHead>
                    <TableHead>Güven Aralığı</TableHead>
                    <TableHead>Büyüme Hızı</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((data.studentProjections as Array<{
                    studentNo: string;
                    name: string;
                    currentNet: number;
                    projectedNet: number;
                    confidenceInterval: [number, number];
                    growthRate: number;
                  }> | undefined) ?? [])
                    .slice(0, 20)
                    .map((row) => (
                      <TableRow key={row.studentNo}>
                        <TableCell className="font-mono">{row.studentNo}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{formatNumber(row.currentNet)}</TableCell>
                        <TableCell>{formatNumber(row.projectedNet)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatNumber(row.confidenceInterval[0])} - {formatNumber(row.confidenceInterval[1])}
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.growthRate > 0 ? "default" : row.growthRate < 0 ? "destructive" : "secondary"}>
                            {deltaLabel(row.growthRate)} / sınav
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      {moduleSlug === "akran-karsilastirma" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Akran Grupları</CardTitle>
              <CardDescription>Sınıf ve şubelere göre performans grupları</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grup</TableHead>
                    <TableHead>Öğrenci Sayısı</TableHead>
                    <TableHead>Ort. Net</TableHead>
                    <TableHead>Performans Aralığı</TableHead>
                    <TableHead>En İyi Öğrenciler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((data.peerGroups as Array<{
                    groupId: string;
                    criteria: string;
                    studentCount: number;
                    avgNet: number;
                    performanceRange: [number, number];
                    topPerformers: string[];
                  }> | undefined) ?? []).map((row) => (
                    <TableRow key={row.groupId}>
                      <TableCell>{row.criteria}</TableCell>
                      <TableCell>{row.studentCount}</TableCell>
                      <TableCell>{formatNumber(row.avgNet)}</TableCell>
                      <TableCell className="text-xs">
                        {formatNumber(row.performanceRange[0])} - {formatNumber(row.performanceRange[1])}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.topPerformers.filter(Boolean).join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {data.peerComparison ? (
            <Card>
              <CardHeader>
                <CardTitle>Seçili Öğrenci Akran Karşılaştırması</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Stat
                    label="Öğrenci Net"
                    value={formatNumber((data.peerComparison as { studentNet: number }).studentNet)}
                  />
                  <Stat
                    label="Akran Ortalaması"
                    value={formatNumber((data.peerComparison as { peerAverage: number }).peerAverage)}
                  />
                  <Stat
                    label="Yüzdelik Dilim"
                    value={`${(data.peerComparison as { percentile: number }).percentile}%`}
                  />
                  <Stat
                    label="Sıralama"
                    value={`${(data.peerComparison as { ranking: number }).ranking} / ${(data.peerComparison as { totalStudents: number }).totalStudents}`}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      {moduleSlug === "sinif-detay-analizi" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Sınıf/Şube Performans Haritası</CardTitle>
              <CardDescription>Şubelerin performans karşılaştırması</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(data.heatMapData as Array<{
                  section: string;
                  avgNet: number;
                  studentCount: number;
                }> | undefined) ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="section" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avgNet" name="Ortalama Net" fill="var(--chart-1)" radius={4} />
                  <Bar dataKey="studentCount" name="Öğrenci Sayısı" fill="var(--chart-2)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Net Dağılım Analizi</CardTitle>
              <CardDescription>Öğrencilerin net aralıklarına göre dağılımı</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(data.distributionAnalysis as Array<{
                  label: string;
                  count: number;
                }> | undefined) ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Öğrenci Sayısı" fill="var(--chart-3)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      ) : null}

      {moduleSlug === "ogrenci-profili" && data.studentProfile ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Öğrenci Bilgileri</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Ad Soyad</p>
                  <p className="font-medium">{(data.studentProfile as { student: { name: string } }).student.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Öğrenci No</p>
                  <p className="font-mono font-medium">{(data.studentProfile as { student: { studentNo: string } }).student.studentNo}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sınıf/Şube</p>
                  <p className="font-medium">
                    {(data.studentProfile as { student: { grade: string; section: string } }).student.grade}-
                    {(data.studentProfile as { student: { grade: string; section: string } }).student.section}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Girilen Sınav Sayısı</p>
                  <p className="font-medium">{(data.studentProfile as { summary: { examsTaken: number } }).summary.examsTaken}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Ortalama Net"
              value={formatNumber((data.studentProfile as { summary: { avgNet: number } }).summary.avgNet)}
            />
            <Stat
              label="En İyi Net"
              value={formatNumber((data.studentProfile as { summary: { bestNet: number } }).summary.bestNet)}
            />
            <Stat
              label="Son Net"
              value={formatNumber((data.studentProfile as { summary: { latestNet: number } }).summary.latestNet)}
            />
            <Stat
              label="Toplam Gelişim"
              value={deltaLabel((data.studentProfile as { summary: { improvement: number } }).summary.improvement)}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sınav Geçmişi</CardTitle>
              <CardDescription>Tüm sınavlardaki performans detayları</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sınav</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Puan / SAY·EA·SÖZ</TableHead>
                    <TableHead>İlçe sırası</TableHead>
                    <TableHead>Okul sırası</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((data.studentProfile as { examHistory: Array<{
                    examName: string;
                    date: string;
                    net: number;
                    score: number | null;
                    scoreSay: number | null;
                    scoreEa: number | null;
                    scoreSoz: number | null;
                    schoolRank: number | null;
                    schoolCount: number | null;
                    cityRank: number | null;
                    cityCount: number | null;
                    districtRank: number | null;
                    districtCount: number | null;
                  }> }).examHistory ?? []).map((exam, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{exam.examName}</TableCell>
                      <TableCell>{formatDate(exam.date)}</TableCell>
                      <TableCell>{formatNumber(exam.net)}</TableCell>
                      <TableCell>
                        {exam.scoreSay != null || exam.scoreEa != null || exam.scoreSoz != null
                          ? `${formatNumber(exam.scoreSay)} / ${formatNumber(exam.scoreEa)} / ${formatNumber(exam.scoreSoz)}`
                          : formatNumber(exam.score)}
                      </TableCell>
                      <TableCell>
                        {exam.cityRank == null
                          ? "—"
                          : exam.cityCount
                            ? `${exam.cityRank} / ${exam.cityCount}`
                            : exam.cityRank}
                      </TableCell>
                      <TableCell>
                        {exam.districtRank == null
                          ? "—"
                          : exam.districtCount
                            ? `${exam.districtRank} / ${exam.districtCount}`
                            : exam.districtRank}
                      </TableCell>
                      <TableCell>
                        {exam.schoolRank == null
                          ? "—"
                          : exam.schoolCount
                            ? `${exam.schoolRank} / ${exam.schoolCount}`
                            : exam.schoolRank}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <StudentReportCard profile={data.studentProfile as StudentReportProfile} />
        </>
      ) : null}

      {moduleSlug === "mudahale-onerileri" ? (
        <Card>
          <CardHeader>
            <CardTitle>Müdahale Önerileri</CardTitle>
            <CardDescription>Veriye dayalı öğrenci destek planları</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {((data.recommendations as Array<{
              studentName: string;
              priority: string;
              recommendationType: string;
              title: string;
              description: string;
              specificActions: string[];
              expectedOutcome: string;
              timeframe: string;
            }> | undefined) ?? []).map((rec, idx) => (
              <div key={idx} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold">{rec.studentName}</h4>
                    <p className="text-sm text-muted-foreground">{rec.title}</p>
                  </div>
                  <Badge
                    variant={
                      rec.priority === "urgent"
                        ? "destructive"
                        : rec.priority === "high"
                          ? "destructive"
                          : "default"
                    }
                  >
                    {rec.priority === "urgent"
                      ? "Acil"
                      : rec.priority === "high"
                        ? "Yüksek"
                        : rec.priority === "medium"
                          ? "Orta"
                          : "Düşük"}
                  </Badge>
                </div>
                <p className="text-sm">{rec.description}</p>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Önerilen Aksiyonlar:</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {rec.specificActions.map((action, actionIdx) => (
                      <li key={actionIdx}>{action}</li>
                    ))}
                  </ul>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <div>
                    <span className="font-medium">Beklenen Sonuç:</span>{" "}
                    <span className="text-muted-foreground">{rec.expectedOutcome}</span>
                  </div>
                  <div>
                    <span className="font-medium">Zaman Çerçevesi:</span>{" "}
                    <span className="text-muted-foreground">{rec.timeframe}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ButtonLink({
  slug,
  label,
  institutionId,
}: {
  slug: string;
  label: string;
  institutionId?: string | null;
}) {
  if (slug === "okul-ozeti") return null;
  return (
    <Link
      href={panelPath(slug, institutionId)}
      className="rounded-full border px-3 py-1 text-sm hover:bg-muted"
    >
      {label}
    </Link>
  );
}
