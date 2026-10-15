import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { APP_TITLE } from "@/lib/page-titles";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Giriş" };

export default function LoginPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden lg:flex flex-col bg-sidebar text-sidebar-foreground px-12 py-10">
        <div>
          <p className="text-sm tracking-[0.2em] uppercase text-white/70">
            Okul içi süreç değerlendirme takibi
          </p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight">
            {APP_TITLE}
          </h1>
          <p className="mt-4 max-w-lg text-white/80 text-lg">
            LGS, TYT ve AYT süreç değerlendirmelerini yükleyin, şube ve ders kırılımlarını görün,
            eğitim yılı boyunca gelişimi izleyin.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <p className="lg:hidden text-sm font-medium text-primary mb-2">
            {APP_TITLE}
          </p>
          <h2 className="text-2xl font-semibold">Giriş yapın</h2>
          <p className="mt-2 text-muted-foreground">
            Okullar kurum kodu ve şifre ile girer. Yönetici e-posta kullanır.
          </p>
          <Suspense fallback={<p className="mt-8 text-sm text-muted-foreground">Form yükleniyor…</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
