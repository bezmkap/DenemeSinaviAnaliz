"use client";

import Link from "next/link";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatNumber, deltaLabel } from "@/lib/format";
import { IL_ANALYSIS_MODULES, formatInstitutionTypes, type Role } from "@/lib/domain";
import type { NetworkAnalysisPayload } from "@/lib/analiz/network";
import { ProvinceEvaluationPanel } from "@/components/evaluation-panels";
import { QuestionAnalysisPanel } from "@/components/question-analysis-panel";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function SchoolName({
  id,
  name,
  href,
  viewerInstitutionId,
  canOpenSchools,
  ownHint,
}: {
  id: string;
  name: string;
  href: string;
  viewerInstitutionId?: string | null;
  canOpenSchools: boolean;
  ownHint?: boolean;
}) {
  const isOwn = viewerInstitutionId === id;
  const label = ownHint && isOwn ? `${name} (okulunuz)` : name;
  if (canOpenSchools || isOwn) {
    return (
      <Link className="text-primary hover:underline" href={href}>
        {label}
      </Link>
    );
  }
  return <span>{label}</span>;
}

export function NetworkAnalysisView({
  data,
  moduleSlug = "genel",
  viewerRole = "system_admin",
  viewerInstitutionId = null,
}: {
  data: NetworkAnalysisPayload;
  moduleSlug?: string;
  viewerRole?: Role;
  viewerInstitutionId?: string | null;
}) {
  const isAdmin = viewerRole === "system_admin";
  const canOpenSchools = viewerRole === "system_admin" || viewerRole === "district_admin";
  if (data.empty && moduleSlug !== "soru") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Henüz sonuç yok</CardTitle>
          <CardDescription>
            Seçilen filtrelere uyan yüklenmiş süreç değerlendirme sonucu bulunamadı.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <Link href="/yukle" className="text-sm font-medium text-primary hover:underline">
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

  const totals = data.lastTotals;
  const subjects = data.subjects ?? [];
  const sections = data.sections ?? [];
  const classes = data.classes ?? [];
  const moduleTitle =
    IL_ANALYSIS_MODULES.find((row) => row.slug === moduleSlug)?.name ?? "İl analizi";
  const show = (...slugs: string[]) => slugs.includes(moduleSlug);
  const provinceAvg = totals.averageNet;
  const vsScopeLabel =
    viewerRole === "district_admin" || data.scope === "district-schools"
      ? "İlçe ile fark"
      : "İl ile fark";
  const scopeNoun = viewerRole === "district_admin" ? "ilçe" : "il";
  const questionScopeHint =
    viewerRole === "district_admin" || data.scope === "district-schools"
      ? "Yalnızca bu ilçedeki okullar"
      : "Seçili il / ilçe kapsamındaki okullar";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "Sistem yöneticisi" : viewerRole === "district_admin" ? "İlçe görünümü" : "İl görünümü"} · {moduleTitle}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-balance break-words">
          {data.examType ? `${data.examType} ${scopeNoun} analizi` : `${scopeNoun === "ilçe" ? "İlçe" : "İl"} analizi`}
        </h1>
        <p className="text-muted-foreground mt-1">
          {IL_ANALYSIS_MODULES.find((row) => row.slug === moduleSlug)?.description ??
            (isAdmin
              ? "İlin akademik durumu. Bir okula girmek için ada tıklayın."
              : "İlin genel akademik görünümü. Yalnızca kendi okulunuzun paneline geçebilirsiniz.")}
        </p>
      </div>

      {show("olcme-degerlendirme") && data.evaluation ? (
        <ProvinceEvaluationPanel
          data={data.evaluation}
          canOpenSchools={canOpenSchools}
          viewerInstitutionId={viewerInstitutionId}
        />
      ) : null}

      {show("soru") ? (
        <QuestionAnalysisPanel data={data.questionAnalysis} scopeHint={questionScopeHint} />
      ) : null}

      {show("genel") ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <Stat label="Okul" value={formatNumber(totals.schoolCount, 0)} />
        <Stat label="İl" value={formatNumber(totals.cityCount, 0)} />
        <Stat label="İlçe" value={formatNumber(totals.districtCount, 0)} />
        <Stat label="Öğrenci" value={formatNumber(totals.participants, 0)} />
        <Stat label="Ort. net" value={formatNumber(totals.averageNet)} />
        <Stat label="Ort. doğru" value={formatNumber(totals.averageCorrect ?? null)} />
        <Stat label="Ort. yanlış" value={formatNumber(totals.averageWrong ?? null)} />
        <Stat label="Ort. boş" value={formatNumber(totals.averageBlank ?? null)} />
      </div>
      ) : null}

      {show("genel") ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Sınavlar arası il ortalaması</CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.yearTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="examName" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgNet" name="Ort. net" stroke="var(--primary)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Öne çıkan okullar</CardTitle>
              <CardDescription>Ortalama nete göre ilk ve son dilim.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sıra</TableHead>
                    <TableHead>Okul</TableHead>
                    <TableHead className="text-right">Ort. net</TableHead>
                    <TableHead className="text-right">{vsScopeLabel}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data.schools.slice(0, 5), ...data.schools.slice(-3).filter((row) => data.schools.length > 5)].map(
                    (school, index) => {
                      const rank = data.schools.findIndex((row) => row.id === school.id) + 1;
                      const vs =
                        school.avgNet != null && provinceAvg != null
                          ? Math.round((school.avgNet - provinceAvg) * 100) / 100
                          : null;
                      return (
                        <TableRow key={`${school.id}-${index}`}>
                          <TableCell>{rank}</TableCell>
                          <TableCell>
                            <SchoolName
                              id={school.id}
                              name={school.name}
                              href={`/panel?kurum=${school.id}`}
                              viewerInstitutionId={viewerInstitutionId}
                              canOpenSchools={canOpenSchools}
                              ownHint
                            />
                          </TableCell>
                          <TableCell className="text-right">{formatNumber(school.avgNet)}</TableCell>
                          <TableCell className="text-right">{vs == null ? "—" : formatNumber(vs)}</TableCell>
                        </TableRow>
                      );
                    },
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      {show("ders") ? (
      <Card>
        <CardHeader>
          <CardTitle>Ders analizi</CardTitle>
          <CardDescription>
            İl genelinde ders netleri ve D / Y / B ortalaması. En güçlü ve en zayıf okul ders bazında
            görünür.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subjects}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="avgNet" name="Ort. net" fill="var(--primary)" radius={4} />
              <Bar dataKey="avgCorrect" name="Ort. doğru" fill="var(--chart-2)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ders</TableHead>
                <TableHead className="text-right">Ort. net</TableHead>
                <TableHead className="text-right">D / Y / B</TableHead>
                <TableHead className="text-right">Öğrenci</TableHead>
                <TableHead className="text-right">Okul</TableHead>
                <TableHead>En güçlü okul</TableHead>
                <TableHead>En zayıf okul</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((subject) => (
                <TableRow key={subject.code}>
                  <TableCell>{subject.name}</TableCell>
                  <TableCell className="text-right">{formatNumber(subject.avgNet)}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(subject.avgCorrect)} / {formatNumber(subject.avgWrong)} /{" "}
                    {formatNumber(subject.avgBlank)}
                  </TableCell>
                  <TableCell className="text-right">{subject.participants}</TableCell>
                  <TableCell className="text-right">{subject.schoolCount}</TableCell>
                  <TableCell>
                    {subject.strongestSchool ? (
                      <>
                        <SchoolName
                          id={subject.strongestSchool.id}
                          name={subject.strongestSchool.name}
                          href={`/panel/ders-analizi?kurum=${subject.strongestSchool.id}`}
                          viewerInstitutionId={viewerInstitutionId}
                          canOpenSchools={canOpenSchools}
                        />
                        <span className="block text-xs text-muted-foreground">
                          {formatNumber(subject.strongestSchool.avgNet)} net
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {subject.weakestSchool ? (
                      <>
                        <SchoolName
                          id={subject.weakestSchool.id}
                          name={subject.weakestSchool.name}
                          href={`/panel/ders-analizi?kurum=${subject.weakestSchool.id}`}
                          viewerInstitutionId={viewerInstitutionId}
                          canOpenSchools={canOpenSchools}
                        />
                        <span className="block text-xs text-muted-foreground">
                          {formatNumber(subject.weakestSchool.avgNet)} net
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      ) : null}

      {show("okul") ? (
      <Card>
        <CardHeader>
          <CardTitle>Kurum analizi</CardTitle>
          <CardDescription>
            {canOpenSchools
              ? data.examType
                ? `${data.examType} ortalama netine göre sıralama. Okulun ayrıntısına gitmek için ada tıklayın.`
                : "Okullar ortalama nete göre sıralanır. Okulun ayrıntısına gitmek için ada tıklayın."
              : "Okullar ortalama nete göre sıralanır. Yalnızca kendi okulunuzun ayrıntılı analizine girebilirsiniz."}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.schools.slice(0, 12)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={70} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="avgNet" name="Ort. net" fill="var(--primary)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sıra</TableHead>
                <TableHead>Okul</TableHead>
                <TableHead>İl / ilçe</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Sınav</TableHead>
                <TableHead className="text-right">Öğrenci</TableHead>
                <TableHead className="text-right">Ort. net</TableHead>
                <TableHead className="text-right">Ort. puan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.schools.map((school, index) => (
                <TableRow key={school.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <SchoolName
                      id={school.id}
                      name={school.name}
                      href={`/panel/okul-ozeti?kurum=${school.id}`}
                      viewerInstitutionId={viewerInstitutionId}
                      canOpenSchools={canOpenSchools}
                      ownHint
                    />
                    <span className="block text-xs text-muted-foreground font-mono">{school.code}</span>
                  </TableCell>
                  <TableCell>
                    {school.city} / {school.district}
                  </TableCell>
                  <TableCell>{formatInstitutionTypes(school)}</TableCell>
                  <TableCell>
                    {school.examName}
                    <span className="block text-xs text-muted-foreground">
                      {school.examType} · {formatDate(school.examDate)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{school.participants}</TableCell>
                  <TableCell className="text-right">{formatNumber(school.avgNet)}</TableCell>
                  <TableCell className="text-right">{formatNumber(school.avgScore)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      ) : null}

      {show("sirala") ? (
        <Card>
          <CardHeader>
            <CardTitle>Başarı sıralaması</CardTitle>
            <CardDescription>
              Okullar ortalama nete göre sıralanır. İl farkı, okulun il ortalamasına göre konumudur.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sıra</TableHead>
                  <TableHead>Okul</TableHead>
                  <TableHead>İl / ilçe</TableHead>
                  <TableHead className="text-right">Öğrenci</TableHead>
                  <TableHead className="text-right">Ort. net</TableHead>
                  <TableHead className="text-right">{vsScopeLabel}</TableHead>
                  <TableHead className="text-right">Ort. puan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.schools.map((school, index) => {
                  const vs =
                    school.avgNet != null && provinceAvg != null
                      ? Math.round((school.avgNet - provinceAvg) * 100) / 100
                      : null;
                  return (
                    <TableRow key={school.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <SchoolName
                          id={school.id}
                          name={school.name}
                          href={`/panel?kurum=${school.id}`}
                          viewerInstitutionId={viewerInstitutionId}
                          canOpenSchools={canOpenSchools}
                          ownHint
                        />
                        <span className="block text-xs text-muted-foreground font-mono">{school.code}</span>
                      </TableCell>
                      <TableCell>
                        {school.city} / {school.district}
                      </TableCell>
                      <TableCell className="text-right">{school.participants}</TableCell>
                      <TableCell className="text-right">{formatNumber(school.avgNet)}</TableCell>
                      <TableCell className="text-right">{vs == null ? "—" : formatNumber(vs)}</TableCell>
                      <TableCell className="text-right">{formatNumber(school.avgScore)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {show("sube") ? (
      <Card>
        <CardHeader>
          <CardTitle>Şube analizi</CardTitle>
          <CardDescription>Okul, sınıf ve şube bazında ortalama net.</CardDescription>
        </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Okul</TableHead>
                  <TableHead>İl / ilçe</TableHead>
                  <TableHead>Şube</TableHead>
                  <TableHead className="text-right">Öğrenci</TableHead>
                  <TableHead className="text-right">Ort. net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((row) => (
                  <TableRow key={`${row.institutionId}-${row.grade}-${row.section}`}>
                    <TableCell>
                      <SchoolName
                        id={row.institutionId}
                        name={row.schoolName}
                        href={`/panel/sube-karsilastirma?kurum=${row.institutionId}`}
                        viewerInstitutionId={viewerInstitutionId}
                        canOpenSchools={canOpenSchools}
                      />
                    </TableCell>
                    <TableCell>
                      {row.city} / {row.district}
                    </TableCell>
                    <TableCell>
                      {row.grade}-{row.section}
                    </TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.avgNet)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {show("sinif") ? (
      <Card>
        <CardHeader>
          <CardTitle>Sınıf karşılaştırması</CardTitle>
          <CardDescription>Okul ve sınıf düzeyinde ortalama net.</CardDescription>
        </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Okul</TableHead>
                  <TableHead>İl / ilçe</TableHead>
                  <TableHead>Sınıf</TableHead>
                  <TableHead className="text-right">Öğrenci</TableHead>
                  <TableHead className="text-right">Ort. net</TableHead>
                  <TableHead className="text-right">Ort. puan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((row) => (
                  <TableRow key={`${row.institutionId}-${row.grade}`}>
                    <TableCell>
                      <SchoolName
                        id={row.institutionId}
                        name={row.schoolName}
                        href={`/panel/sinif-karsilastirma?kurum=${row.institutionId}`}
                        viewerInstitutionId={viewerInstitutionId}
                        canOpenSchools={canOpenSchools}
                      />
                    </TableCell>
                    <TableCell>
                      {row.city} / {row.district}
                    </TableCell>
                    <TableCell>{row.grade}</TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.avgNet)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.avgScore)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {show("il") ? (
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>İlin analizi</CardTitle>
            <CardDescription>İllere göre öğrenci sayısı ve ortalama net.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.cities}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="city" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgNet" name="Ort. net" fill="var(--chart-1)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>İl</TableHead>
                  <TableHead className="text-right">Okul</TableHead>
                  <TableHead className="text-right">Öğrenci</TableHead>
                  <TableHead className="text-right">Ort. net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cities.map((city) => (
                  <TableRow key={city.city}>
                    <TableCell>{city.city}</TableCell>
                    <TableCell className="text-right">{city.schoolCount}</TableCell>
                    <TableCell className="text-right">{city.participants}</TableCell>
                    <TableCell className="text-right">{formatNumber(city.avgNet)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>İlçe kırılımı</CardTitle>
            <CardDescription>İlçe bazında okul ve öğrenci yoğunluğu.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>İlçe</TableHead>
                  <TableHead>İl</TableHead>
                  <TableHead className="text-right">Okul</TableHead>
                  <TableHead className="text-right">Öğrenci</TableHead>
                  <TableHead className="text-right">Ort. net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.districts.map((row) => (
                  <TableRow key={`${row.city}-${row.district}`}>
                    <TableCell>{row.district}</TableCell>
                    <TableCell>{row.city}</TableCell>
                    <TableCell className="text-right">{row.schoolCount}</TableCell>
                    <TableCell className="text-right">{row.participants}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.avgNet)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      ) : null}

      {show("gelisim") ? (
        <>
      <Card>
        <CardHeader>
          <CardTitle>Sınavlar arası gelişim</CardTitle>
          <CardDescription>
            {data.examType
              ? `Yalnızca ${data.examType} süreç değerlendirmelerinin tüm okullardaki ortalama neti.`
              : "Tüm okulların birleşik ortalama neti."}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.yearTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="examName" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="avgNet" name="Ort. net" stroke="var(--primary)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Okul bazlı gelişim</CardTitle>
          <CardDescription>Son süreç değerlendirme ile bir önceki süreç değerlendirme arasındaki net farkı.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Okul</TableHead>
                <TableHead className="text-right">Önceki net</TableHead>
                <TableHead className="text-right">Son net</TableHead>
                <TableHead className="text-right">Fark</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...(data.schoolProgress ?? [])]
                .sort((a, b) => (b.delta ?? -999) - (a.delta ?? -999))
                .map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <SchoolName
                        id={row.id}
                        name={row.name}
                        href={`/panel?kurum=${row.id}`}
                        viewerInstitutionId={viewerInstitutionId}
                        canOpenSchools={canOpenSchools}
                        ownHint
                      />
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(row.previousAvgNet)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.avgNet)}</TableCell>
                    <TableCell className="text-right">
                      {row.delta == null ? "—" : deltaLabel(row.delta)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </>
      ) : null}
    </div>
  );
}
