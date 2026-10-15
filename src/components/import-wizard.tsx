"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { preferredAcademicYear, type AcademicYear, type ExamSitting, type ExamType, EXAM_AREA_LABELS, type ExamArea } from "@/lib/domain";
import type { ColumnMapping, MappedSubject } from "@/lib/import/importers";
import { formatDate, formatNumber } from "@/lib/format";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

type PreviewResponse = {
  previewId: string;
  examType: ExamType;
  mapping: ColumnMapping;
  mappingIssues: Array<{ level: string; message: string }>;
  rows: Array<{
    excelRow: number;
    studentNo: string;
    fullName: string;
    institutionCode: string;
    grade: string;
    section: string;
    booklet?: string;
    examArea?: ExamArea | null;
    calculatedNet: number;
    sourceNet: number | null;
    netMismatch: boolean;
    errors: string[];
  }>;
  validCount: number;
  errorCount: number;
  mismatchCount: number;
  formulaLabel: string;
  error?: string;
};

export function ImportWizard({
  years,
  tytSittings = [],
}: {
  years: AcademicYear[];
  tytSittings?: ExamSitting[];
}) {
  const router = useRouter();
  const allowedExamTypes: ExamType[] = ["LGS", "TYT", "AYT"];
  const [file, setFile] = useState<File | null>(null);
  const [examType, setExamType] = useState<ExamType>(allowedExamTypes[0] ?? "LGS");
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [academicYearId, setAcademicYearId] = useState(preferredAcademicYear(years)?.id ?? "");
  const [publisher, setPublisher] = useState("");
  const [examCode, setExamCode] = useState("");
  const [tytSittingId, setTytSittingId] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const yearTytSittings = useMemo(
    () =>
      tytSittings
        .filter((sitting) => sitting.academicYearId === academicYearId)
        .sort(
          (a, b) =>
            b.examDate.localeCompare(a.examDate) || a.name.localeCompare(b.name, "tr"),
        ),
    [tytSittings, academicYearId],
  );
  const resolvedTytSittingId = useMemo(() => {
    if (yearTytSittings.some((sitting) => sitting.id === tytSittingId)) return tytSittingId;
    return (
      yearTytSittings.find((sitting) => !examDate || sitting.examDate <= examDate)?.id ??
      yearTytSittings[0]?.id ??
      ""
    );
  }, [yearTytSittings, tytSittingId, examDate]);

  const subjectChoices = useMemo(() => {
    if (examType === "LGS") {
      return [
        ["turkce", "Türkçe"],
        ["inkilap", "T.C. İnkılap Tarihi ve Atatürkçülük"],
        ["din", "Din Kültürü ve Ahlak Bilgisi"],
        ["ingilizce", "İngilizce"],
        ["matematik", "Matematik"],
        ["fen", "Fen Bilimleri"],
      ] as const;
    }
    if (examType === "TYT") {
      return [
        ["turkce", "Türkçe"],
        ["sosyal", "Sosyal Bilimler"],
        ["matematik", "Temel Matematik"],
        ["fen", "Fen Bilimleri"],
      ] as const;
    }
    return [
      ["turkdili", "Türk Dili ve Edebiyatı"],
      ["tarih1", "Tarih-1"],
      ["cografya1", "Coğrafya-1"],
      ["tarih2", "Tarih-2"],
      ["cografya2", "Coğrafya-2"],
      ["felsefe", "Felsefe Grubu"],
      ["din", "Din Kültürü ve Ahlak Bilgisi"],
      ["matematik", "Matematik"],
      ["fizik", "Fizik"],
      ["kimya", "Kimya"],
      ["biyoloji", "Biyoloji"],
    ] as const;
  }, [examType]);

  async function runPreview() {
    if (!file) {
      toast.error("Dosya seçin.");
      return;
    }
    setPending(true);
    setResult(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("examType", examType);
      const response = await fetch("/api/import/preview", { method: "POST", body: form });
      const data = (await response.json()) as PreviewResponse;
      if (!response.ok) {
        toast.error(data.error ?? "Önizleme alınamadı.");
        return;
      }
      setPreview(data);
      setMapping(data.mapping);
    } finally {
      setPending(false);
    }
  }

  function updateSubject(index: number, patch: Partial<MappedSubject>) {
    if (!mapping) return;
    const subjects = mapping.subjects.map((subject, i) =>
      i === index ? { ...subject, ...patch } : subject,
    );
    setMapping({ ...mapping, subjects });
  }

  async function commit() {
    if (!preview || !mapping) return;
    if (!examName || !examDate || !academicYearId || !publisher || !examCode) {
      toast.error("Sınav adı, tarihi, akademik yıl, yayınevi ve sınav kodu zorunludur.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewId: preview.previewId,
          mapping,
          examName,
          examDate,
          academicYearId,
          publisher,
          examCode,
          tytSittingId: examType === "AYT" ? resolvedTytSittingId || null : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "DUPLICATE_UPLOAD") {
          const fileName = data.details?.fileName as string | undefined;
          toast.error(
            fileName
              ? `${fileName} daha önce yüklenmiş. Yüklemeler sayfasından geri alın, sonra yeniden deneyin.`
              : data.error,
          );
          setResult("Bu dosya sistemde kayıtlı. Üst menüden Yüklemeler’e girip geri alabilirsiniz.");
          return;
        }
        toast.error(data.error ?? "Kayıt başarısız.");
        return;
      }
      if (!data.imported) {
        setResult(
          "Hiç kayıt aktarılmadı. Excel’deki kurum kodları kayıtlı okulların kodlarıyla aynı olmalı.",
        );
        toast.error("Kurum kodu kayıtlı bir okulla eşleşmedi; kayıt aktarılmadı.");
        return;
      }
      setResult(`${data.imported} kayıt aktarıldı. Hatalı satır: ${data.errorCount}.`);
      toast.success("Yükleme kaydedildi. Şimdi cevap anahtarı ve A/B karşılıklarını girin.");
      router.push("/cevap-anahtari");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <p className="text-sm text-muted-foreground">İşlemler / Sonuç yükle</p>
        <h1 className="text-2xl font-semibold tracking-tight">Süreç değerlendirme sonucu yükle</h1>
        <p className="mt-1 text-muted-foreground">
          Excel’i sürükleyin, sınav bilgilerini doldurun, önizleyin ve kaydedin. Cevap anahtarı
          sonraki adımdadır.
        </p>
        <ol className="mt-3 flex flex-wrap gap-2 text-xs">
          <li className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">1. Dosya</li>
          <li className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">2. Eşleştirme</li>
          <li className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">3. Kayıt</li>
        </ol>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dosya ve sınav bilgileri</CardTitle>
          <CardDescription>
            Sınav türünü dosyayla aynı seçin. Satırdaki okul kodu kayıtlı okulla eşleşmelidir.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Excel dosyası</Label>
            <label
              className={`relative flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition ${
                file
                  ? "border-primary bg-primary/5"
                  : "border-input bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
              }`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const next = event.dataTransfer.files?.[0] ?? null;
                if (!next) return;
                setFile(next);
                const name = next.name.toLocaleLowerCase("tr-TR");
                if (name.includes("ayt") && allowedExamTypes.includes("AYT")) setExamType("AYT");
                else if (name.includes("tyt") && allowedExamTypes.includes("TYT")) setExamType("TYT");
                else if (name.includes("lgs") && allowedExamTypes.includes("LGS")) setExamType("LGS");
              }}
            >
              <input
                type="file"
                accept=".xlsx,.xls"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(e) => {
                  const next = e.target.files?.[0] ?? null;
                  setFile(next);
                  const name = next?.name.toLocaleLowerCase("tr-TR") ?? "";
                  if (name.includes("ayt") && allowedExamTypes.includes("AYT")) setExamType("AYT");
                  else if (name.includes("tyt") && allowedExamTypes.includes("TYT")) setExamType("TYT");
                  else if (name.includes("lgs") && allowedExamTypes.includes("LGS")) setExamType("LGS");
                }}
              />
              {file ? (
                <>
                  <FileSpreadsheet className="mb-2 size-8 text-primary" />
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">Değiştirmek için tıklayın veya yeni dosya bırakın</p>
                </>
              ) : (
                <>
                  <Upload className="mb-2 size-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Excel dosyasını sürükleyin veya seçin</p>
                  <p className="text-xs text-muted-foreground">.xlsx veya .xls</p>
                </>
              )}
            </label>
          </div>
          <div className="space-y-1">
            <Label>Sınav türü</Label>
            <select
              className={selectClass}
              value={examType}
              onChange={(e) => setExamType(e.target.value as ExamType)}
            >
              {allowedExamTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {examType === "AYT" ? (
              <p className="text-xs text-muted-foreground">
                AYT tek başına yapılmaz. Sayısal, eşit ağırlık ve sözel puanlar aşağıda seçeceğiniz
                TYT netleriyle hesaplanır. TYT’si olmayan öğrencide netler kaydedilir, puan boş kalır.
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label>Sınav adı</Label>
            <Input value={examName} onChange={(e) => setExamName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Sınav tarihi</Label>
            <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Akademik yıl</Label>
            <select
              className={selectClass}
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
            >
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label}
                </option>
              ))}
            </select>
            <Link href="/yonetim/akademik-yillar" className="text-xs text-primary hover:underline">
              Yıl ekle veya değiştir
            </Link>
          </div>
          {examType === "AYT" ? (
            <div className="space-y-1">
              <Label>Puan için TYT sınavı</Label>
              <select
                className={selectClass}
                value={resolvedTytSittingId}
                onChange={(e) => setTytSittingId(e.target.value)}
              >
                {yearTytSittings.length ? null : <option value="">Kayıtlı TYT yok</option>}
                {yearTytSittings.map((sitting) => (
                  <option key={sitting.id} value={sitting.id}>
                    {sitting.name} · {formatDate(sitting.examDate)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {yearTytSittings.length
                  ? "SAY / EA / SÖZ puanları bu TYT netleriyle hesaplanır."
                  : "Bu akademik yılda TYT yok. AYT netleri kaydedilir, puanlar TYT yüklenince dolar."}
              </p>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label>Yayınevi</Label>
            <Input value={publisher} onChange={(e) => setPublisher(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Sınav kodu</Label>
            <Input
              value={examCode}
              onChange={(e) => setExamCode(e.target.value)}
              placeholder="Örn. MDS-LGS-2026-04"
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button type="button" onClick={runPreview} disabled={pending}>
              {pending ? "Okunuyor…" : "Dosyayı oku ve eşleştir"}
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              render={<a href="/api/ornek-dosya?tur=LGS" />}
              onClick={() => allowedExamTypes.includes("LGS") && setExamType("LGS")}
            >
              Örnek LGS cevap (anonim)
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              render={<a href="/api/ornek-dosya?tur=TYT" />}
              onClick={() => allowedExamTypes.includes("TYT") && setExamType("TYT")}
            >
              Örnek TYT cevap (anonim)
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              render={<a href="/api/ornek-dosya?tur=AYT" />}
              onClick={() => allowedExamTypes.includes("AYT") && setExamType("AYT")}
            >
              Örnek AYT cevap (anonim)
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && mapping ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>2. Sütun eşleştirme</CardTitle>
              <CardDescription>
                {mapping.format === "answers"
                  ? "Ders sütunları cevap dizisi olarak okundu. Sosyal sütunu LGS’de İnkılap Tarihi kabul edilir."
                  : "Belirsiz veya yinelenen D/Y/B/N sütunlarını kaydetmeden önce düzeltin."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {preview.mappingIssues.map((issue) => (
                <Alert key={issue.message} variant={issue.level === "error" ? "destructive" : "default"}>
                  <AlertDescription>{issue.message}</AlertDescription>
                </Alert>
              ))}
              <p className="text-sm text-muted-foreground">
                {mapping.format === "answers"
                  ? "Her harf bir sorudur; boşluk boş bırakılan sorudur. Net, doğru − yanlış / 3 (LGS) veya / 4 (TYT-AYT) ile hesaplanır."
                  : `Net kuralı: ${preview.formulaLabel}. Kaynak _N değeri nihai net olarak kullanılmaz.`}
              </p>
              {mapping.subjects.map((subject, index) => (
                <div
                  key={`${subject.prefix}-${index}`}
                  className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto] items-end"
                >
                  <div>
                    <p className="text-xs text-muted-foreground">Kaynak başlıklar</p>
                    <p className="text-sm">{subject.sourceHeaders.join(", ")}</p>
                    {subject.suggestion ? <Badge className="mt-1">{subject.suggestion}</Badge> : null}
                  </div>
                  <div className="space-y-1">
                    <Label>Ders</Label>
                    <select
                      className={selectClass}
                      value={subject.subjectCode}
                      onChange={(e) =>
                        updateSubject(index, {
                          subjectCode: e.target.value,
                          label:
                            subjectChoices.find((c) => c[0] === e.target.value)?.[1] ??
                            e.target.value,
                        })
                      }
                    >
                      {subjectChoices.map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm pb-1">
                    <input
                      type="checkbox"
                      checked={subject.confirmed}
                      onChange={(e) =>
                        updateSubject(index, {
                          confirmed: e.target.checked,
                          needsConfirmation: !e.target.checked,
                        })
                      }
                    />
                    Onayla
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>

          {mapping.format === "answers" ? (
            <Card>
              <CardHeader>
                <CardTitle>3. Sonraki adım</CardTitle>
                <CardDescription>
                  Kayıttan sonra Cevap anahtarı sayfasında doğru şık, kazanım ve A/B soru
                  karşılıkları girilir. Dosyada CevapAnahtari sayfası varsa şıklar otomatik alınır.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{mapping.format === "answers" ? "4. Veri önizlemesi" : "3. Veri önizlemesi"}</CardTitle>
              <CardDescription>
                Geçerli {preview.validCount} · hatalı {preview.errorCount} · net uyuşmazlığı{" "}
                {preview.mismatchCount}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Satır</TableHead>
                    <TableHead>No</TableHead>
                    <TableHead>Ad</TableHead>
                    <TableHead>Kurum</TableHead>
                    {mapping.format === "answers" ? <TableHead>Kitapçık</TableHead> : null}
                    {examType === "AYT" ? <TableHead>Alan</TableHead> : null}
                    <TableHead>Kaynak net</TableHead>
                    <TableHead>Hesaplanan net</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.slice(0, 25).map((row) => (
                    <TableRow key={row.excelRow}>
                      <TableCell>{row.excelRow}</TableCell>
                      <TableCell className="font-mono">{row.studentNo}</TableCell>
                      <TableCell>{row.fullName}</TableCell>
                      <TableCell className="font-mono">{row.institutionCode}</TableCell>
                      {mapping.format === "answers" ? (
                        <TableCell>{row.booklet ?? "A"}</TableCell>
                      ) : null}
                      {examType === "AYT" ? (
                        <TableCell>{row.examArea ? EXAM_AREA_LABELS[row.examArea] : "-"}</TableCell>
                      ) : null}
                      <TableCell>{formatNumber(row.sourceNet)}</TableCell>
                      <TableCell>{formatNumber(row.calculatedNet)}</TableCell>
                      <TableCell>
                        {row.errors.length ? (
                          <span className="text-destructive text-xs">{row.errors.join(" ")}</span>
                        ) : row.netMismatch ? (
                          <span className="text-amber-700 text-xs">Net uyuşmazlığı</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Hazır</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4">
                <Button type="button" onClick={commit} disabled={pending}>
                  {pending ? "Kaydediliyor…" : "Onayla ve kaydet"}
                </Button>
              </div>
              {result ? <p className="mt-3 text-sm">{result}</p> : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
