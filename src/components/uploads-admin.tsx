"use client";

import { useTransition } from "react";
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
import type { UploadError, UploadRecord } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { useRouter } from "next/navigation";

export function UploadsAdmin({
  uploads,
}: {
  uploads: Array<
    UploadRecord & { errors: UploadError[]; examName?: string; institutionNames?: string[] }
  >;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function rollback(uploadId: string) {
    start(async () => {
      const response = await fetch("/api/import/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Geri alma başarısız.");
        return;
      }
      toast.success("Yükleme geri alındı.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Yüklemeler</h1>
        <p className="text-muted-foreground mt-1">
          Tüm okulların yüklemeleri burada durur. Hatalı bir yüklemeyi geri alabilirsiniz. Aynı
          dosya içeriği yeniden kaydedilmez.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>İşlemler</CardTitle>
          <CardDescription>{uploads.length} kayıt</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dosya</TableHead>
                <TableHead>Sınav</TableHead>
                <TableHead>Okul</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Geçerli / Hata</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploads.map((upload) => (
                <TableRow key={upload.id}>
                  <TableCell>{upload.fileName}</TableCell>
                  <TableCell>{upload.examName || "—"}</TableCell>
                  <TableCell>{upload.institutionNames?.join(", ") || "—"}</TableCell>
                  <TableCell>{upload.examType}</TableCell>
                  <TableCell>{upload.status}</TableCell>
                  <TableCell>
                    {upload.validCount} / {upload.errorCount}
                  </TableCell>
                  <TableCell>{formatDate(upload.createdAt.slice(0, 10))}</TableCell>
                  <TableCell>
                    {upload.status === "committed" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => rollback(upload.id)}
                      >
                        Geri al
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
