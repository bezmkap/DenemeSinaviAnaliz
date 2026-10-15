import { ANALYSIS_MODULES, IL_ANALYSIS_MODULES } from "@/lib/domain";

export const APP_TITLE = "Rize ili süreç izleme sistemi";

const STATIC_TITLES: Record<string, string> = {
  "/yukle": "Sonuç yükle",
  "/cevap-anahtari": "Cevap anahtarı",
  "/karne": "Öğrenci karnesi",
  "/sifre": "Şifre değiştir",
  "/yonetim": "Okul kaydı",
  "/yonetim/akademik-yillar": "Akademik yıllar",
  "/il-analizi": "İl analizi",
  "/yonetim/analiz": "İl analizi",
  "/yonetim/yetkiler": "Yetkiler",
  "/yonetim/yuklemeler": "Yüklemeler",
  "/yonetim/islem-gecmisi": "İşlem geçmişi",
  "/yonetim/ilce-kullanicilari": "İlçe kullanıcıları",
  "/giris": "Giriş",
};

export function pageTitleFromPath(pathname: string): string | null {
  if (STATIC_TITLES[pathname]) return STATIC_TITLES[pathname];
  if (pathname === "/panel") return "Okul özeti";
  const panelMatch = pathname.match(/^\/panel\/([^/]+)/);
  if (panelMatch) {
    return ANALYSIS_MODULES.find((row) => row.slug === panelMatch[1])?.name ?? "Analiz";
  }
  const ilMatch = pathname.match(/^\/il-analizi\/([^/]+)/);
  if (ilMatch) {
    return IL_ANALYSIS_MODULES.find((row) => row.slug === ilMatch[1])?.name ?? "İl analizi";
  }
  return null;
}

export function pageSectionFromPath(pathname: string, role?: string): string | null {
  if (
    pathname.startsWith("/yukle") ||
    pathname.startsWith("/cevap-anahtari") ||
    pathname.startsWith("/karne")
  ) {
    return "İşlemler";
  }
  if (pathname.startsWith("/yonetim")) return "Yönetim";
  if (pathname.startsWith("/il-analizi")) {
    return role === "district_admin" ? "İlçe analizi" : "İl analizi";
  }
  if (pathname.startsWith("/panel") || pathname.startsWith("/sifre")) return "Okul analizi";
  return null;
}

export function documentTitle(pathname: string): string {
  const page = pageTitleFromPath(pathname);
  return page ? `${page} · ${APP_TITLE}` : APP_TITLE;
}
