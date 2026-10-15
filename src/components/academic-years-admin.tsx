"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { suggestNextAcademicYear, type AcademicYear } from "@/lib/domain";
import { formatDate } from "@/lib/format";

export type AcademicYearRow = AcademicYear & {
  sittingCount: number;
  studentCount: number;
};

function usageLabel(year: AcademicYearRow) {
  if (!year.sittingCount && !year.studentCount) return "Kayıt yok";
  const parts = [];
  if (year.sittingCount) parts.push(`${year.sittingCount} sınav`);
  if (year.studentCount) parts.push(`${year.studentCount} öğrenci`);
  return parts.join(" · ");
}

export function AcademicYearsAdmin({
  years,
  suggestion,
}: {
  years: AcademicYearRow[];
  suggestion: { label: string; startsOn: string; endsOn: string };
}) {
  const router = useRouter();
  const [label, setLabel] = useState(suggestion.label);
  const [startsOn, setStartsOn] = useState(suggestion.startsOn);
  const [endsOn, setEndsOn] = useState(suggestion.endsOn);
  const [isActive, setIsActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<AcademicYearRow | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editStartsOn, setEditStartsOn] = useState("");
  const [editEndsOn, setEditEndsOn] = useState("");
  const [editActive, setEditActive] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState<AcademicYearRow | null>(null);
  const [savingDelete, setSavingDelete] = useState(false);

  function openEdit(year: AcademicYearRow) {
    setEditing(year);
    setEditLabel(year.label);
    setEditStartsOn(year.startsOn);
    setEditEndsOn(year.endsOn);
    setEditActive(year.isActive);
  }

  async function createYear(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch("/api/admin/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, startsOn, endsOn, isActive }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Akademik yıl eklenemedi.");
        return;
      }
      const created = data.year as AcademicYear;
      toast.success(`${created.label} eklendi.`);
      const next = suggestNextAcademicYear([
        ...years.map((year) => ({
          id: year.id,
          label: year.label,
          startsOn: year.startsOn,
          endsOn: year.endsOn,
          isActive: year.isActive,
        })),
        created,
      ]);
      setLabel(next.label);
      setStartsOn(next.startsOn);
      setEndsOn(next.endsOn);
      setIsActive(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    try {
      const response = await fetch(`/api/admin/academic-years/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: editLabel,
          startsOn: editStartsOn,
          endsOn: editEndsOn,
          isActive: editActive,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Akademik yıl güncellenemedi.");
        return;
      }
      toast.success(`${data.year.label} güncellendi.`);
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
      const response = await fetch(`/api/admin/academic-years/${deleting.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Akademik yıl silinemedi.");
        return;
      }
      toast.success(`${data.deleted.label} silindi.`);
      setDeleting(null);
      router.refresh();
    } finally {
      setSavingDelete(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Akademik yıllar</h1>
        <p className="mt-1 text-muted-foreground">
          Program yıllarca kullanılacağı için her öğretim yılını buradan ekleyin. Analiz ve sonuç
          yükleme ekranlarındaki yıl listesi bu kayıtlardan gelir. Varsayılan yıl, yıl seçilmediğinde
          açılan yıldır.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Yeni akademik yıl</CardTitle>
          <CardDescription>
            Örnek: 2026-2027. Başlangıç genellikle eylül, bitiş haziran olur. İstediğiniz tarihi
            yazabilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createYear} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="year-label">Akademik yıl</Label>
              <Input
                id="year-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="2026-2027"
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="year-start">Başlangıç</Label>
              <Input
                id="year-start"
                type="date"
                value={startsOn}
                onChange={(event) => setStartsOn(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="year-end">Bitiş</Label>
              <Input
                id="year-end"
                type="date"
                value={endsOn}
                onChange={(event) => setEndsOn(event.target.value)}
                required
              />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              Analiz ve yüklemede varsayılan yıl olsun
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Kaydediliyor…" : "Akademik yılı ekle"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Kayıtlı yıllar</CardTitle>
          <CardDescription>
            Etiket veya tarihler değişince bu yıla bağlı sınavlar ve öğrenciler aynı yılda kalır.
            Sınavı veya öğrencisi olan yıl silinemez.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Yıl</TableHead>
                <TableHead>Başlangıç</TableHead>
                <TableHead>Bitiş</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Bağlı kayıt</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.map((year) => {
                const unused = year.sittingCount === 0 && year.studentCount === 0;
                return (
                  <TableRow key={year.id}>
                    <TableCell className="font-medium">{year.label}</TableCell>
                    <TableCell>{formatDate(year.startsOn)}</TableCell>
                    <TableCell>{formatDate(year.endsOn)}</TableCell>
                    <TableCell>{year.isActive ? "Varsayılan" : "Seçilebilir"}</TableCell>
                    <TableCell>{usageLabel(year)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openEdit(year)}>
                          Değiştir
                        </Button>
                        {unused && years.length > 1 ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleting(year)}
                          >
                            Sil
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Akademik yılı değiştir</DialogTitle>
            <DialogDescription>
              {editing
                ? `${editing.label} yılının etiketi, tarihleri ve varsayılan durumu değişir.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-year-label">Akademik yıl</Label>
              <Input
                id="edit-year-label"
                value={editLabel}
                onChange={(event) => setEditLabel(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-year-start">Başlangıç</Label>
              <Input
                id="edit-year-start"
                type="date"
                value={editStartsOn}
                onChange={(event) => setEditStartsOn(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-year-end">Bitiş</Label>
              <Input
                id="edit-year-end"
                type="date"
                value={editEndsOn}
                onChange={(event) => setEditEndsOn(event.target.value)}
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editActive || years.length === 1}
                disabled={years.length === 1}
                onChange={(event) => setEditActive(event.target.checked)}
              />
              Varsayılan yıl
            </label>
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
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Akademik yılı sil</DialogTitle>
            <DialogDescription>
              {deleting ? `${deleting.label} silinecek. Bu yıla bağlı sınav veya öğrenci yok.` : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              Vazgeç
            </Button>
            <Button type="button" variant="destructive" disabled={savingDelete} onClick={confirmDelete}>
              {savingDelete ? "Siliniyor…" : "Yılı sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
