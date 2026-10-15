import { loadPanelContext } from "@/lib/panel";
import { AppShell } from "@/components/app-shell";
import { PasswordChangeForm } from "@/components/password-change-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Şifre değiştir" };

export default async function PasswordPage() {
  const ctx = await loadPanelContext();
  return (
    <AppShell
      user={ctx.session}
      institution={ctx.institution}
      modules={ctx.modules}
      institutions={ctx.allInstitutions}
      canViewNetwork={ctx.canViewNetwork}
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Şifre değiştir</h1>
          <p className="text-muted-foreground mt-1">
            {ctx.session.role === "system_admin"
              ? "Sistem yöneticisi şifresi. Bir okula bağlı değilsiniz."
              : ctx.session.role === "district_admin"
              ? `${ctx.session.district ?? "İlçe"} / ${ctx.session.city ?? ""} hesabının şifresi.`
              : ctx.institution
              ? `${ctx.institution.name} (${ctx.institution.code}) hesabının şifresi.`
              : "Hesap şifrenizi onay beklemeden değiştirin."}
          </p>
        </div>
        <PasswordChangeForm />
      </div>
    </AppShell>
  );
}
