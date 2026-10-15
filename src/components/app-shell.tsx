"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  BookOpenCheck,
  Building2,
  CalendarRange,
  ClipboardList,
  GitCompare,
  GraduationCap,
  History,
  KeyRound,
  LayoutDashboard,
  LineChart,
  ListOrdered,
  LogOut,
  MapPinned,
  Medal,
  Menu,
  School,
  Shield,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  ANALYSIS_MODULES,
  IL_ANALYSIS_MODULES,
  IL_MODULE_GROUPS,
  MODULE_GROUPS,
  canOpenNetworkHome,
  ilAnaliziPath,
  isSystemAdmin,
  panelPath,
  placesEqual,
  withKeptQuery,
  withKurum,
  type AnalysisModuleDef,
  type Institution,
  type SessionUser,
} from "@/lib/domain";
import { APP_TITLE, documentTitle, pageSectionFromPath, pageTitleFromPath } from "@/lib/page-titles";
import { cn, useIsClient } from "@/lib/utils";

type Props = {
  user: SessionUser;
  institution: Institution | null;
  modules: AnalysisModuleDef[];
  children: React.ReactNode;
  institutions?: Institution[];
  networkScope?: boolean;
  canViewNetwork?: boolean;
};

const SCHOOL_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "okul-ozeti": LayoutDashboard,
  "olcme-degerlendirme": ClipboardList,
  "sinav-analizi": BarChart3,
  "ogrenci-sonuclari": GraduationCap,
  "sinif-karsilastirma": School,
  "sube-karsilastirma": Users,
  "ders-analizi": BookOpen,
  "dybn-analizi": GitCompare,
  "soru-analizi": BookOpenCheck,
  "puan-dagilim": Medal,
  "sinavlar-arasi-gelisim": TrendingUp,
  "ogrenci-performans": LineChart,
  "basari-sirasi": ListOrdered,
  "risk-analizi": AlertTriangle,
  "gelisim-trendi": Sparkles,
  "akran-karsilastirma": Users,
  "sinif-detay-analizi": School,
  "ogrenci-profili": GraduationCap,
  "mudahale-onerileri": AlertTriangle,
};

const IL_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  genel: LayoutDashboard,
  "olcme-degerlendirme": ClipboardList,
  ders: BookOpen,
  okul: Building2,
  sube: Users,
  sinif: School,
  il: MapPinned,
  soru: BookOpenCheck,
  sirala: ListOrdered,
  gelisim: TrendingUp,
};

export function AppShell({
  user,
  institution,
  modules,
  children,
  institutions = [],
  networkScope = false,
  canViewNetwork = false,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isClient = useIsClient();
  const [open, setOpen] = useState(false);
  const isAdmin = isSystemAdmin(user.role);
  const isDistrict = user.role === "district_admin";
  const onPanel = pathname === "/panel" || pathname.startsWith("/panel/");
  const onAdmin = pathname.startsWith("/yonetim");
  const onIlAnaliz = pathname === "/il-analizi" || pathname.startsWith("/il-analizi");
  const canSeeNetwork = canOpenNetworkHome(user.role) || canViewNetwork;
  const adminHome = canOpenNetworkHome(user.role) && (networkScope || !institution);
  const pageTitle = pageTitleFromPath(pathname);
  const pageSection = pageSectionFromPath(pathname, user.role);
  const kurumId = institution?.id ?? searchParams.get("kurum");
  const panelHref = (slug: string) => withKeptQuery(panelPath(slug, kurumId), searchParams);
  const panelHome = panelHref("okul-ozeti");
  const passwordHref = withKurum("/sifre", kurumId);
  const selectedCity = isClient ? (searchParams.get("il") ?? "") : "";
  const selectedDistrict = isClient ? (searchParams.get("ilce") ?? "") : "";
  const districtPlaces = useMemo(() => {
    const seen = new Map<string, { city: string; district: string }>();
    for (const inst of institutions) {
      const city = inst.city.trim();
      const district = inst.district.trim();
      if (!city || !district) continue;
      const key = `${city}::${district}`;
      if (!seen.has(key)) seen.set(key, { city, district });
    }
    return [...seen.values()].sort(
      (a, b) =>
        a.district.localeCompare(b.district, "en") || a.city.localeCompare(b.city, "en"),
    );
  }, [institutions]);
  const districtValue = useMemo(() => {
    if (!selectedDistrict) return "";
    if (selectedCity) return `${selectedCity}::${selectedDistrict}`;
    const match = districtPlaces.find((place) => placesEqual(place.district, selectedDistrict));
    return match ? `${match.city}::${match.district}` : "";
  }, [selectedCity, selectedDistrict, districtPlaces]);
  const visibleSchools = useMemo(() => {
    if (isDistrict) return institutions;
    return institutions.filter((inst) => {
      if (selectedDistrict && !placesEqual(inst.district, selectedDistrict)) return false;
      if (selectedCity && !placesEqual(inst.city, selectedCity)) return false;
      return true;
    });
  }, [institutions, isDistrict, selectedCity, selectedDistrict]);

  const schoolModules = useMemo(() => {
    if (modules.length) return modules;
    if (isAdmin || isDistrict) return ANALYSIS_MODULES;
    return [];
  }, [modules, isAdmin, isDistrict]);

  const groupedSchoolModules = useMemo(() => {
    return MODULE_GROUPS.map((group) => ({
      ...group,
      items: group.slugs
        .map((slug) => schoolModules.find((mod) => mod.slug === slug))
        .filter((mod): mod is AnalysisModuleDef => Boolean(mod)),
    })).filter((group) => group.items.length > 0);
  }, [schoolModules]);

  const groupedIlModules = useMemo(() => {
    return IL_MODULE_GROUPS.map((group) => ({
      ...group,
      items: group.slugs
        .map((slug) => IL_ANALYSIS_MODULES.find((mod) => mod.slug === slug))
        .filter((mod): mod is AnalysisModuleDef => Boolean(mod)),
    })).filter((group) => group.items.length > 0);
  }, []);

  function pushNetworkQuery(next: URLSearchParams) {
    const path = onIlAnaliz ? pathname : "/il-analizi";
    const query = next.toString();
    router.push(query ? `${path}?${query}` : path);
  }

  useEffect(() => {
    document.title = documentTitle(pathname);
  }, [pathname]);

  const activeSlug =
    pathname === "/panel"
      ? "okul-ozeti"
      : pathname.startsWith("/panel/")
        ? pathname.split("/")[2]
        : null;

  const activeIlSlug =
    pathname === "/il-analizi"
      ? "genel"
      : pathname.startsWith("/il-analizi/")
        ? pathname.split("/")[2]
        : null;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/giris");
    router.refresh();
  }

  function close() {
    setOpen(false);
  }

  const nav = (
    <nav className="flex flex-col gap-4">
      <NavSection title="İşlemler">
        {isAdmin ? (
          <NavLink
            href="/yukle"
            icon={Upload}
            label="Sonuç yükle"
            description="Excel süreç değerlendirme dosyasını sisteme aktarın"
            active={pathname.startsWith("/yukle")}
            onClick={close}
          />
        ) : null}
        <NavLink
          href="/cevap-anahtari"
          icon={BookOpenCheck}
          label="Cevap anahtarı"
          description={
            user.canEditAnswerKeys ?? isAdmin
              ? "Şık, kazanım ve A/B karşılıkları"
              : "Şık ve kazanımları görün"
          }
          active={pathname.startsWith("/cevap-anahtari")}
          onClick={close}
        />
        <NavLink
          href={withKurum("/karne", kurumId)}
          icon={ClipboardList}
          label="Öğrenci karnesi"
          description="Sınıf ve öğrenci karnelerini yazdırın"
          active={pathname.startsWith("/karne")}
          onClick={close}
        />
      </NavSection>

      {schoolModules.length > 0 ? (
        <NavSection title="Okul analizi">
          {groupedSchoolModules.map((group) => (
            <div key={group.id} className="space-y-1">
              <p className="px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                {group.label}
              </p>
              {group.items.map((mod) => (
                <NavLink
                  key={mod.slug}
                  href={panelHref(mod.slug)}
                  icon={SCHOOL_ICONS[mod.slug] ?? LayoutDashboard}
                  label={mod.name}
                  description={mod.description}
                  active={mod.slug === activeSlug}
                  onClick={close}
                />
              ))}
            </div>
          ))}
        </NavSection>
      ) : null}

      {canSeeNetwork ? (
        <NavSection title={isDistrict ? "İlçe analizi" : "İl analizi"}>
          {groupedIlModules.map((group) => (
            <div key={group.id} className="space-y-1">
              <p className="px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                {group.label}
              </p>
              {group.items.map((mod) => (
                <NavLink
                  key={mod.slug}
                  href={ilAnaliziPath(mod.slug)}
                  icon={IL_ICONS[mod.slug] ?? MapPinned}
                  label={mod.name}
                  description={mod.description}
                  active={mod.slug === activeIlSlug}
                  onClick={close}
                />
              ))}
            </div>
          ))}
        </NavSection>
      ) : null}

      {isAdmin ? (
        <NavSection title="Yönetim">
          <NavLink
            href="/yonetim"
            icon={Building2}
            label="Okul kaydı"
            description="Okul ekleyin, tür ve sınav yetkisi verin"
            active={pathname === "/yonetim"}
            onClick={close}
          />
          <NavLink
            href="/yonetim/akademik-yillar"
            icon={CalendarRange}
            label="Akademik yıllar"
            description="Yıl ekleyin, varsayılan yılı değiştirin"
            active={pathname.startsWith("/yonetim/akademik-yillar")}
            onClick={close}
          />
          <NavLink
            href="/yonetim/ilce-kullanicilari"
            icon={MapPinned}
            label="İlçe kullanıcıları"
            description="İlçe hesabı açın veya kapatın"
            active={pathname.startsWith("/yonetim/ilce-kullanicilari")}
            onClick={close}
          />
          <NavLink
            href="/yonetim/yetkiler"
            icon={Shield}
            label="Yetkiler"
            description="Analiz ekranlarını açın veya kapatın"
            active={pathname.startsWith("/yonetim/yetkiler")}
            onClick={close}
          />
          <NavLink
            href="/yonetim/yuklemeler"
            icon={History}
            label="Yüklemeler"
            description="Aktarılan dosyaları görün, geri alın"
            active={pathname.startsWith("/yonetim/yuklemeler")}
            onClick={close}
          />
          <NavLink
            href="/yonetim/islem-gecmisi"
            icon={BarChart3}
            label="İşlem geçmişi"
            description="Kim ne zaman ne yaptı"
            active={pathname.startsWith("/yonetim/islem-gecmisi")}
            onClick={close}
          />
        </NavSection>
      ) : null}
    </nav>
  );

  const brandHref = canOpenNetworkHome(user.role) && !onPanel ? "/il-analizi" : panelHome;
  const brandLabel = onIlAnaliz
    ? isDistrict
      ? "İlçe analizi"
      : "İl analizi"
    : adminHome || onAdmin
      ? "Yönetim"
      : "Okul analizi";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[288px_minmax(0,1fr)] print:block">
      <aside className="hidden lg:flex min-h-screen flex-col border-r bg-card px-3 py-5 print:hidden">
        <Link href={brandHref} className="mb-4 flex items-center gap-2.5 px-1">
          <BarChart3 className="size-7 shrink-0 text-primary" />
          <span>
            <span className="block text-sm font-bold leading-tight">{APP_TITLE}</span>
            <span className="block text-xs text-muted-foreground">{brandLabel}</span>
          </span>
        </Link>
        <div className="flex-1 overflow-y-auto pr-1">{nav}</div>
        <button
          type="button"
          onClick={logout}
          className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4" /> Çıkış
        </button>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur print:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="outline" size="icon" className="lg:hidden" />}>
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(100%,20rem)] border-r bg-card p-0">
              <SheetHeader className="px-4 pt-4">
                <SheetTitle>Menü</SheetTitle>
              </SheetHeader>
              <div className="flex h-[calc(100vh-4rem)] flex-col px-3 pb-6">
                <div className="flex-1 overflow-y-auto">{nav}</div>
                <button
                  type="button"
                  onClick={logout}
                  className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  <LogOut className="size-4" /> Çıkış
                </button>
              </div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-primary lg:hidden">{APP_TITLE}</p>
            <p className="truncate font-medium">
              {pageSection && pageTitle ? (
                <>
                  <span className="text-muted-foreground">{pageSection}</span>
                  <span className="mx-1.5 text-muted-foreground">/</span>
                  <span>{pageTitle}</span>
                </>
              ) : (
                pageTitle ?? brandLabel
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {adminHome
                ? isDistrict
                  ? `${[user.district, user.city].filter(Boolean).join(" · ")} · ${institutions.length} okul`
                  : `${user.fullName} · ${institutions.length} okul`
                : institution
                  ? `${institution.name} · ${institution.code} · ${institution.city} / ${institution.district}`
                  : user.fullName}
            </p>
          </div>
          {canOpenNetworkHome(user.role) && institutions.length ? (
            <div className="hidden md:flex items-center gap-3 text-sm">
              {isDistrict ? (
                <p className="max-w-40 truncate rounded-lg border bg-muted/40 px-2.5 py-1.5 text-sm">
                  {user.district || "İlçe"}
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">İlçe</span>
                  <select
                    className="h-8 max-w-44 rounded-lg border bg-background px-2 text-sm"
                    value={isClient ? districtValue : ""}
                    onChange={(event) => {
                      const next = new URLSearchParams(searchParams.toString());
                      next.delete("kurum");
                      const raw = event.target.value;
                      if (!raw) {
                        next.delete("ilce");
                      } else {
                        const sep = raw.indexOf("::");
                        const city = sep >= 0 ? raw.slice(0, sep) : "";
                        const district = sep >= 0 ? raw.slice(sep + 2) : raw;
                        if (city) next.set("il", city);
                        if (district) next.set("ilce", district);
                      }
                      pushNetworkQuery(next);
                    }}
                  >
                    <option value="">Tüm ilçeler</option>
                    {districtPlaces.map((place) => (
                      <option key={`${place.city}::${place.district}`} value={`${place.city}::${place.district}`}>
                        {place.district}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Okul</span>
                <select
                  className="h-8 max-w-48 rounded-lg border bg-background px-2 text-sm"
                  value={institution?.id ?? (isClient ? searchParams.get("kurum") : null) ?? "all"}
                  onChange={(event) => {
                    const id = event.target.value;
                    if (id === "all") {
                      const next = new URLSearchParams(searchParams.toString());
                      next.delete("kurum");
                      pushNetworkQuery(next);
                      return;
                    }
                    if (id === (institution?.id ?? searchParams.get("kurum"))) return;
                    const slug = onPanel && activeSlug ? activeSlug : "okul-ozeti";
                    router.push(withKeptQuery(panelPath(slug, id), searchParams));
                  }}
                >
                  <option value="all">Tüm okullar</option>
                  {visibleSchools.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
          <Link
            href={passwordHref}
            className={cn(
              "hidden sm:inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm hover:bg-muted",
              pathname.startsWith("/sifre") && "bg-muted font-medium",
            )}
          >
            <KeyRound className="size-3.5" /> Şifre
          </Link>
          <Button variant="outline" size="sm" onClick={logout} className="hidden sm:inline-flex">
            Çıkış
          </Button>
        </header>
        <main className="min-w-0 px-4 py-6 lg:px-8 print:px-0 print:py-0">{children}</main>
      </div>
    </div>
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  description,
  active,
  onClick,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      title={description}
      prefetch={false}
      onClick={onClick}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border-2 p-2 text-left transition",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-transparent text-foreground hover:bg-muted",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-tight">{label}</span>
        <span
          className={cn(
            "mt-0.5 hidden text-[11px] leading-snug lg:block",
            active ? "text-primary/80" : "text-muted-foreground",
          )}
        >
          {description}
        </span>
      </span>
    </Link>
  );
}
