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
import {
  trafficLabel,
  type ProvinceEvaluation,
  type RadiologyTraffic,
  type SchoolEvaluation,
} from "@/lib/analiz/evaluation";
import Link from "next/link";

function trafficClass(traffic: RadiologyTraffic) {
  if (traffic === "guclu") return "bg-emerald-600 text-white";
  if (traffic === "izle") return "bg-amber-500 text-white";
  return "bg-red-600 text-white";
}

function DimensionGrid({ evaluation }: { evaluation: SchoolEvaluation | ProvinceEvaluation }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {evaluation.dimensions.map((dim) => (
        <Card key={dim.key}>
          <CardHeader>
            <CardDescription>{dim.label}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatNumber(dim.score, 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, Math.max(0, dim.score))}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{dim.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SchoolEvaluationPanel({ data }: { data: SchoolEvaluation }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Ölçme & değerlendirme</p>
          <h2 className="text-xl font-semibold">Okul röntgeni</h2>
          <p className="text-sm text-muted-foreground mt-1">
            YKS analizindeki çok boyutlu çerçeve: başarı, ilerleme, eşitlik ve ders dengesi.
          </p>
        </div>
        <Badge className={trafficClass(data.traffic)}>
          {trafficLabel(data.traffic)} · {formatNumber(data.compositeScore, 0)}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>İl ort. net</CardDescription>
            <CardTitle>{formatNumber(data.provinceAvgNet)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>İl ile fark</CardDescription>
            <CardTitle>{data.vsProvince == null ? "—" : formatNumber(data.vsProvince)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Önceki sınava fark</CardDescription>
            <CardTitle>{data.vsPrevious == null ? "—" : formatNumber(data.vsPrevious)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>İl içi sıra</CardDescription>
            <CardTitle>
              {data.peerRank && data.peerCount ? `${data.peerRank} / ${data.peerCount}` : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <DimensionGrid evaluation={data} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Güçlü dersler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.strongSubjects.map((row) => (
              <div key={row.code} className="flex justify-between">
                <span>{row.name}</span>
                <span>{formatNumber(row.avgNet)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Geliştirilecek dersler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.weakSubjects.map((row) => (
              <div key={row.code} className="flex justify-between">
                <span>{row.name}</span>
                <span>{formatNumber(row.avgNet)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Müdahale önerileri</CardTitle>
          <CardDescription>Veriye dayalı öncelikler; YKS röntgenindeki müdahale mantığı.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.interventions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu sınavda acil müdahale bandı yok.</p>
          ) : (
            data.interventions.map((row) => (
              <div key={row.title} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{row.title}</p>
                  <Badge variant={row.priority === "yuksek" ? "destructive" : "secondary"}>
                    {row.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{row.detail}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ProvinceEvaluationPanel({
  data,
  canOpenSchools,
  viewerInstitutionId,
}: {
  data: ProvinceEvaluation;
  canOpenSchools: boolean;
  viewerInstitutionId?: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Ölçme & değerlendirme</p>
          <h2 className="text-xl font-semibold">İl röntgeni</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Okullar başarı / izle / müdahale bandına ayrılır. Ders ve eşitlik birlikte okunur.
          </p>
        </div>
        <Badge className={trafficClass(data.traffic)}>
          {trafficLabel(data.traffic)} · {formatNumber(data.compositeScore, 0)}
        </Badge>
      </div>

      <DimensionGrid evaluation={data} />

      <div className="grid gap-6 lg:grid-cols-3">
        <FlagTable title="Başarılı okullar" rows={data.successSchools} canOpenSchools={canOpenSchools} viewerInstitutionId={viewerInstitutionId} />
        <FlagTable title="İzleme bandı" rows={data.watchSchools} canOpenSchools={canOpenSchools} viewerInstitutionId={viewerInstitutionId} />
        <FlagTable title="Müdahale bandı" rows={data.urgentSchools} canOpenSchools={canOpenSchools} viewerInstitutionId={viewerInstitutionId} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Güçlü dersler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.strongSubjects.map((row) => (
              <div key={row.code} className="flex justify-between">
                <span>{row.name}</span>
                <span>{formatNumber(row.avgNet)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Geliştirilecek dersler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.weakSubjects.map((row) => (
              <div key={row.code} className="flex justify-between">
                <span>{row.name}</span>
                <span>{formatNumber(row.avgNet)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>İl müdahale önerileri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.interventions.length === 0 ? (
            <p className="text-sm text-muted-foreground">İl genelinde acil müdahale bandı yok.</p>
          ) : (
            data.interventions.map((row) => (
              <div key={row.title} className="rounded-lg border p-3">
                <p className="font-medium">{row.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{row.detail}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FlagTable({
  title,
  rows,
  canOpenSchools,
  viewerInstitutionId,
}: {
  title: string;
  rows: ProvinceEvaluation["successSchools"];
  canOpenSchools: boolean;
  viewerInstitutionId?: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Kayıt yok.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Okul</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const own = row.id === viewerInstitutionId;
                const label = own ? `${row.name} (okulunuz)` : row.name;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      {canOpenSchools || own ? (
                        <Link className="text-primary hover:underline" href={`/panel?kurum=${row.id}`}>
                          {label}
                        </Link>
                      ) : (
                        label
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(row.avgNet)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
