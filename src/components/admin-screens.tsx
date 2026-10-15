"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ANALYSIS_MODULES, EXAM_TYPES, IL_ANALIZI_MODULE, IL_ANALIZI_SLUG, INSTITUTION_TYPE_LABELS, INSTITUTION_TYPES, formatInstitutionTypes, institutionHasType, institutionTypesOf, sanitizeExamTypes, suggestedExamTypesFor, type ExamType, type Institution, type InstitutionType, type UserAccount } from "@/lib/domain";
import { useRouter } from "next/navigation";

function ExamTypeCheckboxes({
  types,
  value,
  onChange,
}: {
  types: InstitutionType[];
  value: ExamType[];
  onChange: (next: ExamType[]) => void;
}) {
  const allowed = suggestedExamTypesFor(types);
  return (
    <div className="space-y-1 sm:col-span-2">
      <Label>Açık sınav türü yetkileri</Label>
      <p className="text-xs text-muted-foreground">
        Ortaokul yalnız LGS, lise yalnız TYT ve AYT kullanır. AYT açıksa TYT de açık kalır.
      </p>
      <div className="flex flex-wrap gap-3 pt-1">
        {allowed.map((exam) => (
          <label key={exam} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.includes(exam)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...value, exam]
                  : value.filter((item) => item !== exam);
                onChange(sanitizeExamTypes(types, next));
              }}
            />
            {exam}
          </label>
        ))}
      </div>
    </div>
  );
}

function InstitutionTypeCheckboxes({
  value,
  onChange,
}: {
  value: InstitutionType[];
  onChange: (next: InstitutionType[]) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>Kurum türü</Label>
      <div className="flex flex-wrap gap-3 pt-1">
        {INSTITUTION_TYPES.map((item) => (
          <label key={item} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.includes(item)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...value, item]
                  : value.filter((row) => row !== item);
                if (!next.length) return;
                onChange(next);
              }}
            />
            {INSTITUTION_TYPE_LABELS[item]}
          </label>
        ))}
      </div>
    </div>
  );
}

export function InstitutionsAdmin({ institutions }: { institutions: Institution[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [types, setTypes] = useState<InstitutionType[]>(["ortaokul"]);
  const [examTypes, setExamTypes] = useState<ExamType[]>(["LGS"]);
  const [pending, setPending] = useState(false);
  const [entryKey, setEntryKey] = useState(0);
  const [lastLogin, setLastLogin] = useState<{
    code: string;
    password: string;
    name: string;
  } | null>(null);
  const [editing, setEditing] = useState<Institution | null>(null);
  const [deleting, setDeleting] = useState<Institution | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [editTypes, setEditTypes] = useState<InstitutionType[]>(["ortaokul"]);
  const [editExamTypes, setEditExamTypes] = useState<ExamType[]>(["LGS"]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingDelete, setSavingDelete] = useState(false);

  function openEdit(inst: Institution) {
    setEditing(inst);
    setEditCode(inst.code);
    setEditName(inst.name);
    setEditCity(inst.city);
    setEditDistrict(inst.district);
    setEditTypes(institutionTypesOf(inst));
    setEditExamTypes(inst.examTypePermissions);
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    try {
      const response = await fetch(`/api/admin/institutions/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editCode,
          name: editName,
          city: editCity,
          district: editDistrict,
          type: editTypes[0],
          types: editTypes,
          examTypePermissions: editExamTypes,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Kurum güncellenemedi.");
        return;
      }
      toast.success(`${data.institution.name} güncellendi.`);
      setEditing(null);
      router.refresh();
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSavingDelete(true);
    try {
      const response = await fetch(`/api/admin/institutions/${deleting.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Kurum silinemedi.");
        return;
      }
      toast.success(`${data.deleted.name} silindi.`);
      setDeleting(null);
      setLastLogin((current) =>
        current && current.code === deleting.code ? null : current,
      );
      router.refresh();
    } finally {
      setSavingDelete(false);
    }
  }

  async function createInstitution(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch("/api/admin/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          city,
          district,
          type: types[0],
          types,
          examTypePermissions: examTypes,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Kurum eklenemedi.");
        return;
      }
      const login = data.login as { code: string; password: string };
      setLastLogin({ code: login.code, password: login.password, name: data.institution.name });
      toast.success(`${data.institution.name} kaydedildi. Sıradaki okulu girebilirsiniz.`);
      setCode("");
      setName("");
      setEntryKey((current) => current + 1);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Okul kaydı</h1>
        <p className="text-muted-foreground mt-1">
          Okulları sırayla girin. Her okul kendi kurum kodu ve ilk şifresiyle hemen giriş yapar;
          şifre değişimi onay gerektirmez. Sınav dosyasındaki kurum kodu bu kayıtla eşleşir.
        </p>
      </div>
      {lastLogin ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle>Son kaydedilen okul</CardTitle>
            <CardDescription>
              {lastLogin.name} sisteme alındı. Okul bu bilgilerle giriş yapabilir.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Kurum kodu / kullanıcı adı</span>
              <span className="block font-mono text-base">{lastLogin.code}</span>
            </p>
            <p>
              <span className="text-muted-foreground">İlk şifre</span>
              <span className="block font-mono text-base">{lastLogin.password}</span>
            </p>
            <p className="sm:col-span-2 text-muted-foreground">
              İlk şifre kurum kodunun kendisidir. Okul giriş yaptıktan sonra Şifre değiştir
              ekranından onay beklemeden yeniler.
            </p>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Sıradaki okul</CardTitle>
          <CardDescription>
            Kaydettikten sonra kod ve ad temizlenir; il ve ilçe aynı kalır.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createInstitution} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Kurum kodu</Label>
              <Input
                key={entryKey}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                required
                autoComplete="off"
                placeholder="Örn. 000404"
              />
            </div>
            <div className="space-y-1">
              <Label>Kurum adı</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>İl</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>İlçe</Label>
              <Input value={district} onChange={(e) => setDistrict(e.target.value)} required />
            </div>
            <InstitutionTypeCheckboxes
              value={types}
              onChange={(next) => {
                setTypes(next);
                setExamTypes(suggestedExamTypesFor(next));
              }}
            />
            <ExamTypeCheckboxes types={types} value={examTypes} onChange={setExamTypes} />
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Kaydediliyor…" : "Kaydet ve sonrakine geç"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Kayıtlı kurumlar</CardTitle>
          <CardDescription>
            Giriş kullanıcı adı kurum kodudur. Okulu düzenleyebilir veya silebilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kod / giriş</TableHead>
                <TableHead>Ad</TableHead>
                <TableHead>İl</TableHead>
                <TableHead>İlçe</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Sınav yetkisi</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutions.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell className="font-mono">{inst.code}</TableCell>
                  <TableCell>{inst.name}</TableCell>
                  <TableCell>{inst.city}</TableCell>
                  <TableCell>{inst.district}</TableCell>
                  <TableCell>{formatInstitutionTypes(inst)}</TableCell>
                  <TableCell>{inst.examTypePermissions.join(", ")}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(inst)}>
                      Düzenle
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleting(inst)}
                    >
                      Sil
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Okulu düzenle</DialogTitle>
            <DialogDescription>
              Kurum kodu değişirse okul bundan sonra yeni kodla giriş yapar. Şifre aynı kalır.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Kurum kodu</Label>
              <Input
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label>Kurum adı</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>İl</Label>
              <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>İlçe</Label>
              <Input
                value={editDistrict}
                onChange={(e) => setEditDistrict(e.target.value)}
                required
              />
            </div>
            <InstitutionTypeCheckboxes
              value={editTypes}
              onChange={(next) => {
                setEditTypes(next);
                setEditExamTypes(suggestedExamTypesFor(next));
              }}
            />
            <ExamTypeCheckboxes types={editTypes} value={editExamTypes} onChange={setEditExamTypes} />
            <DialogFooter className="sm:col-span-2 mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Okulu sil</DialogTitle>
            <DialogDescription>
              {deleting
                ? `${deleting.name} (${deleting.code}) silinince öğrencileri, sınav sonuçları ve giriş hesabı da silinir. Bu işlem geri alınamaz.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={savingDelete}
              onClick={confirmDelete}
            >
              {savingDelete ? "Siliniyor…" : "Okulu sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PermissionsAdmin({
  institutions,
  permissionIndex,
}: {
  institutions: Institution[];
  permissionIndex: Array<{
    institutionId: string;
    moduleSlug: string;
    examType: ExamType;
    enabled: boolean;
  }>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [type, setType] = useState("");
  const [examType, setExamType] = useState<ExamType | "">("");
  const [selected, setSelected] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>(ANALYSIS_MODULES.map((mod) => mod.slug));
  const [examTypes, setExamTypes] = useState<ExamType[]>(["LGS"]);
  const [enabled, setEnabled] = useState(true);
  const [scope, setScope] = useState<"selected" | "all">("selected");

  const filtered = useMemo(() => {
    return institutions.filter((inst) => {
      const q = query.trim().toLocaleLowerCase("tr-TR");
      if (
        q &&
        ![inst.code, inst.name, inst.city, inst.district].some((v) =>
          v.toLocaleLowerCase("tr-TR").includes(q),
        )
      ) {
        return false;
      }
      if (city && inst.city !== city) return false;
      if (district && inst.district !== district) return false;
      if (type && !institutionHasType(inst, type as InstitutionType)) return false;
      if (examType && !inst.examTypePermissions.includes(examType)) return false;
      return true;
    });
  }, [institutions, query, city, district, type, examType]);

  async function apply() {
    const institutionIds = scope === "all" ? "all" : selected;
    if (institutionIds !== "all" && institutionIds.length === 0) {
      toast.error("Kurum seçin veya tüm okulları seçin.");
      return;
    }
    const response = await fetch("/api/admin/permissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institutionIds,
        moduleSlugs: modules,
        examTypes,
        enabled,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error ?? "Yetki güncellenemedi.");
      return;
    }
    toast.success(`${data.logs.length} yetki kaydı yazıldı.`);
    router.refresh();
  }

  const cities = [...new Set(institutions.map((i) => i.city))];
  const districts = [...new Set(institutions.map((i) => i.district))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Yetkiler</h1>
        <p className="text-muted-foreground mt-1">
          Okul müdürü kendi okulunun analizlerini görür. İl genelini ancak siz açarsanız görür.
          LGS, TYT ve AYT için ayrı yetki verilir. Okul ve ilçe cevap anahtarını görür; şık,
          kazanım ve kitapçık karşılığını yalnızca sistem yöneticisi değiştirir.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Filtre ve seçim</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            placeholder="Kurum kodu veya ad"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="h-8 rounded-lg border px-2 text-sm" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">Tüm iller</option>
            {cities.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select className="h-8 rounded-lg border px-2 text-sm" value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="">Tüm ilçeler</option>
            {districts.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select className="h-8 rounded-lg border px-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tüm türler</option>
            <option value="ortaokul">Ortaokul</option>
            <option value="lise">Lise</option>
          </select>
          <select
            className="h-8 rounded-lg border px-2 text-sm"
            value={examType}
            onChange={(e) => setExamType(e.target.value as ExamType | "")}
          >
            <option value="">Tüm sınav türleri</option>
            {EXAM_TYPES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Toplu işlem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={scope === "selected"}
                onChange={() => setScope("selected")}
              />
              Seçilen okullar
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={scope === "all"} onChange={() => setScope("all")} />
              Tüm okullar
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Aç (işareti kaldırarak kapat)
            </label>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Okul analizleri</p>
            <div className="flex flex-wrap gap-3">
              {ANALYSIS_MODULES.map((mod) => (
                <label key={mod.slug} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={modules.includes(mod.slug)}
                    onChange={(e) =>
                      setModules((current) =>
                        e.target.checked
                          ? [...current, mod.slug]
                          : current.filter((item) => item !== mod.slug),
                      )
                    }
                  />
                  {mod.name}
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <p className="text-sm font-medium">{IL_ANALIZI_MODULE.name}</p>
            <p className="text-xs text-muted-foreground">
              Okul müdürü kendi okulunu her zaman görür. İl analizini yalnızca bu kutu işaretli
              işleme dahil edilirse açar veya kapatırsınız.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={modules.includes(IL_ANALIZI_SLUG)}
                onChange={(e) =>
                  setModules((current) =>
                    e.target.checked
                      ? [...current, IL_ANALIZI_SLUG]
                      : current.filter((item) => item !== IL_ANALIZI_SLUG),
                  )
                }
              />
              İl analizini bu işleme dahil et
            </label>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Sınav türü</p>
            <p className="text-xs text-muted-foreground mb-2">
              LGS yalnızca ortaokullara, TYT ve AYT yalnızca liselere uygulanır.
            </p>
            <div className="flex gap-3">
              {EXAM_TYPES.map((exam) => (
                <label key={exam} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={examTypes.includes(exam)}
                    onChange={(e) =>
                      setExamTypes((current) => {
                        const next = e.target.checked
                          ? [...current, exam]
                          : current.filter((item) => item !== exam);
                        if (exam === "AYT" && e.target.checked && !next.includes("TYT")) next.push("TYT");
                        if (exam === "TYT" && !e.target.checked) {
                          return next.filter((item) => item !== "AYT");
                        }
                        return next;
                      })
                    }
                  />
                  {exam}
                </label>
              ))}
            </div>
          </div>
          <Button type="button" onClick={apply}>
            Yetkileri uygula
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            Okullar
            <Button
              type="button"
              variant="ghost"
              className="ml-3"
              onClick={() => setSelected(filtered.map((i) => i.id))}
            >
              Görünenleri seç
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Kod</TableHead>
                <TableHead>Okul</TableHead>
                <TableHead>İl / İlçe</TableHead>
                <TableHead>İl analizi</TableHead>
                <TableHead>Açık okul analizleri</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inst) => {
                const open = permissionIndex
                  .filter((p) => p.institutionId === inst.id && p.enabled && p.moduleSlug !== IL_ANALIZI_SLUG)
                  .map((p) => `${p.moduleSlug}/${p.examType}`);
                const networkOpen = permissionIndex.some(
                  (p) => p.institutionId === inst.id && p.moduleSlug === IL_ANALIZI_SLUG && p.enabled,
                );
                return (
                  <TableRow key={inst.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.includes(inst.id)}
                        onChange={(e) =>
                          setSelected((current) =>
                            e.target.checked
                              ? [...current, inst.id]
                              : current.filter((id) => id !== inst.id),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="font-mono">{inst.code}</TableCell>
                    <TableCell>{inst.name}</TableCell>
                    <TableCell>
                      {inst.city} / {inst.district}
                    </TableCell>
                    <TableCell>{networkOpen ? "Açık" : "Kapalı"}</TableCell>
                    <TableCell className="text-xs">{open.join(", ") || "Yok"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function DistrictUsersAdmin({ users }: { users: UserAccount[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [lastLogin, setLastLogin] = useState<{ email: string; password: string; name: string } | null>(
    null,
  );

  function openEdit(user: UserAccount) {
    setEditing(user);
    setEditName(user.fullName);
    setEditEmail(user.email);
    setEditCity(user.city ?? "");
    setEditDistrict(user.district ?? "");
    setEditPassword("");
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch("/api/admin/district-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, city, district, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "İlçe hesabı oluşturulamadı.");
        return;
      }
      setLastLogin({
        email: data.login.email,
        password: data.login.password,
        name: data.user.fullName,
      });
      setEmail("");
      setFullName("");
      setPassword("");
      toast.success(`${data.user.fullName} için ilçe hesabı açıldı.`);
      router.refresh();
    } catch {
      toast.error("Bağlantı hatası.");
    } finally {
      setPending(false);
    }
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    try {
      const response = await fetch(`/api/admin/district-users/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: editEmail,
          fullName: editName,
          city: editCity,
          district: editDistrict,
          password: editPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "İlçe hesabı güncellenemedi.");
        return;
      }
      toast.success(`${data.user.fullName} güncellendi.`);
      if (editPassword) {
        setLastLogin({
          email: data.user.email,
          password: editPassword,
          name: data.user.fullName,
        });
      }
      setEditing(null);
      router.refresh();
    } catch {
      toast.error("Bağlantı hatası.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeUser(id: string) {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/district-users/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "İlçe hesabı silinemedi.");
        return;
      }
      toast.success("İlçe hesabı silindi.");
      router.refresh();
    } catch {
      toast.error("Bağlantı hatası.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">İlçe kullanıcıları</h1>
        <p className="text-muted-foreground mt-1">
          İlçe hesabı yalnızca kendi ilçesindeki okulları görür. Okul ekleyemez; okulları sistem
          yöneticisi kaydeder. Kayıtlı okulların ilçeleri için hesap yoksa sistem otomatik açar;
          ilk şifre ilçe adıdır (ör. Çankaya).
        </p>
      </div>
      {lastLogin ? (
        <Card>
          <CardHeader>
            <CardTitle>Yeni giriş bilgisi</CardTitle>
            <CardDescription>{lastLogin.name}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">E-posta</span>
              <span className="block font-mono text-base">{lastLogin.email}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Şifre</span>
              <span className="block font-mono text-base">{lastLogin.password}</span>
            </p>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Yeni ilçe hesabı</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createUser} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Ad soyad</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>E-posta</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="ornek@ilce.meb"
              />
            </div>
            <div className="space-y-1">
              <Label>İl</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>İlçe</Label>
              <Input value={district} onChange={(e) => setDistrict(e.target.value)} required />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Şifre</Label>
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Kaydediliyor…" : "İlçe hesabı oluştur"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Kayıtlı ilçe hesapları</CardTitle>
          <CardDescription>{users.length} hesap</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>E-posta</TableHead>
                <TableHead>İl / İlçe</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.fullName}</TableCell>
                  <TableCell className="font-mono">{user.email}</TableCell>
                  <TableCell>
                    {user.city} / {user.district}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(user)}>
                        Düzenle
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={deletingId === user.id}
                        onClick={() => removeUser(user.id)}
                      >
                        Sil
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>İlçe hesabını düzenle</DialogTitle>
            <DialogDescription>
              Ad, e-posta, il, ilçe ve istenirse şifre değişir. Boş şifre mevcut şifreyi korur.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-district-name">Ad soyad</Label>
              <Input id="edit-district-name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-district-email">E-posta</Label>
              <Input
                id="edit-district-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="edit-district-city">İl</Label>
                <Input id="edit-district-city" value={editCity} onChange={(e) => setEditCity(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-district-place">İlçe</Label>
                <Input
                  id="edit-district-place"
                  value={editDistrict}
                  onChange={(e) => setEditDistrict(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-district-password">Yeni şifre</Label>
              <Input
                id="edit-district-password"
                type="text"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Değiştirmeyecekseniz boş bırakın"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
