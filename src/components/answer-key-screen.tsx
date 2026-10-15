"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SUBJECTS_BY_EXAM,
  type BookletLinkSet,
  type ExamSitting,
  type QuestionKeySet,
  type QuestionSpec,
} from "@/lib/domain";
import {
  applyBookletLinks,
  duplicateLinkIssues,
  emptyQuestionMap,
  identityQuestionMap,
  invertQuestionMap,
  normalizeQuestionNo,
  questionKeysFromAnswerKeys,
} from "@/lib/import/answers";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm";
const inputClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

export type AnswerKeySitting = ExamSitting & {
  booklets: string[];
  resultCount: number;
};

function cloneKeys(keys: QuestionKeySet): QuestionKeySet {
  return structuredClone(keys);
}

function cloneLinks(links: BookletLinkSet): BookletLinkSet {
  return structuredClone(links);
}

function keysForSitting(sitting: AnswerKeySitting): QuestionKeySet {
  return questionKeysFromAnswerKeys(
    sitting.examType,
    sitting.answerKeys,
    sitting.questionKeys,
    [...sitting.booklets, "A", "B"],
  );
}

function linksForSitting(sitting: AnswerKeySitting, keys: QuestionKeySet): BookletLinkSet {
  const base = "A";
  const others = [...new Set([...sitting.booklets, "B", ...Object.keys(sitting.bookletLinks ?? {})])]
    .filter((code) => code !== base)
    .sort();
  const out: BookletLinkSet = {};
  for (const booklet of others) {
    out[booklet] = {};
    for (const subject of SUBJECTS_BY_EXAM[sitting.examType]) {
      const prior = sitting.bookletLinks?.[booklet]?.[subject.code];
      const length = keys[base]?.[subject.code]?.length ?? subject.questionCount;
      out[booklet][subject.code] = Array.from({ length }, (_, index) => prior?.[index] ?? 0);
    }
  }
  return out;
}

export function AnswerKeyScreen({
  sittings,
  readOnly = false,
}: {
  sittings: AnswerKeySitting[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(sittings[0]?.id ?? "");
  const selected = sittings.find((row) => row.id === selectedId) ?? null;
  const [booklet, setBooklet] = useState(selected?.booklets[0] ?? "A");
  const [subjectCode, setSubjectCode] = useState(
    selected ? SUBJECTS_BY_EXAM[selected.examType][0]?.code ?? "turkce" : "turkce",
  );
  const [keys, setKeys] = useState<QuestionKeySet>(selected ? keysForSitting(selected) : {});
  const [links, setLinks] = useState<BookletLinkSet>(
    selected ? linksForSitting(selected, keysForSitting(selected)) : {},
  );
  const [pending, setPending] = useState(false);
  const [addedBooklets, setAddedBooklets] = useState<string[]>([]);

  const subjects = selected ? SUBJECTS_BY_EXAM[selected.examType] : SUBJECTS_BY_EXAM.LGS;
  const booklets = useMemo(() => {
    return [
      ...new Set([...(selected?.booklets ?? ["A", "B"]), "A", "B", ...addedBooklets, ...Object.keys(keys)]),
    ].sort();
  }, [selected, addedBooklets, keys]);
  const baseBooklet = "A";
  const otherBooklets = booklets.filter((code) => code !== baseBooklet);
  const derivedKeys = useMemo(
    () => (selected ? applyBookletLinks(selected.examType, keys, links, baseBooklet) : keys),
    [selected, keys, links, baseBooklet],
  );
  const questions: QuestionSpec[] = derivedKeys[booklet]?.[subjectCode] ?? [];
  const questionCount = subjects.find((row) => row.code === subjectCode)?.questionCount ?? questions.length;
  const pairIssues = otherBooklets.flatMap((code) =>
    duplicateLinkIssues(links[code]?.[subjectCode] ?? [], questionCount).map(
      (message) => `${code} kitapçığı: ${message}`,
    ),
  );

  function selectSitting(id: string) {
    const sitting = sittings.find((row) => row.id === id);
    setSelectedId(id);
    if (!sitting) return;
    const nextKeys = keysForSitting(sitting);
    setKeys(nextKeys);
    setLinks(linksForSitting(sitting, nextKeys));
    setAddedBooklets([]);
    setBooklet("A");
    setSubjectCode(SUBJECTS_BY_EXAM[sitting.examType][0]?.code ?? "turkce");
  }

  function patchQuestion(index: number, patch: Partial<QuestionSpec>) {
    setKeys((current) => {
      const next = cloneKeys(current);
      next[baseBooklet] = next[baseBooklet] ?? {};
      next[baseBooklet][subjectCode] = (next[baseBooklet][subjectCode] ?? []).map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      );
      return next;
    });
  }

  function patchLink(targetBooklet: string, index: number, value: string) {
    setLinks((current) => {
      const next = cloneLinks(current);
      next[targetBooklet] = next[targetBooklet] ?? {};
      const row = [...(next[targetBooklet][subjectCode] ?? emptyQuestionMap(questionCount))];
      row[index] = normalizeQuestionNo(value, questionCount);
      next[targetBooklet][subjectCode] = row;
      return next;
    });
  }

  function fillIdentity(targetBooklet: string) {
    setLinks((current) => {
      const next = cloneLinks(current);
      next[targetBooklet] = next[targetBooklet] ?? {};
      next[targetBooklet][subjectCode] = identityQuestionMap(questionCount);
      return next;
    });
  }

  function addBooklet() {
    if (!selected) return;
    const nextLetter = "ABCDEFGH".split("").find((code) => !booklets.includes(code));
    if (!nextLetter) return;
    setAddedBooklets((current) => [...current, nextLetter]);
    setKeys((current) =>
      questionKeysFromAnswerKeys(selected.examType, {}, current, [...booklets, nextLetter]),
    );
    setLinks((current) => {
      const next = cloneLinks(current);
      next[nextLetter] = {};
      for (const subject of SUBJECTS_BY_EXAM[selected.examType]) {
        next[nextLetter][subject.code] = emptyQuestionMap(subject.questionCount);
      }
      return next;
    });
    setBooklet("A");
  }

  async function save() {
    if (!selected) return;
    setPending(true);
    try {
      const response = await fetch("/api/cevap-anahtari", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sittingId: selected.id,
          questionKeys: applyBookletLinks(selected.examType, keys, links, baseBooklet),
          bookletLinks: links,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Anahtar kaydedilemedi.");
        return;
      }
      toast.success("Cevap anahtarı, kazanımlar, iptal edilen sorular ve kitapçık karşılıkları kaydedildi.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const inverted = booklet !== baseBooklet ? invertQuestionMap(links[booklet]?.[subjectCode] ?? []) : [];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cevap anahtarı</h1>
        <p className="mt-2 text-muted-foreground">
          {readOnly ? (
            "Şık, kazanım, iptal ve kitapçık karşılıklarını görebilirsiniz. Bu kayıtları yalnızca sistem yöneticisi değiştirir."
          ) : (
            <>
              Önce soldaki{" "}
              <Link href="/yukle" className="text-primary underline-offset-2 hover:underline">
                Sonuç yükle
              </Link>{" "}
              ile öğrenci cevaplarını kaydedin. Şık, kazanım, iptal ve A/B karşılıkları bu menüden girilir.
            </>
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Yüklenmiş sınavlar</CardTitle>
          <CardDescription>
            Sınav listesi yüklenen sonuçlardan gelir. Yeni sınav oluşturmak için önce Excel yükleyin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sittings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {readOnly
                ? "Kapsamınızda yüklenmiş sınav yok."
                : "Henüz yüklenmiş sınav yok. Cevap anahtarını doldurmak için önce öğrenci cevap dosyasını yükleyin."}
            </p>
          ) : (
            <select className={selectClass} value={selectedId} onChange={(event) => selectSitting(event.target.value)}>
              {sittings.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.examType} · {row.name} · {row.examDate} · {row.examCode} · {row.booklets.join("/")}
                </option>
              ))}
            </select>
          )}

          {selected ? (
            <>
              <div className="flex flex-wrap gap-2">
                {booklets.map((code) => (
                  <Button
                    key={code}
                    type="button"
                    size="sm"
                    variant={booklet === code ? "default" : "outline"}
                    onClick={() => setBooklet(code)}
                  >
                    {code} grubu
                    {code === baseBooklet ? " (ana)" : ""}
                  </Button>
                ))}
                {readOnly ? null : (
                  <Button type="button" size="sm" variant="outline" onClick={addBooklet}>
                    Grup ekle
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {subjects.map((subject) => (
                  <Button
                    key={subject.code}
                    type="button"
                    size="sm"
                    variant={subjectCode === subject.code ? "default" : "outline"}
                    onClick={() => setSubjectCode(subject.code)}
                  >
                    {subject.name}
                  </Button>
                ))}
              </div>
              {otherBooklets.length > 0 && booklet === baseBooklet && !readOnly ? (
                <div className="flex flex-wrap gap-2">
                  {otherBooklets.map((code) => (
                    <Button
                      key={code}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fillIdentity(code)}
                    >
                      {code} grubunu {baseBooklet} ile aynı sırada eşle
                    </Button>
                  ))}
                </div>
              ) : null}
              {booklet !== baseBooklet ? (
                <p className="text-sm text-muted-foreground">
                  {booklet} grubunun şık ve kazanımları, {baseBooklet} grubundaki karşılıklardan üretilir.
                  {readOnly
                    ? ` Karşılıklar ${baseBooklet} grubu tablosunda görünür.`
                    : ` Karşılıkları ${baseBooklet} grubu tablosundan girin.`}
                </p>
              ) : otherBooklets.length ? (
                <p className="text-sm text-muted-foreground">
                  {baseBooklet} grubunda 10. soru {otherBooklets.join("/")} grubunda başka numarada olabilir.
                  {readOnly
                    ? " Karşılık sütununda o grubun soru numarası görünür."
                    : " Karşılık sütununa o grubun soru numarasını yazın."}
                </p>
              ) : null}
              {pairIssues.length ? (
                <ul className="list-disc pl-5 text-sm text-destructive">
                  {pairIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Soru {booklet}</TableHead>
                    {booklet !== baseBooklet ? <TableHead className="w-24">{baseBooklet} karşılığı</TableHead> : null}
                    <TableHead className="w-28">Doğru şık</TableHead>
                    <TableHead className="w-24">İptal</TableHead>
                    <TableHead>Kazanım</TableHead>
                    {booklet === baseBooklet
                      ? otherBooklets.map((code) => (
                          <TableHead key={code} className="w-28">
                            {code} soru no
                          </TableHead>
                        ))
                      : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(booklet === baseBooklet
                    ? (keys[baseBooklet]?.[subjectCode] ?? [])
                    : questions
                  ).map((question, index) => (
                    <TableRow
                      key={`${booklet}-${subjectCode}-${index}`}
                      className={question.cancelled ? "bg-muted/40" : undefined}
                    >
                      <TableCell className="font-mono">{index + 1}</TableCell>
                      {booklet !== baseBooklet ? (
                        <TableCell className="font-mono">{inverted[index] || "—"}</TableCell>
                      ) : null}
                      <TableCell>
                        {booklet === baseBooklet && !readOnly ? (
                          <select
                            className={selectClass}
                            value={question.answer}
                            onChange={(event) => patchQuestion(index, { answer: event.target.value })}
                          >
                            <option value="">—</option>
                            {["A", "B", "C", "D", "E"].map((mark) => (
                              <option key={mark} value={mark}>
                                {mark}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-mono">{question.answer || "—"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {booklet === baseBooklet && !readOnly ? (
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={Boolean(question.cancelled)}
                              onChange={(event) =>
                                patchQuestion(index, { cancelled: event.target.checked })
                              }
                            />
                            İptal
                          </label>
                        ) : question.cancelled ? (
                          <span className="text-sm font-medium">İptal</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {booklet === baseBooklet && !readOnly ? (
                          <input
                            className={inputClass}
                            value={question.outcome}
                            onChange={(event) => patchQuestion(index, { outcome: event.target.value })}
                            placeholder="Örn. 8.1.2. Metindeki ana fikri belirler"
                          />
                        ) : (
                          <span>{question.outcome || "—"}</span>
                        )}
                      </TableCell>
                      {booklet === baseBooklet
                        ? otherBooklets.map((code) => (
                            <TableCell key={code}>
                              {readOnly ? (
                                <span className="font-mono">
                                  {links[code]?.[subjectCode]?.[index] || "—"}
                                </span>
                              ) : (
                                <input
                                  className={inputClass}
                                  inputMode="numeric"
                                  value={links[code]?.[subjectCode]?.[index] || ""}
                                  onChange={(event) => patchLink(code, index, event.target.value)}
                                  placeholder="—"
                                />
                              )}
                            </TableCell>
                          ))
                        : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {booklet === baseBooklet ? (
                <p className="text-sm text-muted-foreground">
                  İptal işaretlenen soru herkese doğru sayılır; net ve puan buna göre yeniden hesaplanır.
                </p>
              ) : null}
              {readOnly ? (
                <p className="text-sm text-muted-foreground">
                  Okul ve ilçe hesapları bu anahtarı görür; değiştiremez.
                </p>
              ) : (
                <Button type="button" onClick={save} disabled={pending}>
                  {pending ? "Kaydediliyor…" : "Anahtar, kazanım, iptal ve karşılıkları kaydet"}
                </Button>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
