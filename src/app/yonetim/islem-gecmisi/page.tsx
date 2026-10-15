import { redirect } from "next/navigation";
import { requireUser } from "@/lib/panel";
import { getStore } from "@/lib/store/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "İşlem geçmişi" };

export default async function AuditPage() {
  const session = await requireUser();
  if (session.role !== "system_admin") redirect("/panel");
  const store = await getStore();
  const institutions = store.listInstitutions(session);
  const logs = store.listAudit(session);
  return (
    <AppShell user={session} institution={null} modules={[]} institutions={institutions}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">İşlem geçmişi</h1>
          <p className="text-muted-foreground mt-1">
            Yetki değişikliklerinde yönetici, kurum, modül, eski durum, yeni durum ve tarih
            saklanır.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Kayıtlar</CardTitle>
            <CardDescription>{logs.length} işlem</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Yönetici</TableHead>
                  <TableHead>Kurum</TableHead>
                  <TableHead>Modül</TableHead>
                  <TableHead>Sınav</TableHead>
                  <TableHead>Eski</TableHead>
                  <TableHead>Yeni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDate(log.createdAt.slice(0, 10))}</TableCell>
                    <TableCell>{log.actorEmail}</TableCell>
                    <TableCell>{log.institutionName ?? "—"}</TableCell>
                    <TableCell>{log.moduleSlug ?? log.action}</TableCell>
                    <TableCell>{log.examType ?? "—"}</TableCell>
                    <TableCell>{log.oldValue ?? "—"}</TableCell>
                    <TableCell>{log.newValue ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
