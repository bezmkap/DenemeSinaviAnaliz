"use client";

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
import { formatNumber } from "@/lib/format";
import type { QuestionAnalysisPayload, QuestionAnalysisRow } from "@/lib/analiz/compute";

const DIFFICULTY_LABEL: Record<QuestionAnalysisRow["difficulty"], string> = {
  kolay: "Kolay",
  orta: "Orta",
  zor: "Zor",
  iptal: "İptal",
};

function optionSummary(row: QuestionAnalysisRow): string {
  const parts = (["A", "B", "C", "D", "E"] as const).map((mark) => `${mark} ${row.options[mark]}`);
  parts.push(`Boş ${row.options.blank}`);
  return parts.join(" · ");
}

export function QuestionAnalysisPanel({
  data,
  scopeHint,
}: {
  data: QuestionAnalysisPayload | null;
  scopeHint?: string;
}) {
  if (!data) return null;
  if (!data.hasAnswers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Soru analizi</CardTitle>
          <CardDescription>
            Soru bazında dağılım için öğrenci cevaplarının yüklü ve cevap anahtarının girilmiş olması gerekir.
            {scopeHint ? ` ${scopeHint}` : ""}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {data.sittingName ? `${data.sittingName} · ` : ""}
        {data.participantCount} öğrenci
        {scopeHint ? ` · ${scopeHint}` : ""}. Soru numaraları A grubuna göredir.
        {data.cancelledCount
          ? ` ${data.cancelledCount} soru iptal edildi; D/Y/B sütunları öğrencilerin gerçek işaretlerini gösterir.`
          : ""}
      </p>
      {data.subjects.map((subject) => (
        <Card key={subject.code}>
          <CardHeader>
            <CardTitle>{subject.name}</CardTitle>
            <CardDescription>Soru, B kitapçık no, kazanım, doğru sayısı ve doğru yüzdesi</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Soru</TableHead>
                  <TableHead>B no</TableHead>
                  <TableHead>Anahtar</TableHead>
                  <TableHead>Doğru sayısı</TableHead>
                  <TableHead>Y</TableHead>
                  <TableHead>B</TableHead>
                  <TableHead>Doğru %</TableHead>
                  <TableHead>Güçlük</TableHead>
                  <TableHead>Şık dağılımı</TableHead>
                  <TableHead>Kazanım</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subject.questions.map((row) => (
                  <TableRow
                    key={`${row.subjectCode}-${row.questionNo}`}
                    className={row.cancelled ? "bg-muted/40" : undefined}
                  >
                    <TableCell className="font-mono">{row.questionNo}</TableCell>
                    <TableCell className="font-mono">{row.bQuestionNo ?? "—"}</TableCell>
                    <TableCell className="font-mono">{row.correctAnswer || "—"}</TableCell>
                    <TableCell className="font-mono">{row.correct}</TableCell>
                    <TableCell className="font-mono">{row.wrong}</TableCell>
                    <TableCell className="font-mono">{row.blank}</TableCell>
                    <TableCell>{formatNumber(row.correctPct)}%</TableCell>
                    <TableCell>
                      <Badge variant={row.cancelled ? "secondary" : "outline"}>
                        {DIFFICULTY_LABEL[row.difficulty]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{optionSummary(row)}</TableCell>
                    <TableCell>{row.outcome || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
